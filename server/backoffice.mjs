import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { businessPDF } from "./providers/business-pdf.mjs";
import { contentFields, homeSections } from "../src/content-fields.mjs";
import { brandSnapshot, procurementHTML } from "./providers/documents.mjs";
import { z } from "zod";
import { httpError } from "./security.mjs";
import { hasPermission, staffPermissionLabels } from "../src/staff-permissions.mjs";

const uuid = z.uuid();
const reference = z.string().trim().min(1).max(150).nullable().default(null);
const money = z.number().int().min(0).max(10000000000);
const text = z.string().trim().max(3000);
const expenseInput = z.object({
  version: z.number().int().positive().optional(),
  bookingId: reference, supplierId: reference, date: z.iso.date(),
  amount: money.min(1), paid: money, archived: z.boolean(),
  category: z.string().trim().min(1).max(100), method: z.string().trim().min(1).max(80),
  recipient: text, notes: text, invoice: text, fileId: uuid.nullable().default(null),
  recurring: z.enum(["none","monthly","yearly"]),
}).strict();
const purchaseInput = z.object({
  version: z.number().int().positive().optional(),
  supplierId: reference, bookingId: reference, date: z.iso.date(),
  status: z.enum(["DRAFT","SENT","RECEIVED","CANCELLED"]),
  items: z.array(z.object({
    serviceId: reference, name: z.string().trim().min(1).max(160),
    quantity: z.number().int().min(1).max(10000), unitCost: money.min(1),
  }).strict()).min(1).max(100),
  paid: money, notes: text, invoice: text, fileId: uuid.nullable().default(null),
}).strict();
const resourceTypes = {
  expenses: { table: "admin_expenses", schema: expenseInput, date: "expense_date", state: "archived" },
  procurement: { table: "purchase_orders", schema: purchaseInput, date: "delivery_date", state: "status" },
};
const contentKey = z.string().regex(/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*){2,4}$/).max(150);
const mediaExtensions = {"image/jpeg":"jpg","image/png":"png","image/webp":"webp","video/mp4":"mp4","video/webm":"webm"};
const mediaName = /^[a-f0-9-]{36}\.(jpg|png|webp|mp4|webm)$/;
const mediaRoot = () => resolve(process.env.STORAGE_DIR || "./data/uploads","website");
function mediaType(buffer) {
  if (buffer.length > 12 && buffer.toString("ascii",4,8) === "ftyp") return "video/mp4";
  if (buffer.length > 12 && buffer.subarray(0,4).equals(Buffer.from("1a45dfa3","hex")) &&
      buffer.subarray(0,128).includes("webm")) return "video/webm";
  if (buffer.subarray(0,8).equals(Buffer.from("89504e470d0a1a0a","hex"))) return "image/png";
  if (buffer.subarray(0,3).equals(Buffer.from("ffd8ff","hex"))) return "image/jpeg";
  if (buffer.toString("ascii",0,4) === "RIFF" && buffer.toString("ascii",8,12) === "WEBP") return "image/webp";
  return null;
}
function requirePermission(request, permission) {
  if (!hasPermission(request.actor, permission)) throw httpError(403, "هذا الإجراء غير مخوّل");
}
async function audit(client, request, action, type, id, before, after) {
  await client.query(
    "INSERT INTO audit_log(actor_id,action,resource_type,resource_id,before_data,after_data,ip) VALUES($1,$2,$3,$4,$5,$6,$7)",
    [request.actor.id, action, type, id, before, after, request.ip],
  );
}
function resource(request, action) {
  const kind = request.params.kind;
  if (!Object.hasOwn(resourceTypes, kind)) throw httpError(404, "القسم غير موجود");
  requirePermission(request, kind + "." + action);
  return resourceTypes[kind];
}
export async function registerBackofficeRoutes(app) {
  const db = app.db;
  const auth = { preHandler: app.authenticate };
  app.get("/api/backoffice/roles", auth, async request => {
    if (request.actor.role !== "admin") throw httpError(403, "إدارة الأدوار من صلاحية المالك");
    const roles = (await db.query(
      "SELECT r.*,(SELECT count(*) FROM users u WHERE u.staff_role_id=r.id) AS members FROM staff_roles r ORDER BY r.name",
    )).rows;
    return { roles, permissions: staffPermissionLabels };
  });
  app.post("/api/backoffice/roles", auth, async request => {
    if (request.actor.role !== "admin") throw httpError(403, "إدارة الأدوار من صلاحية المالك");
    const input = z.object({
      id: uuid.optional(), name: z.string().trim().min(2).max(100), active:z.boolean(),
      permissions: z.array(z.string().refine(key => Object.hasOwn(staffPermissionLabels,key))).max(100),
    }).strict().parse(request.body);
    return db.transaction(async client => {
      const before = input.id && (await client.query("SELECT * FROM staff_roles WHERE id=$1 FOR UPDATE", [input.id])).rows[0];
      if (input.id && !before) throw httpError(404, "الدور غير موجود");
      if (before && !input.active && (await client.query("SELECT 1 FROM users WHERE staff_role_id=$1 AND active LIMIT 1", [input.id])).rowCount)
        throw httpError(409, "أعد تعيين الموظفين النشطين قبل تعطيل الدور");
      const permissions = JSON.stringify([...new Set(input.permissions)]);
      const result = input.id
        ? await client.query("UPDATE staff_roles SET name=$2,permissions=$3,active=$4,updated_at=now() WHERE id=$1 RETURNING *", [input.id,input.name,permissions,input.active])
        : await client.query("INSERT INTO staff_roles(name,permissions,active) VALUES($1,$2,$3) RETURNING *",[input.name,permissions,input.active]);
      const role = result.rows[0];
      await audit(client, request, "STAFF_ROLE_SAVED", "staff_role", role.id, before || null, role);
      return role;
    });
  });
  app.post("/api/backoffice/roles/:id/delete", auth, async request => {
    if (request.actor.role !== "admin") throw httpError(403, "إدارة الأدوار من صلاحية المالك");
    const id = uuid.parse(request.params.id);
    return db.transaction(async client => {
      const before = (await client.query("SELECT * FROM staff_roles WHERE id=$1 FOR UPDATE",[id])).rows[0];
      if (!before) throw httpError(404,"الدور غير موجود");
      if ((await client.query("SELECT 1 FROM users WHERE staff_role_id=$1 LIMIT 1",[id])).rowCount)
        throw httpError(409,"أزل تعيين الدور من الحسابات المرتبطة أولًا");
      await client.query("DELETE FROM staff_roles WHERE id=$1",[id]);
      await audit(client,request,"STAFF_ROLE_DELETED","staff_role",id,before,null);
      return {ok:true};
    });
  });
  app.post("/api/backoffice/role-assignments", auth, async request => {
    if (request.actor.role !== "admin") throw httpError(403, "تعيين الأدوار من صلاحية المالك");
    const input = z.object({ userId: z.string().min(1).max(150), roleId: uuid.nullable() }).strict().parse(request.body);
    return db.transaction(async client => {
      if (input.roleId && !(await client.query("SELECT 1 FROM staff_roles WHERE id=$1 AND active FOR SHARE", [input.roleId])).rowCount)
        throw httpError(409, "الدور غير متاح");
      const before = (await client.query("SELECT staff_role_id FROM users WHERE id=$1 AND role='staff' FOR UPDATE",[input.userId])).rows[0];
      if (!before) throw httpError(404, "حساب الموظف غير موجود");
      await client.query("UPDATE users SET staff_role_id=$2,updated_at=now() WHERE id=$1",[input.userId,input.roleId]);
      await audit(client,request,"STAFF_ROLE_ASSIGNED","user",input.userId,before,input);
      return {ok:true};
    });
  });

  app.get("/api/backoffice/bookings/:id/related", auth, async request => {
    requirePermission(request,"orders.view");
    const id = z.string().min(1).max(150).parse(request.params.id);
    return db.transaction(async client => {
      const booking = (await client.query("SELECT customer_id FROM bookings WHERE id=$1",[id])).rows[0];
      if (!booking) throw httpError(404,"الحجز غير موجود");
      const customer = hasPermission(request.actor,"customers.view") ?
        (await client.query("SELECT id,name,email,mobile FROM users WHERE id=$1",[booking.customer_id])).rows[0] : null;
      const purchase = hasPermission(request.actor,"procurement.view") ?
        (await client.query("SELECT id,status,data->'items'->0->>'name' AS title FROM purchase_orders WHERE booking_id=$1 ORDER BY created_at DESC LIMIT 25",[id])).rows : [];
      const expenses = hasPermission(request.actor,"expenses.view") ?
        (await client.query("SELECT id,data->>'category' AS title,amount_minor,paid_minor FROM admin_expenses WHERE booking_id=$1 ORDER BY expense_date DESC LIMIT 25",[id])).rows : [];
      const activity = (await client.query(
        "SELECT a.id,a.action,a.created_at,u.name FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id WHERE a.resource_type='booking' AND a.resource_id=$1 ORDER BY a.created_at DESC LIMIT 25",
        [id],
      )).rows;
      return {customer,purchase,expenses,activity};
    },{readOnly:true});
  });
  app.get("/api/backoffice/records/:kind", auth, async request => {
    const spec = resource(request, "view");
    const page = z.coerce.number().int().min(1).max(100000).default(1).parse(request.query.page);
    const supplierId = reference.parse(request.query.supplierId);
    const bookingId = reference.parse(request.query.bookingId);
    const items = (await db.query(
      `SELECT * FROM ${spec.table} WHERE ($2::text IS NULL OR supplier_id=$2) AND ($3::text IS NULL OR booking_id=$3)
       ORDER BY ${spec.date} DESC,id LIMIT 26 OFFSET $1`, [(page - 1) * 25,supplierId,bookingId],
    )).rows;
    return { items:items.slice(0,25), hasNext:items.length>25 };
  });
  app.get("/api/backoffice/records/:kind/:id/print", auth, async (request,reply) => {
    const spec = resource(request,"view");
    if (request.params.kind !== "procurement") throw httpError(404,"المستند غير متاح");
    const row = (await db.query(
      `SELECT p.*,s.name AS supplier_name FROM ${spec.table} p JOIN suppliers s ON s.id=p.supplier_id WHERE p.id=$1`,
      [uuid.parse(request.params.id)],
    )).rows[0];
    if (!row) throw httpError(404,"طلب التوريد غير موجود");
    const money = minor => (Number(minor)/1000).toFixed(3);
    const settings = (await db.query("SELECT data FROM app_settings WHERE id=true")).rows[0]?.data;
    const rawSettings = settings?.settings || settings;
    if (request.query.format === "pdf") {
      return reply.type("application/pdf").header("Content-Disposition","attachment; filename=purchase-order.pdf")
        .send(businessPDF({
          settings: rawSettings,
          docType: "PROCUREMENT",
          title: "طلب توريد",
          reference: row.id,
          status: row.status,
          fields: [
            { label: "المورد", value: row.supplier_name },
            { label: "تاريخ التسليم", value: row.data.date },
            { label: "المدفوع", value: `${money(row.paid_minor)} د.ك` },
            ...(row.data.bookingId ? [{ label: "مرجع الحجز", value: row.data.bookingId }] : []),
          ],
          lines: row.data.items.map(item => ({ title: item.name, quantity: item.quantity, price: Number(item.unitCost) / 1000 })),
          total: Number(row.amount_minor) / 1000,
          notes: [row.data.notes].filter(Boolean),
        }));
    }
    return reply
      .type("text/html; charset=utf-8")
      .header("Cache-Control", "private, no-store")
      .header("Content-Security-Policy", "default-src 'none'; img-src data:; style-src 'unsafe-inline'; frame-ancestors 'self'")
      .send(procurementHTML({
        record: row,
        supplierName: row.supplier_name,
        identity: brandSnapshot(rawSettings),
        moneyFn: money,
      }));
  });
  app.get("/api/backoffice/records/:kind/:id", auth, async request => {
    const spec = resource(request, "view");
    const id = uuid.parse(request.params.id);
    const record = (await db.query(`SELECT * FROM ${spec.table} WHERE id=$1`,[id])).rows[0];
    if (!record) throw httpError(404, "السجل غير موجود");
    const history = (await db.query(
      "SELECT a.action,a.created_at,u.name FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id WHERE a.resource_type=$1 AND a.resource_id=$2 ORDER BY a.created_at DESC LIMIT 50",
      [request.params.kind,id],
    )).rows;
    return { record, history };
  });
  app.post("/api/backoffice/records/:kind/:id", auth, async request => {
    const spec = resource(request, "edit");
    const create = request.params.id === "new";
    const id = create ? null : uuid.parse(request.params.id);
    const input = spec.schema.parse(request.body);
    const purchase = request.params.kind === "procurement";
    const amount = purchase ? input.items.reduce((sum,item) => sum + item.quantity * item.unitCost,0) : input.amount;
    if (input.paid > amount || amount > 10000000000) throw httpError(409,"المبلغ المدفوع أو الإجمالي خارج النطاق");
    if (purchase && !input.supplierId) throw httpError(400,"اختر المورد");
    return db.transaction(async client => {
      const before = id && (await client.query(`SELECT * FROM ${spec.table} WHERE id=$1 FOR UPDATE`,[id])).rows[0];
      if (id && !before) throw httpError(404,"السجل غير موجود");
      if (before && before.version !== input.version) throw httpError(409,"تغيّر السجل. أعد تحميله قبل الحفظ");
      if (before && (before.archived || before.status === "CANCELLED")) throw httpError(409,"السجل مغلق");
      if (purchase) {
        const supplier = (await client.query("SELECT active FROM suppliers WHERE id=$1 FOR SHARE",[input.supplierId])).rows[0];
        if (!supplier || (!supplier.active && (!before || before.supplier_id !== input.supplierId)))
          throw httpError(409,"المورد غير متاح للتوريد");
        const transitions = {DRAFT:["DRAFT","SENT","CANCELLED"], SENT:["SENT","RECEIVED","CANCELLED"], RECEIVED:["RECEIVED"]};
        if (!transitions[before?.status || "DRAFT"].includes(input.status)) throw httpError(409,"انتقال الحالة غير مسموح");
        if (before?.status === "RECEIVED" && (Number(before.amount_minor) !== amount ||
            before.supplier_id !== input.supplierId || before.booking_id !== input.bookingId))
          throw httpError(409,"لا يمكن تغيير أصل طلب توريد مستلم");
        for (const item of input.items)
          if (item.serviceId && !(await client.query("SELECT 1 FROM catalog_services WHERE id=$1 AND supplier_id=$2",[item.serviceId,input.supplierId])).rowCount)
            throw httpError(409,"أحد الأصناف لا يتبع المورد المختار");
      }
      if (input.status === "CANCELLED" && (input.paid || Number(before?.paid_minor || 0)))
        throw httpError(409,"توجد دفعات مسجلة لهذا السجل");
      if (input.archived && !before) throw httpError(409,"احفظ المصروف قبل أرشفته");
      if (input.archived && before && (input.paid !== Number(before.paid_minor) || amount !== Number(before.amount_minor)))
        throw httpError(409,"احفظ التعديلات المالية قبل الأرشفة");
      if (input.fileId && !(await client.query("SELECT 1 FROM files WHERE id=$1 AND (owner_id=$2 OR $3)", [input.fileId,request.actor.id,request.actor.role === "admin"])).rowCount)
        throw httpError(403,"المرفق غير مخوّل");
      const state = purchase ? input.status : input.archived;
      const values = [input.bookingId,input.supplierId,input.date,amount,input.paid,state,input];
      const saved = create
        ? await client.query(`INSERT INTO ${spec.table}(booking_id,supplier_id,${spec.date},amount_minor,paid_minor,${spec.state},data) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,values)
        : await client.query(`UPDATE ${spec.table} SET booking_id=$1,supplier_id=$2,${spec.date}=$3,amount_minor=$4,paid_minor=$5,${spec.state}=$6,data=$7,version=version+1 WHERE id=$8 RETURNING *`,[...values,id]);
      const record = saved.rows[0];
      await audit(client,request,"BACKOFFICE_RECORD_SAVED",request.params.kind,record.id,before || null,record);
      return record;
    });
  });
  app.post("/api/backoffice/content-media", auth, async request => {
    requirePermission(request,"content.edit");
    const part = await request.file({limits:{fileSize:10*1024*1024,files:1,fields:0}});
    if (!part) throw httpError(400,"اختر صورة أو فيديو");
    const bytes = await part.toBuffer();
    const mime = mediaType(bytes);
    if (!mime || mime !== part.mimetype || !Object.hasOwn(mediaExtensions,mime))
      throw httpError(415,"نوع الوسائط غير مدعوم");
    const name = randomUUID()+"."+mediaExtensions[mime];
    const root = mediaRoot();
    await mkdir(root,{recursive:true,mode:0o700});
    await writeFile(resolve(root,name),bytes,{flag:"wx",mode:0o600});
    return {path:"/api/content-media/"+name};
  });
  app.get("/api/content-media/:name", async (request,reply) => {
    const name = request.params.name;
    if (!mediaName.test(name)) throw httpError(404,"الوسائط غير موجودة");
    const path = "/api/content-media/"+name;
    const published = (await db.query(
      "SELECT 1 FROM content_publications p JOIN content_revisions r ON r.id=p.revision_id WHERE r.value=$1 LIMIT 1",[path],
    )).rowCount;
    if (!published && !hasPermission(request.actor,"content.view")) throw httpError(404,"الوسائط غير موجودة");
    const file = resolve(mediaRoot(),name);
    const size = await stat(file).then(info=>info.size).catch(()=>0);
    if (!size) throw httpError(404,"الوسائط غير موجودة");
    const mime = Object.entries(mediaExtensions).find(([,extension])=>name.endsWith("."+extension))[0];
    reply.type(mime).header("Cache-Control","no-store").header("Accept-Ranges","bytes");
    const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range || "");
    if (range) {
      const start = Number(range[1]), end = range[2] ? Math.min(Number(range[2]),size-1) : size-1;
      if (start > end || start >= size) return reply.code(416).header("Content-Range","bytes */"+size).send();
      return reply.code(206).header("Content-Range",`bytes ${start}-${end}/${size}`)
        .header("Content-Length",end-start+1).send(createReadStream(file,{start,end}));
    }
    return reply.header("Content-Length",size).send(createReadStream(file));
  });
  app.get("/api/content", async () => {
    const rows = (await db.query("SELECT p.content_key,r.value FROM content_publications p JOIN content_revisions r ON r.id=p.revision_id")).rows;
    return Object.fromEntries(rows.map(row => [row.content_key,row.value]));
  });
  app.get("/api/backoffice/content/:key", auth, async request => {
    requirePermission(request,"content.view");
    const key = contentKey.parse(request.params.key);
    return (await db.query(
      "SELECT r.*,p.revision_id=r.id AS current FROM content_revisions r LEFT JOIN content_publications p USING(content_key) WHERE r.content_key=$1 ORDER BY r.created_at DESC LIMIT 50",
      [key],
    )).rows;
  });
  app.post("/api/backoffice/content/:key", auth, async request => {
    const key = contentKey.parse(request.params.key);
    if (!contentFields.some(field => field[0] === key)) throw httpError(404,"عنصر المحتوى غير متاح");
    const input = z.discriminatedUnion("action",[
      z.object({action:z.literal("draft"),value:z.string().max(10000)}).strict(),
      z.object({action:z.literal("publish"),id:uuid}).strict(),
    ]).parse(request.body);
    requirePermission(request,input.action === "publish" ? "content.publish" : "content.edit");
    return db.transaction(async client => {
      if (input.action === "draft") {
        if (key === "home.sections.order") {
          const order = input.value.split(",");
          if (order.length !== homeSections.length || new Set(order).size !== order.length ||
              order.some(section=>!homeSections.includes(section))) throw httpError(400,"ترتيب الأقسام غير صالح");
        }
        if (key.endsWith(".visible")) z.enum(["true","false"]).parse(input.value);
        if (key.endsWith(".link")) z.string().regex(/^\/(?![\/\\])[^\\\x00-\x20]*$/).max(400).parse(input.value);
        if (/\.(image|video)$/.test(key) && input.value) {
          const video = key.endsWith(".video");
          const upload = input.value.startsWith("/api/content-media/");
          const pattern = video ? /^\/(?:assets|brand-motion|api\/content-media)\/[a-z0-9_./-]+\.(mp4|webm)$/i :
            /^\/(?:assets|brand-motion|api\/content-media)\/[a-z0-9_./-]+\.(jpg|jpeg|png|webp)$/i;
          if (!pattern.test(input.value) || input.value.includes(".."))
            throw httpError(400,"مسار الوسائط غير صالح");
          if (upload) {
            const name = input.value.slice("/api/content-media/".length);
            if (!mediaName.test(name) || !(await stat(resolve(mediaRoot(),name)).catch(()=>null))?.isFile())
              throw httpError(400,"الملف المرفوع غير موجود");
          }
        }
        const row = (await client.query("INSERT INTO content_revisions(content_key,value,created_by) VALUES($1,$2,$3) RETURNING *",[key,input.value,request.actor.id])).rows[0];
        await audit(client,request,"CONTENT_DRAFT_SAVED","content",key,null,{revision:row.id});
        return row;
      }
      const row = (await client.query("UPDATE content_revisions SET published_at=COALESCE(published_at,now()) WHERE id=$1 AND content_key=$2 RETURNING *",[input.id,key])).rows[0];
      if (!row) throw httpError(404,"النسخة غير موجودة");
      await client.query("INSERT INTO content_publications(content_key,revision_id) VALUES($1,$2) ON CONFLICT(content_key) DO UPDATE SET revision_id=EXCLUDED.revision_id",[key,row.id]);
      await audit(client,request,"CONTENT_PUBLISHED","content",key,null,{revision:row.id});
      return row;
    });
  });
}
