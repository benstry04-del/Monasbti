import { currentBrand } from "./providers/documents.mjs";
import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  token,
  tokenHash,
  safeEqual,
  httpError,
  hashPassword,
  verifyPassword,
  csrfForVisitor,
} from "./security.mjs";
export { hashPassword } from "./security.mjs";

const email = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((v) => v.toLowerCase());
const password = z.string().min(12).max(128);
const name = z.string().trim().min(2).max(120);
const registerInput = z
  .object({
    email,
    password,
    name,
    mobile: z
      .string()
      .trim()
      .min(8)
      .max(24)
      .regex(/^\+?[\d\s()-]+$/),
    location: z.string().max(120).optional(),
  })
  .strict();
const loginInput = z
  .object({ email, password: z.string().min(1).max(128) })
  .strict();
const verificationInput = z
  .object({
    email: email.optional(),
    code: z
      .string()
      .regex(/^\d{6}$/)
      .optional(),
    token: z.string().min(30).max(128).optional(),
  })
  .strict()
  .refine(
    (x) => x.token || (x.email && x.code),
    "Verification token or email/code required",
  );
const addressInput = z.object({ email }).strict();
const resetInput = z
  .object({ token: z.string().min(30).max(128), password })
  .strict();
const invitationInput = z
  .object({
    email,
    name,
    role: z.enum(["customer", "supplier", "staff", "admin"]),
    supplierId: z.string().min(1).max(100).optional(),
    mobile: z.string().max(24).default(""),
  })
  .strict()
  .refine(
    (x) => x.role !== "supplier" || !!x.supplierId,
    "Supplier identity required",
  );
const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  mobile: user.mobile,
  role: user.role,
  supplierId: user.supplier_id,
  verifiedAt: user.verified_at,
  mfaVerified: !!user.mfa_verified,
});
const validation = (schema, data) => {
  const result = schema.safeParse(data);
  if (!result.success)
    throw httpError(
      400,
      "البيانات غير مكتملة أو غير صالحة",
      "VALIDATION_ERROR",
    );
  return result.data;
};
const genericRecovery = {
  ok: true,
  message: "إذا كان البريد مسجلًا، ستصل رسالة تتضمن الخطوة التالية.",
};
const rate = (max, timeWindow = "15 minutes") => ({
  config: { rateLimit: { max, timeWindow } },
});

async function audit(client, request, action, resourceId, after = null) {
  await client.query(
    "INSERT INTO audit_log(actor_id,action,resource_type,resource_id,after_data,ip) VALUES($1,$2,$3,$4,$5,$6)",
    [request.actor?.id || null, action, "user", resourceId, after, request.ip],
  );
}
async function mail(client, to, subject, text, extra = {}) {
  await client.query(
    "INSERT INTO outbox(job_type,payload,dedupe_key) VALUES($1,$2,$3)",
    ["EMAIL", { to, subject, text, ...extra }, `auth-mail:${randomUUID()}`],
  );
}
async function issueToken(client, userId, purpose, raw, minutes, payload = {}) {
  await client.query(
    "UPDATE auth_tokens SET consumed_at=now() WHERE user_id=$1 AND purpose=$2 AND consumed_at IS NULL",
    [userId, purpose],
  );
  await client.query(
    "INSERT INTO auth_tokens(token_hash,user_id,purpose,expires_at,payload) VALUES($1,$2,$3,now()+($4::text || ' minutes')::interval,$5)",
    [tokenHash(raw), userId, purpose, minutes, payload],
  );
}
async function issueVerification(client, user) {
  const code = String(randomInt(0, 1000000)).padStart(6, "0");
  await issueToken(client, user.id, "VERIFY", `${user.email}:${code}`, 15, {
    attempts: 0,
  });
  await mail(
    client,
    user.email,
    ["تحقق من حسابك", (await currentBrand(client)).title].filter(Boolean).join(" — "),
    `رمز التحقق من حسابك: ${code}\nينتهي خلال 15 دقيقة. إذا لم تطلب ذلك فتجاهل الرسالة.`,
  );
}
async function issueSession(
  client,
  user,
  config,
  mfaVerified = false,
  visitorId,
) {
  if (user.role === "customer" && visitorId && visitorId !== user.id) {
    await client.query(
      "INSERT INTO workspaces(id,data) VALUES($1,'{}') ON CONFLICT DO NOTHING",
      [user.id],
    );
    const workspaces = (
      await client.query(
        "SELECT id,data FROM workspaces WHERE id=$1 OR id=$2 ORDER BY id FOR UPDATE",
        [visitorId, user.id],
      )
    ).rows;
    const guest = workspaces.find((x) => x.id === visitorId)?.data,
      account = workspaces.find((x) => x.id === user.id)?.data || {};
    if (guest) {
      const cart = [...(account.cart || [])];
      for (const line of guest.cart || []) {
        const existing = cart.find((x) => x.id === line.id);
        if (existing) existing.qty = Math.min(10000, existing.qty + line.qty);
        else cart.push(line);
      }
      const data = {
        ...account,
        cart,
        favorites: [
          ...new Set([
            ...(account.favorites || []),
            ...(guest.favorites || []),
          ]),
        ],
        ...((guest.cart || []).length
          ? { planner: guest.planner || account.planner }
          : {}),
      };
      await client.query(
        "UPDATE workspaces SET data=$2,updated_at=now() WHERE id=$1",
        [user.id, data],
      );
      await client.query("DELETE FROM workspaces WHERE id=$1", [visitorId]);
    }
  }
  const raw = token(),
    csrfToken = token();
  await client.query(
    "INSERT INTO sessions(id,user_id,csrf_token,expires_at,mfa_verified) VALUES($1,$2,$3,now()+($4::text || ' hours')::interval,$5)",
    [tokenHash(raw), user.id, csrfToken, config.sessionHours, mfaVerified],
  );
  return {
    raw,
    csrfToken,
    user: publicUser({ ...user, mfa_verified: mfaVerified }),
  };
}
function setSession(reply, session, config) {
  reply.setCookie("habb_session", session.raw, {
    signed: true,
    path: "/api",
    httpOnly: true,
    secure: config.production || config.appOrigin.startsWith("https:"),
    sameSite: "lax",
    maxAge: config.sessionHours * 3600,
  });
}
function outcome(result) {
  if (result?.error)
    throw httpError(
      result.error.status,
      result.error.message,
      result.error.code,
    );
  return result;
}

export async function registerAuth(app, { db, config }) {
  app.decorateRequest("actor", null);
  app.decorateRequest("visitorId", null);
  app.decorateRequest("csrfToken", null);
  app.decorateRequest("sessionHash", null);
  const dummyHash = await hashPassword(token());
  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/api/")) return;
    reply.header("Cache-Control", "no-store");
    let visitorId;
    if (request.cookies.habb_visitor) {
      const decoded = request.unsignCookie(request.cookies.habb_visitor);
      if (decoded.valid && /^[\w-]{43}$/.test(decoded.value))
        visitorId = decoded.value;
    }
    if (!visitorId) {
      visitorId = token();
      reply.setCookie("habb_visitor", visitorId, {
        signed: true,
        path: "/api",
        httpOnly: true,
        secure: config.production || config.appOrigin.startsWith("https:"),
        sameSite: "lax",
        maxAge: 30 * 86400,
      });
    }
    request.visitorId = visitorId;
    request.csrfToken = csrfForVisitor(visitorId, config.cookieSecret);
    if (request.cookies.habb_session) {
      const decoded = request.unsignCookie(request.cookies.habb_session);
      if (decoded.valid && /^[\w-]{43}$/.test(decoded.value)) {
        const sessionHash = tokenHash(decoded.value);
        const result = await db.query(
          `SELECT u.*,s.csrf_token,s.mfa_verified FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=$1 AND s.expires_at>now() AND u.active=true AND u.verified_at IS NOT NULL`,
          [sessionHash],
        );
        const user = result.rows[0];
        if (
          user
        ) {
          request.actor = publicUser(user);
          request.csrfToken = user.csrf_token;
          request.sessionHash = sessionHash;
        }
      }
    }
  });
  app.decorate("authenticate", async function (request) {
    if (!request.actor)
      throw httpError(401, "يلزم تسجيل الدخول", "AUTHENTICATION_REQUIRED");
  });
  app.addHook("preHandler", async (request) => {
    if (
      !request.url.startsWith("/api/") ||
      ["GET", "HEAD", "OPTIONS"].includes(request.method) ||
      /^\/api\/webhooks\//.test(request.url) ||
      request.routeOptions.config.csrf === false
    )
      return;
    const origin = request.headers.origin;
    if (
      origin !== config.appOrigin ||
      request.headers["sec-fetch-site"] === "cross-site" ||
      !safeEqual(request.headers["x-csrf-token"], request.csrfToken)
    )
      throw httpError(
        403,
        "تعذر التحقق من مصدر الطلب؛ حدّث الصفحة وأعد المحاولة",
        "CSRF_REJECTED",
      );
  });

  app.get("/api/auth/session", async (request) => ({
    user: request.actor,
    csrfToken: request.csrfToken,
  }));
  app.post("/api/auth/register", rate(5, "1 hour"), async (request, reply) => {
    const input = validation(registerInput, request.body);
    try {
      await db.transaction(async (client) => {
        const result = await client.query(
          "INSERT INTO users(id,email,name,mobile,role,password_hash) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
          [
            `c-${randomUUID()}`,
            input.email,
            input.name,
            input.mobile,
            "customer",
            await hashPassword(input.password),
          ],
        );
        await issueVerification(client, result.rows[0]);
        await audit(client, request, "AUTH_REGISTER", result.rows[0].id);
      });
    } catch (error) {
      if (error.code === "23505")
        throw httpError(409, "هذا البريد مسجل بالفعل", "ACCOUNT_EXISTS");
      throw error;
    }
    return reply
      .code(202)
      .send({ ok: true, requiresVerification: true, email: input.email });
  });

  app.post("/api/auth/login", rate(12), async (request, reply) => {
    const input = validation(loginInput, request.body);
    const result = await db.transaction(async (client) => {
      const user = (
        await client.query(
          "SELECT * FROM users WHERE lower(email)=$1 FOR UPDATE",
          [input.email],
        )
      ).rows[0];
      const correct = await verifyPassword(
        input.password,
        user?.password_hash || dummyHash,
      );
      if (!correct || !user?.active) {
        await audit(
          client,
          request,
          "AUTH_LOGIN_REJECTED",
          user?.id || tokenHash(input.email),
        );
        return {
          error: {
            status: 401,
            message: "بيانات الدخول غير صحيحة",
            code: "INVALID_CREDENTIALS",
          },
        };
      }
      if (!user.verified_at)
        return {
          error: {
            status: 403,
            message: "تحقق من بريدك قبل تسجيل الدخول",
            code: "EMAIL_NOT_VERIFIED",
          },
        };
      const session = await issueSession(
        client,
        user,
        config,
        false,
        request.visitorId,
      );
      await audit(client, request, "AUTH_LOGIN", user.id);
      return { session };
    });
    outcome(result);
    if (!result.session) return result;
    setSession(reply, result.session, config);
    return { user: result.session.user, csrfToken: result.session.csrfToken };
  });

  app.post("/api/auth/verify", rate(10), async (request, reply) => {
    const input = validation(verificationInput, request.body);
    const result = await db.transaction(async (client) => {
      let challenge;
      if (input.token)
        challenge = (
          await client.query(
            "SELECT * FROM auth_tokens WHERE token_hash=$1 AND purpose='VERIFY' AND consumed_at IS NULL AND expires_at>now() FOR UPDATE",
            [tokenHash(input.token)],
          )
        ).rows[0];
      else {
        const user = (
          await client.query(
            "SELECT * FROM users WHERE lower(email)=$1 FOR UPDATE",
            [input.email],
          )
        ).rows[0];
        if (user)
          challenge = (
            await client.query(
              "SELECT * FROM auth_tokens WHERE user_id=$1 AND purpose='VERIFY' AND consumed_at IS NULL AND expires_at>now() ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
              [user.id],
            )
          ).rows[0];
        if (
          challenge &&
          !safeEqual(
            challenge.token_hash,
            tokenHash(`${input.email}:${input.code}`),
          )
        ) {
          const payload = {
            ...challenge.payload,
            attempts: Number(challenge.payload?.attempts || 0) + 1,
          };
          await client.query(
            "UPDATE auth_tokens SET payload=$2,consumed_at=CASE WHEN $3>=5 THEN now() ELSE consumed_at END WHERE token_hash=$1",
            [challenge.token_hash, payload, payload.attempts],
          );
          challenge = null;
        }
      }
      if (!challenge || Number(challenge.payload?.attempts || 0) >= 5)
        return {
          error: {
            status: 400,
            code: "VERIFICATION_INVALID",
            message: "رمز التحقق غير صحيح أو انتهت صلاحيته",
          },
        };
      await client.query(
        "UPDATE auth_tokens SET consumed_at=now() WHERE token_hash=$1",
        [challenge.token_hash],
      );
      const user = (
        await client.query(
          "UPDATE users SET verified_at=now(),updated_at=now() WHERE id=$1 AND active=true RETURNING *",
          [challenge.user_id],
        )
      ).rows[0];
      if (!user) throw httpError(400, "الحساب غير متاح");
      await audit(client, request, "AUTH_VERIFIED", user.id);
      return {
        session: await issueSession(
          client,
          user,
          config,
          false,
          request.visitorId,
        ),
      };
    });
    outcome(result);
    if (!result.session) return result;
    setSession(reply, result.session, config);
    return { user: result.session.user, csrfToken: result.session.csrfToken };
  });

  app.post("/api/auth/resend", rate(4, "1 hour"), async (request) => {
    const input = validation(addressInput, request.body);
    await db.transaction(async (client) => {
      const user = (
        await client.query(
          "SELECT * FROM users WHERE lower(email)=$1 AND active=true AND verified_at IS NULL FOR UPDATE",
          [input.email],
        )
      ).rows[0];
      if (user) await issueVerification(client, user);
    });
    return genericRecovery;
  });
  app.post(
    "/api/auth/forgot-password",
    rate(4, "1 hour"),
    async (request, reply) => {
      const input = validation(addressInput, request.body);
      await db.transaction(async (client) => {
        const user = (
          await client.query(
            "SELECT * FROM users WHERE lower(email)=$1 AND active=true FOR UPDATE",
            [input.email],
          )
        ).rows[0];
        if (!user) return;
        const raw = token();
        await issueToken(client, user.id, "RESET", raw, 30);
        const url = `${config.appOrigin}/auth/reset-password?token=${encodeURIComponent(raw)}`;
        await mail(
          client,
          user.email,
          ["استعادة كلمة المرور", (await currentBrand(client)).title].filter(Boolean).join(" — "),
          `لإعادة تعيين كلمة مرورك افتح الرابط:\n${url}\nينتهي الرابط خلال 30 دقيقة. تجاهل الرسالة إذا لم تطلبها.`,
        );
        await audit(client, request, "AUTH_RECOVERY_REQUESTED", user.id);
      });
      return reply.code(202).send(genericRecovery);
    },
  );
  app.post("/api/auth/reset-password", rate(6), async (request) => {
    const input = validation(resetInput, request.body),
      passwordHash = await hashPassword(input.password);
    await db.transaction(async (client) => {
      const challenge = (
        await client.query(
          "SELECT * FROM auth_tokens WHERE token_hash=$1 AND purpose IN ('RESET','INVITE') AND consumed_at IS NULL AND expires_at>now() FOR UPDATE",
          [tokenHash(input.token)],
        )
      ).rows[0];
      if (!challenge)
        throw httpError(
          400,
          "الرابط غير صالح أو انتهت صلاحيته",
          "RESET_INVALID",
        );
      await client.query(
        "UPDATE users SET password_hash=$2,active=CASE WHEN $3='INVITE' THEN true ELSE active END,verified_at=COALESCE(verified_at,now()),updated_at=now() WHERE id=$1",
        [challenge.user_id, passwordHash, challenge.purpose],
      );
      await client.query("DELETE FROM sessions WHERE user_id=$1", [
        challenge.user_id,
      ]);
      await client.query(
        "UPDATE auth_tokens SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL",
        [challenge.user_id],
      );
      await audit(client, request, "AUTH_PASSWORD_RESET", challenge.user_id);
    });
    return { ok: true, requiresLogin: true };
  });
  app.post("/api/auth/logout", async (request, reply) => {
    if (request.sessionHash)
      await db.transaction(async (client) => {
        await client.query("DELETE FROM sessions WHERE id=$1", [
          request.sessionHash,
        ]);
        await audit(client, request, "AUTH_LOGOUT", request.actor.id);
      });
    reply.clearCookie("habb_session", {
      path: "/api",
      secure: config.production || config.appOrigin.startsWith("https:"),
      sameSite: "lax",
      httpOnly: true,
    });
    return {
      ok: true,
      csrfToken: csrfForVisitor(request.visitorId, config.cookieSecret),
    };
  });
  app.post(
    "/api/auth/invite",
    { preHandler: app.authenticate, ...rate(20, "1 hour") },
    async (request, reply) => {
      if (request.actor.role !== "admin")
        throw httpError(403, "لا تملك صلاحية دعوة المستخدمين");
      const input = validation(invitationInput, request.body);
      try {
        await db.transaction(async (client) => {
          const userId = `u-${randomUUID()}`;
          await client.query(
            "INSERT INTO users(id,email,name,mobile,role,supplier_id,password_hash,active) VALUES($1,$2,$3,$4,$5,$6,$7,false)",
            [
              userId,
              input.email,
              input.name,
              input.mobile,
              input.role,
              input.supplierId || null,
              "!INVITED",
            ],
          );
          const raw = token();
          await issueToken(client, userId, "INVITE", raw, 1440);
          const url = `${config.appOrigin}/auth/reset-password?token=${encodeURIComponent(raw)}`;
          await mail(
            client,
            input.email,
            ["دعوة لتفعيل حسابك", (await currentBrand(client)).title].filter(Boolean).join(" — "),
            `مرحبًا ${input.name}، افتح الرابط لتفعيل حسابك واختيار كلمة المرور:\n${url}\nينتهي خلال 24 ساعة.`,
          );
          await audit(client, request, "AUTH_INVITED", userId, {
            role: input.role,
            supplierId: input.supplierId || null,
          });
        });
      } catch (error) {
        if (error.code === "23505")
          throw httpError(409, "هذا البريد مسجل بالفعل");
        throw error;
      }
      return reply.code(202).send({ ok: true });
    },
  );
}
