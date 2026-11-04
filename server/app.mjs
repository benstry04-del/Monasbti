import {registerReportingRoutes} from './reporting.mjs';
import {projectedState,stateProjection,adminAnalytics} from './state-projection.mjs';
import {registerRecordRoutes} from './records.mjs';
import Fastify from "fastify";
import { captureServerError, flushMonitoring } from "./observability.mjs";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import formBody from '@fastify/formbody';
import rawBody from 'fastify-raw-body';
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { getConfig } from "./config.mjs";
import {integrationRuntimeHook,loadIntegrationEnvironment} from './integration-runtime.mjs';
import { registerAuth } from "./auth.mjs";
import { safeEqual, httpError } from "./security.mjs";
import {requiredMigrations} from './schema.mjs';

const commandInput = z
  .object({
    action: z.string().regex(/^[A-Z_]{1,40}$/),
    payload: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
const paginationInput = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(24),
    q: z.string().max(100).default(""),
  })
  .passthrough();
function parsed(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success)
    throw httpError(400, "بيانات الطلب غير صالحة", "VALIDATION_ERROR");
  return result.data;
}
function requireAdmin(request) {
  if (!request.actor) throw httpError(401, "يلزم تسجيل الدخول");
  if (!["admin", "staff"].includes(request.actor.role))
    throw httpError(403, "الوصول غير مسموح");
}
function cardDataPresent(value) {
  return (
    !!value &&
    typeof value === "object" &&
    Object.entries(value).some(
      ([key, item]) =>
        /^(pan|cvv|cvc|cardNumber|card_number|securityCode)$/i.test(key) ||
        cardDataPresent(item),
    )
  );
}
export async function createApp(options = {}) {
  const config = options.config || getConfig();
  const db = options.db || (await import("./db.mjs"));
  if (config.production) {
    const role = (
      await db.query(
        "SELECT rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user",
      )
    ).rows[0];
    if (!role || role.rolsuper || role.rolcreatedb || role.rolcreaterole)
      throw Error(
        "Production API requires a restricted PostgreSQL runtime role",
      );
    const owned = (
      await db.query(
        "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tableowner=current_user",
      )
    ).rows[0];
    if (Number(owned.count) > 0)
      throw Error(
        "The production runtime role must not own application tables",
      );
  }
  const business = options.business || (await import("./business.mjs"));
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
            level: config.logLevel,
            redact: [
              "req.headers.authorization",
              "req.headers.cookie",
              "req.headers.x-csrf-token",
              "res.headers.set-cookie",
            ],
            serializers: {
              req: (req) => ({
                method: req.method,
                url: req.url?.split("?")[0],
                hostname: req.hostname,
                remoteAddress: req.ip,
              }),
            },
          },
    bodyLimit: 1024 * 1024,
    requestTimeout: 30000,
    connectionTimeout: 10000,
    trustProxy: config.trustProxy,
    genReqId: () => randomUUID(),
  });
  app.decorate("db", db);
  app.decorate("config", config);
  await app.register(formBody);
  await app.register(rawBody,{global:false,encoding:'utf8',runFirst:true});
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 4 },
  });
  await app.register(cookie, {
    secret: config.cookieSecret,
    hook: "onRequest",
  });
  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        fontSrc: ["'self'", "data:"],
        mediaSrc: ["'self'", "blob:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        ...(config.production
          ? { upgradeInsecureRequests: [] }
          : { upgradeInsecureRequests: null }),
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: config.production
      ? { maxAge: 31536000, includeSubDomains: true }
      : false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  });
  await app.register(rateLimit, {
    max: config.environment==="test" && options.testRateLimitMax ? options.testRateLimitMax : 240,
    timeWindow: "1 minute",
    // Fonts, video ranges and SPA navigation must not exhaust API quotas.
    // Authentication routes retain their stricter per-route IP limits.
    allowList: request => !request.url.startsWith("/api/"),
  });
  app.addHook("onRequest", async (request, reply) => {
    reply.header("X-Request-ID", request.id);
    if (request.url.startsWith("/api/"))
      reply.header("Cache-Control", "private, no-store");
    reply.header(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
  });
  await registerAuth(app, { db, config });
  app.addHook('onRequest',integrationRuntimeHook(db,config.encryptionKey));
  app.setErrorHandler((error, request, reply) => {
    const code =
      error.statusCode ||
      (error.name === "ZodError" ? 400 : undefined) ||
      {
        23505: 409,
        23503: 409,
        23514: 400,
        40001: 409,
        "40P01": 409,
        ECONNREFUSED: 503,
      }[error.code] ||
      500;
    if (code >= 500) captureServerError(error, request.id);
    if (code >= 500)
      request.log.error(
        { err: error, requestId: request.id },
        "request_failed",
      );
    const message =
      code >= 500
        ? "الخدمة غير متاحة مؤقتًا؛ أعد المحاولة"
        : code===429?'طلبات كثيرة؛ انتظر قليلًا ثم أعد المحاولة':error.name==='ZodError'?'بيانات غير صالحة؛ راجع الحقول المطلوبة':error.code==='23505'?'توجد بيانات أو عملية مسجلة بهذه المعلومات':error.code==='23503'?'السجل المرتبط غير متاح':error.code==='23514'?'القيمة لا تطابق قواعد النظام':error.message || "تعذر إتمام الطلب";
    reply.code(code).send({
      error: {
        code: error.code || "REQUEST_FAILED",
        message,
        requestId: request.id,
      },
    });
  });
  app.get("/health/live", async () => ({ status: "ok" }));
  app.get("/health/ready", async (_request, reply) => {
    try {
      await db.query("SELECT 1 FROM app_settings LIMIT 1");
      const schema=await db.query('SELECT name FROM schema_migrations WHERE name IN (SELECT jsonb_array_elements_text($1::jsonb))',[JSON.stringify(requiredMigrations)]);
      if(schema.rows.length!==requiredMigrations.length)return reply.code(503).send({status:'schema_not_ready'});
      await loadIntegrationEnvironment(db,config.encryptionKey);
      return { status: "ready" };
    } catch {
      return reply.code(503).send({ status: "unavailable" });
    }
  });
  await registerRecordRoutes(app);
  await registerReportingRoutes(app);
  app.get("/api/state", async (request) =>
    db.transaction((client) =>
      projectedState(client,request.actor,request.visitorId,request.query?.route),
      {readOnly:true},
    ),
  );
  app.post("/api/commands", async (request) => {
    const input = parsed(commandInput, request.body);
    if (cardDataPresent(input.payload))
      throw httpError(
        400,
        "لا ترسل بيانات البطاقة إلى هذا النظام",
        "CARD_DATA_NOT_ACCEPTED",
      );
    const key = request.headers["idempotency-key"];
    if (
      typeof key !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(key)
    )
      throw httpError(
        400,
        "يلزم مفتاح Idempotency-Key صالح",
        "IDEMPOTENCY_REQUIRED",
      );
    return db.transaction(async(client) => {
      const projection=await stateProjection(client,request.actor,request.headers['x-app-route']);
      if(input.action==='SELECT_ORDER' && projection.light)projection.bookingIds=[input.payload.id];
      const result=await business.executeCommand(client,request.actor,request.visitorId,input.action,input.payload,key,projection);
      if(projection.overview)result.analytics=await adminAnalytics(client);
      return result;
    });
  });
  app.get("/api/catalog/:kind", async (request) => {
    const kind = z
      .enum(["services", "packages"])
      .safeParse(request.params.kind);
    if (!kind.success) throw httpError(404, "غير موجود");
    const { page, pageSize, q } = parsed(paginationInput, request.query);
    const table = kind.data === "services" ? "catalog_services" : "packages";
    const column = kind.data === "services" ? "name" : "title";
    const search = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    return db.transaction(async (client) => {
      const total = Number(
        (
          await client.query(
            `SELECT count(*) FROM ${table} WHERE active=true AND ${column} ILIKE $1`,
            [search],
          )
        ).rows[0].count,
      );
      const ids = (
        await client.query(
          `SELECT id FROM ${table} WHERE active=true AND ${column} ILIKE $1 ORDER BY ${column},id LIMIT $2 OFFSET $3`,
          [search, pageSize, (page - 1) * pageSize],
        )
      ).rows.map((row) => row.id);
      const state = await business.readState(
        client,
        request.actor,
        request.visitorId,
      );
      const list = kind.data === "services" ? state.services : state.packages;
      const items = ids
        .map((id) => list.find((item) => item.id === id))
        .filter(Boolean);
      return {
        items,
        total,
        page,
        pageSize,
        pages: Math.ceil(total / pageSize),
      };
    });
  });
  app.get("/api/availability", async (request) => {
    const input = parsed(
      z
        .object({
          serviceId: z.string().min(1).max(100),
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        })
        .strict(),
      request.query,
    );
    const rows = await db.query(
      `SELECT c.id,COALESCE(a.capacity,c.capacity) AS capacity,COALESCE(a.blocked,false) AS blocked,COALESCE((SELECT sum(r.qty) FROM reservations r WHERE r.service_id=c.id AND r.event_date=$2::date AND (r.status='CONFIRMED' OR (r.status='HELD' AND (r.expires_at IS NULL OR r.expires_at>now())))),0) AS reserved FROM catalog_services c LEFT JOIN service_availability a ON a.service_id=c.id AND a.event_date=$2::date WHERE c.id=$1 AND c.active=true`,
      [input.serviceId, input.date],
    );
    if (!rows.rows[0]) throw httpError(404, "الخدمة غير موجودة");
    const row = rows.rows[0];
    return {
      serviceId: row.id,
      date: input.date,
      capacity: Number(row.capacity),
      reserved: Number(row.reserved),
      available: row.blocked
        ? 0
        : Math.max(0, Number(row.capacity) - Number(row.reserved)),
      blocked: row.blocked,
    };
  });
  app.get("/api/availability/batch", async (request) => {
    const { date } = parsed(
      z.object({ date: z.iso.date() }).strict(),
      request.query,
    );
    const result = await db.query(
      `SELECT c.id,COALESCE(a.capacity,c.capacity) AS capacity,COALESCE(a.blocked,false) AS blocked,COALESCE(r.reserved,0) AS reserved FROM catalog_services c LEFT JOIN service_availability a ON a.service_id=c.id AND a.event_date=$1::date LEFT JOIN (SELECT service_id,sum(qty) AS reserved FROM reservations WHERE event_date=$1::date AND (status='CONFIRMED' OR (status='HELD' AND expires_at>now())) GROUP BY service_id) r ON r.service_id=c.id WHERE c.active=true`,
      [date],
    );
    return {
      date,
      items: result.rows.map((r) => ({
        serviceId: r.id,
        available: r.blocked
          ? 0
          : Math.max(0, Number(r.capacity) - Number(r.reserved)),
      })),
    };
  });
  app.get("/api/reports", { preHandler: app.authenticate }, async (request) => {
    requireAdmin(request);
    const [bookings, payments, suppliers, jobs] = await Promise.all([
      db.query(
        "SELECT status,count(*)::int AS count FROM bookings GROUP BY status",
      ),
      db.query(
        "SELECT status,sum(amount_minor)::text AS amount_minor,count(*)::int AS count FROM payments GROUP BY status",
      ),
      db.query(
        "SELECT count(*)::int AS count FROM suppliers WHERE active=true",
      ),
      db.query(
        "SELECT status,count(*)::int AS count FROM outbox GROUP BY status",
      ),
    ]);
    return {
      bookings: bookings.rows,
      payments: payments.rows,
      activeSuppliers: suppliers.rows[0].count,
      jobs: jobs.rows,
      currency: "KWD",
      minorUnit: 1000,
    };
  });
  app.get("/api/audit", { preHandler: app.authenticate }, async (request) => {
    requireAdmin(request);
    const { page, pageSize } = parsed(paginationInput, request.query);
    const result = await db.query(
      "SELECT id,actor_id,action,resource_type,resource_id,before_data,after_data,created_at FROM audit_log ORDER BY created_at DESC,id DESC LIMIT $1 OFFSET $2",
      [pageSize, (page - 1) * pageSize],
    );
    return { items: result.rows, page, pageSize };
  });
  app.get("/metrics", async (request, reply) => {
    if (
      !config.metricsToken ||
      !safeEqual(request.headers.authorization, `Bearer ${config.metricsToken}`)
    )
      throw httpError(404, "غير موجود");
    const result = await db.query(
      "SELECT (SELECT count(*) FROM bookings) AS bookings,(SELECT count(*) FROM payments WHERE status='PENDING') AS pending_payments,(SELECT count(*) FROM outbox WHERE status='DEAD') AS dead_jobs",
    );
    const row = result.rows[0];
    reply.type("text/plain; version=0.0.4");
    return `# TYPE habb_bookings_total gauge\nhabb_bookings_total ${row.bookings}\n# TYPE habb_pending_payments gauge\nhabb_pending_payments ${row.pending_payments}\n# TYPE habb_dead_jobs gauge\nhabb_dead_jobs ${row.dead_jobs}\n`;
  });
  if (options.registerIntegrations !== false) {
    const { registerIntegrationRoutes } = await import("./integrations.mjs");
    await registerIntegrationRoutes(app);
    const { registerSettlementRoutes } = await import("./settlements.mjs");
    await registerSettlementRoutes(app);
    const {registerAdminIntegrationRoutes}=await import('./admin-integrations.mjs');
    await registerAdminIntegrationRoutes(app);
    const {registerDeliveryRoutes}=await import('./notification-delivery.mjs');
    await registerDeliveryRoutes(app);
    const {registerSignatureRoutes}=await import('./signatures.mjs');
    await registerSignatureRoutes(app);
  }
  const publicDir = resolve(config.publicDir);
  if (existsSync(resolve(publicDir, "index.html"))) {
    await app.register(fastifyStatic, {
      root: publicDir,
      prefix: "/",
      wildcard: false,
      setHeaders: (reply, path) => {
        reply.header(
          "Cache-Control",
          path.endsWith("sw.js") || path.endsWith("index.html")
            ? "no-store"
            : /[/\\]assets[/\\].*-[\w-]+\.(js|css)$/.test(path)
            ? "public,max-age=31536000,immutable"
            : "public,max-age=300",
        );
      },
    });
    app.setNotFoundHandler((request, reply) => {
      if (
        request.url.startsWith("/api/") ||
        /\.[a-z\d]+(?:\?|$)/i.test(request.url) ||
        (config.production && /^\/demo(?:\/|\?|$)/.test(request.url))
      )
        return reply
          .code(404)
          .send({ error: { code: "NOT_FOUND", message: "غير موجود" } });
      reply.header("Cache-Control", "no-store");
      return reply.sendFile("index.html");
    });
  }
  return app;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const config = getConfig();
  const app = await createApp({ config });
  let closing = false;
  const shutdown = async (signal) => {
    if (closing) return;
    closing = true;
    app.log.info({ signal }, "shutdown_started");
    await app.close();
    await flushMonitoring();
    await app.db.pool?.end();
  };
  process.once("SIGTERM", () =>
    shutdown("SIGTERM").catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    }),
  );
  process.once("SIGINT", () =>
    shutdown("SIGINT").catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    }),
  );
  await app.listen({ host: config.host, port: config.port });
}
