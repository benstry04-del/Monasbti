import { hasPermission } from "../src/staff-permissions.mjs";
import {z} from 'zod';
import {Readable} from 'node:stream';
import {readState} from './business.mjs';
import {httpError} from './security.mjs';
import {labels,pricing} from '../src/domain.mjs';
import { generateXlsx } from '../src/excel-export.mjs';
const paging=z.object({page:z.coerce.number().int().min(1).max(100000).default(1),pageSize:z.coerce.number().int().min(1).max(100).default(25),q:z.string().max(100).default(''),status:z.string().max(50).default('')}).passthrough();
const privileged=a=>['admin','staff'].includes(a?.role);
const queryContractAccess=(raw,actor)=>raw.kind==="contracts" && hasPermission(actor,"contracts.view");
function plan(kind,actor,raw){
  if(!actor)throw httpError(401,'يلزم تسجيل الدخول');
  if (actor.staffRoleId) {
    const permission = {
      bookings:"orders.view",payments:"payments.view",customers:"customers.view",
      suppliers:"suppliers.view",services:"catalog.view",packages:"catalog.view",audit:"audit.view",
    }[kind];
    const contractAccess = kind === "bookings" && queryContractAccess(raw,actor);
    if (!contractAccess && (!permission || !hasPermission(actor,permission))) throw httpError(403,"غير مخول");
  }
  const query=paging.parse(raw),params=[],where=[];const bind=v=>{params.push(v);return '$'+params.length;};
  let from,select,search,order='t.created_at DESC,t.id';
  if(kind==='bookings'){
    from='bookings t';select='t.id';search="t.id || ' ' || COALESCE(t.data->>'customer','')";
    if(actor.role==='customer')where.push('t.customer_id='+bind(actor.id));
    else if(actor.role==='supplier')where.push('EXISTS(SELECT 1 FROM order_lines l WHERE l.booking_id=t.id AND l.supplier_id='+bind(actor.supplierId)+')');
    else if(!privileged(actor))throw httpError(403,'غير مخول');
    if(query.kind==='execution')where.push("t.status IN ('CONFIRMED','PREPARATION','IN_PROGRESS','COMPLETED')");
    if(query.response && actor.role==='supplier')where.push("EXISTS(SELECT 1 FROM order_lines l WHERE l.booking_id=t.id AND l.supplier_id="+bind(actor.supplierId)+" AND l.data->>'response'="+bind(z.enum(['WAITING','CONFIRMED_SUPPLIER','REJECTED']).parse(query.response))+')');
    if(query.kind==='contracts')where.push("t.data->'contract' IS NOT NULL AND t.data->'contract'<>'null'::jsonb");
    if(query.kind==='approvals')where.push("t.status IN ('NEEDS_OWNER_APPROVAL','CONTRACT_PENDING','QUOTE_READY','SUPPLIER_UNAVAILABLE')");
    for(const [field,path]of [['occasion',"t.data->'occasion'->>'type'"],['area',"t.data->'occasion'->>'location'"]])if(query[field])where.push(path+'='+bind(z.string().max(160).parse(query[field])));
    if(query.date)where.push('t.occasion_date='+bind(z.iso.date().parse(query.date))+'::date');
    if(query.max)where.push("COALESCE((t.data->'financials'->>'total')::numeric,(t.data->'contract'->>'total')::numeric,(SELECT sum(l.price_minor*l.qty)/1000.0 FROM order_lines l WHERE l.booking_id=t.id),0)<="+bind(z.coerce.number().min(0).max(1000000000).parse(query.max)));
  }else if(kind==='payments'){
    if(!privileged(actor) && actor.role!=='customer')throw httpError(403,'غير مخول');
    from='payments t JOIN users u ON u.id=t.user_id';select="t.*,u.name AS customer_name,COALESCE((SELECT sum(r.amount_minor) FROM refunds r WHERE r.payment_id=t.id AND r.status='COMPLETED'),0) AS refunded_minor";search="t.id::text || ' ' || t.booking_id || ' ' || u.name";
    if(actor.role==='customer')where.push('t.user_id='+bind(actor.id));
  }else if(kind==='users' || kind==='customers'){
    if(kind==='users'?(actor.role!=='admin'):!privileged(actor))throw httpError(403,'غير مخول');
    from='users t';search="t.name || ' ' || t.email || ' ' || t.mobile";
    select='t.id,t.email,t.name,t.mobile,t.role,t.active,t.supplier_id,t.mfa_secret IS NOT NULL AS mfa';
    if(kind==='users') where.push("t.role<>'supplier'");
    if(kind==='customers'){
      where.push("t.role='customer'");
      select+=`,(SELECT count(*) FROM bookings b WHERE b.customer_id=t.id) AS booking_count,
        (SELECT COALESCE(sum(p.net_minor),0)/1000.0 FROM payment_valuations p WHERE p.user_id=t.id AND p.status IN ('PAID','REFUND_PENDING','REFUNDED')) AS paid_total,
        (SELECT COALESCE(jsonb_agg(x),'[]') FROM (SELECT b.id,b.status,b.data->'occasion' AS occasion,b.data->>'customer' AS customer,COALESCE((b.data->'financials'->>'total')::numeric,(b.data->'contract'->>'total')::numeric,0) AS total FROM bookings b WHERE b.customer_id=t.id ORDER BY b.created_at DESC,b.id LIMIT 5) x) AS recent_bookings`;
    }else if(query.role)where.push('t.role='+bind(z.enum(['customer','supplier','staff','admin']).parse(query.role)));
  }else if(kind==='audit'){
    if(!privileged(actor))throw httpError(403,'غير مخول');from='audit_log t LEFT JOIN users u ON u.id=t.actor_id';
    select='t.*,u.name AS actor_name';search="t.action || ' ' || t.resource_id || ' ' || COALESCE(u.name,'')";
  }else if(kind==='suppliers'){
    if(!privileged(actor))throw httpError(403,'غير مخول');from='suppliers t';search="t.name || ' ' || COALESCE(t.data->>'area','')";
    select=`t.id,t.name,t.active,t.data,
      (SELECT COALESCE(round(100.0*count(*) FILTER(WHERE data->>'response'='CONFIRMED_SUPPLIER')/NULLIF(count(*),0)),0) FROM order_lines WHERE supplier_id=t.id) AS response_percent,
      (SELECT COALESCE(round(100.0*count(*) FILTER(WHERE data->>'execution'='Completed')/NULLIF(count(*),0)),0) FROM order_lines WHERE supplier_id=t.id) AS reliability_percent,
      (SELECT COALESCE(avg((b.data->'feedback'->>'rating')::int),0) FROM bookings b WHERE b.status='COMPLETED' AND b.data->'feedback'->>'rating' ~ '^[1-5]$' AND EXISTS(SELECT 1 FROM order_lines l WHERE l.booking_id=b.id AND l.supplier_id=t.id)) AS actual_rating,
      (SELECT count(DISTINCT l.booking_id) FROM order_lines l JOIN bookings b ON b.id=l.booking_id WHERE l.supplier_id=t.id AND b.status NOT IN ('COMPLETED','CANCELLED','EXPIRED')) AS open_order_count,
      GREATEST(0,COALESCE((SELECT sum(l.cost_minor*l.qty) FROM order_lines l JOIN bookings b ON b.id=l.booking_id WHERE l.supplier_id=t.id AND b.status NOT IN ('CANCELLED','EXPIRED')),0)-COALESCE((SELECT sum(s.amount_minor) FROM supplier_settlements s WHERE s.supplier_id=t.id AND s.status='SETTLED'),0))/1000.0 AS cost_exposure`;
  }else if(kind==='services' || kind==='packages'){
    if(!privileged(actor))throw httpError(403,'غير مخول');
    from=kind==='services'?'catalog_services t':'packages t';order=kind==='services'?'t.created_at DESC,t.id':'t.id';
    search=kind==='services'?"t.name || ' ' || COALESCE(t.data->>'category','')":"t.title";select='t.*';
  }else if(kind==='tickets'){
    from='tickets t';select='t.*';search="t.id || ' ' || COALESCE(t.data->>'subject','')";
    if(!privileged(actor))where.push('t.user_id='+bind(actor.id));
  }else throw httpError(404,'السجل غير موجود');
  if(query.id)where.push('t.id::text='+bind(z.string().max(150).parse(query.id)));
  if(query.q)where.push('('+search+') ILIKE '+bind('%'+query.q+'%'));
  if(query.status && ['bookings','payments'].includes(kind))where.push('t.status='+bind(query.status));
  return {query,params,from,select,where:where.length?where.join(' AND '):'true',order};
}
export async function readRecordPage(db,actor,visitorId,kind,raw={}){
  const p=plan(kind,actor,raw);
  return db.transaction(async c=>{
    const total=Number((await c.query(`SELECT count(*) FROM ${p.from} WHERE ${p.where}`,p.params)).rows[0].count);
    const found=(await c.query(`SELECT ${p.select} FROM ${p.from} WHERE ${p.where} ORDER BY ${p.order} LIMIT $${p.params.length+1} OFFSET $${p.params.length+2}`,[...p.params,p.query.pageSize,(p.query.page-1)*p.query.pageSize])).rows;
    let items;
    if(kind==='bookings')items=(await readState(c,actor,visitorId,false,null,{light:true,bookingIds:found.map(r=>r.id)})).orders;
    else if(kind==='payments')items=found.map(r=>({...(actor.staffRoleId?{}:r.data),id:r.id,orderId:r.booking_id,customer:r.customer_name,amount:Number(r.amount_minor)/1000,refunded:Number(r.refunded_minor)/1000,status:r.status,milestone:r.milestone,method:r.data.method || r.provider,at:r.created_at,receipt:r.data.receipt || r.provider_reference || r.id}));
    else if(kind==='audit')items=found.map(r=>({id:r.id,actor:r.actor_name || r.actor_id,action:r.action,entity:r.resource_id,before:r.before_data,after:r.after_data,at:r.created_at}));
    else if(kind==='users' || kind==='customers')items=found.map(r=>({...r,supplierId:r.supplier_id,bookingCount:Number(r.booking_count || 0),paidTotal:Number(r.paid_total || 0),recentBookings:r.recent_bookings || []}));
    else if(kind==='suppliers')items=found.map(r=>({...r.data,id:r.id,name:r.name,active:r.active,response:Number(r.response_percent),reliability:Number(r.reliability_percent),rating:Number(r.actual_rating),openOrderCount:Number(r.open_order_count),costExposure:Number(r.cost_exposure)}));
    else if(kind==='services')items=found.map(r=>({...r.data,id:r.id,available:r.active,capacity:r.capacity}));
    else if(kind==='packages')items=found.map(r=>({...r.data,id:r.id,active:r.active}));
    else items=found.map(r=>({...r.data,id:r.id,userId:r.user_id,at:r.created_at}));
    if (kind === "payments" && p.query.id && items.length) {
      const refunds = (await c.query(
        "SELECT id,amount_minor,status,created_at,updated_at FROM refunds WHERE payment_id=$1 ORDER BY created_at DESC",
        [items[0].id],
      )).rows;
      items[0].refunds = refunds.map(({amount_minor,...refund})=>({...refund,amount:Number(amount_minor)/1000}));
    }
    if (actor.staffRoleId && kind === "audit" && ["costs.view","profit.view","discounts.view"].some(permission=>!hasPermission(actor,permission)))
      items = items.map(({before,after,...item})=>item);
    if (actor.staffRoleId && !hasPermission(actor,"costs.view")) {
      if (kind === "services" || kind === "packages") items = items.map(({cost,markup,...item}) => item);
      if (kind === "suppliers") items = items.map(({costExposure,payoutRecipientId,...item}) => item);
    }
    let counts;
    if(kind==='bookings')counts=Object.fromEntries((await c.query(`SELECT t.status,count(*) AS n FROM ${p.from} WHERE ${p.where} GROUP BY t.status`,p.params)).rows.map(r=>[r.status,Number(r.n)]));
    let summary;
    if(kind==='payments'){
      const scope=actor.role==='customer'?'WHERE user_id=$1':'';
      const r=(await c.query(`SELECT COALESCE(sum(net_minor) FILTER(WHERE status IN ('PAID','REFUND_PENDING','REFUNDED')),0)/1000.0 AS paid,COALESCE(sum(amount_minor) FILTER(WHERE status IN ('CREATED','PENDING')),0)/1000.0 AS pending,COALESCE(sum(amount_minor-net_minor),0)/1000.0 AS refunded FROM (SELECT p.*,GREATEST(0,p.amount_minor-COALESCE((SELECT sum(r.amount_minor) FROM refunds r WHERE r.payment_id=p.id AND r.status='COMPLETED'),0)) AS net_minor FROM payments p ${scope}) v`,actor.role==='customer'?[actor.id]:[])).rows[0];
      summary={PAID:Number(r.paid),PENDING:Number(r.pending),REFUNDED:Number(r.refunded)};
    }
    return {items,total,summary,counts,page:p.query.page,pageSize:p.query.pageSize,pages:Math.ceil(total/p.query.pageSize)};
  },{readOnly:true});
}
const csv=value=>{const text=String(value ?? ''),safe=/^[=+\-@\t\r]/.test(text)?"'"+text:text;return '"'+safe.replaceAll('"','""')+'"';};
export async function registerRecordRoutes(app){
  const db=app.db,auth={preHandler:app.authenticate};
  app.get('/api/records/:kind',auth,req=>readRecordPage(db,req.actor,req.visitorId,req.params.kind,req.query));
  app.get('/api/records/:kind/export',auth,async(req,reply)=>{
    plan(req.params.kind,req.actor,req.query);
    const permission = {bookings:"orders.export",payments:"payments.export",audit:"audit.export"}[req.params.kind];
    if (req.actor.staffRoleId && !hasPermission(req.actor,permission)) throw httpError(403,"غير مخول");
    if(!['bookings','payments','audit'].includes(req.params.kind))throw httpError(400,'نوع التصدير غير متاح');
    if (req.query.format === "xlsx") {
      const items = [];
      const client = await db.pool.connect();
      let success = false;
      try {
        await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
        const snapshot = { transaction: fn => fn(client) };
        for (let page = 1; page <= 100; page++) {
          const batch = await readRecordPage(snapshot, req.actor, req.visitorId, req.params.kind, { ...req.query, page, pageSize: 100 });
          items.push(...batch.items);
          if (page >= batch.pages) break;
        }
        success = true;
      } finally {
        await client.query(success ? "COMMIT" : "ROLLBACK").catch(() => {});
        client.release();
      }
      const kind = req.params.kind;
      let sheet;
      if (kind === "bookings") {
        let sum = 0;
        const rows = items.map(row => {
          const amount = Number(row.financials?.total ?? row.contract?.total ?? row.amount ?? pricing(row.lines || [], row.discount || 0).total ?? 0);
          sum += amount;
          return [
            row.id,
            row.customer || "",
            row.occasion?.date || String(row.at || "").slice(0, 10),
            row.eventType || row.occasion?.type || "",
            amount,
            { code: row.status, label: labels[row.status] || row.status },
          ];
        });
        sheet = {
          name: "سجل الطلبات",
          title: "هَبّ السعد — سجل الطلبات والحجوزات",
          subtitle: `عدد السجلات: ${items.length}`,
          columns: [
            { header: "المرجع", type: "code", width: 18 },
            { header: "العميل", type: "text", width: 22 },
            { header: "التاريخ", type: "date", width: 15 },
            { header: "نوع المناسبة", type: "text", width: 18 },
            { header: "المبلغ (د.ك)", type: "currency", width: 18 },
            { header: "الحالة", type: "status", width: 20 },
          ],
          rows,
          totals: rows.length ? ["الإجمالي", `${rows.length} طلب`, "", "", sum, ""] : null,
        };
      } else if (kind === "payments") {
        let sumAmount = 0;
        let sumRefunded = 0;
        const rows = items.map(row => {
          const amount = Number(row.amount || 0);
          const refunded = Number(row.refunded || 0);
          sumAmount += amount;
          sumRefunded += refunded;
          return [
            row.id,
            row.orderId || "",
            row.customer || "",
            row.method || "",
            row.receipt || "",
            String(row.at || "").slice(0, 10),
            amount,
            refunded,
            { code: row.status, label: labels[row.status] || row.status },
          ];
        });
        sheet = {
          name: "المدفوعات",
          title: "هَبّ السعد — سجل المدفوعات والتحصيل",
          subtitle: `عدد العمليات: ${items.length}`,
          columns: [
            { header: "رقم العملية", type: "code", width: 18 },
            { header: "رقم الطلب", type: "code", width: 16 },
            { header: "العميل", type: "text", width: 20 },
            { header: "وسيلة الدفع", type: "text", width: 15 },
            { header: "الإيصال / المرجع", type: "code", width: 20 },
            { header: "التاريخ", type: "date", width: 15 },
            { header: "المبلغ (د.ك)", type: "currency", width: 16 },
            { header: "المسترد (د.ك)", type: "currency", width: 16 },
            { header: "الحالة", type: "status", width: 18 },
          ],
          rows,
          totals: rows.length ? ["الإجمالي", `${rows.length} دفعة`, "", "", "", "", sumAmount, sumRefunded, ""] : null,
        };
      } else {
        sheet = {
          name: "سجل التدقيق",
          title: "هَبّ السعد — سجل التدقيق والعمليات",
          subtitle: `عدد السجلات: ${items.length}`,
          columns: [
            { header: "المعرف", type: "code", width: 18 },
            { header: "التوقيت", type: "date", width: 20 },
            { header: "المنفذ", type: "text", width: 20 },
            { header: "الإجراء", type: "code", width: 24 },
            { header: "العنصر المستهدف", type: "code", width: 22 },
            { header: "التفاصيل", type: "text", width: 34 },
          ],
          rows: items.map(row => [
            row.id,
            String(row.at || "").slice(0, 19).replace("T", " "),
            row.actor || "",
            row.action || "",
            row.entity || "",
            row.after ? JSON.stringify(row.after).slice(0, 240) : "",
          ]),
        };
      }
      const bytes = generateXlsx({ sheets: [sheet] });
      reply
        .header("Content-Disposition", `attachment; filename="${kind}.xlsx"`)
        .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      return reply.send(Buffer.from(bytes));
    }
    const json=req.params.kind==='audit';
    async function* output(){
      const client=await db.pool.connect();let success=false;
      try{
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const snapshot={transaction:fn=>fn(client)};
      yield json?'[':'\uFEFF'+['المرجع','العميل','التاريخ','المبلغ','الحالة'].map(csv).join(',')+'\r\n';let first=true;
      for(let page=1;page<=100000;page++){
        const batch=await readRecordPage(snapshot,req.actor,req.visitorId,req.params.kind,{...req.query,page,pageSize:100});
        for(const row of batch.items){
          if(json){yield(first?'':',')+JSON.stringify(row);first=false;}
          else yield [row.id,row.customer,row.occasion?.date || row.at,row.financials?.total ?? row.contract?.total ?? row.amount ?? pricing(row.lines || [],row.discount || 0).total,labels[row.status] || row.status].map(csv).join(',')+'\r\n';
        }
        if(page>=batch.pages)break;
      }
      if(json)yield ']';
      success=true;
      }finally{await client.query(success?'COMMIT':'ROLLBACK').catch(()=>{});client.release();}
    }
    reply.header('Content-Disposition',`attachment; filename="${req.params.kind}.${json?'json':'csv'}"`).type(json?'application/json':'text/csv; charset=utf-8');return reply.send(Readable.from(output()));
  });
}
