import {z} from 'zod';
import {httpError} from './security.mjs';
export async function reportSummary(c,{period=6,occasion=''}={}){
  period=z.coerce.number().int().min(1).max(24).parse(period);occasion=z.string().max(160).parse(occasion);
  const params=[period,occasion],where="b.created_at>=date_trunc('month',now() AT TIME ZONE 'Asia/Kuwait') AT TIME ZONE 'Asia/Kuwait'-($1::int-1)*interval '1 month' AND ($2='' OR b.data->'occasion'->>'type'=$2)";
  const rows=(await c.query(`SELECT count(*) AS bookings,count(*) FILTER(WHERE (b.data->'quoteSnapshot' IS NOT NULL AND b.data->'quoteSnapshot' NOT IN ('null'::jsonb,'[]'::jsonb)) OR (b.data->'contract' IS NOT NULL AND b.data->'contract'<>'null'::jsonb)) AS quotes,count(*) FILTER(WHERE b.data->'contract' IS NOT NULL AND b.data->'contract'<>'null'::jsonb) AS contracts,count(*) FILTER(WHERE EXISTS(SELECT 1 FROM payment_valuations pv WHERE pv.booking_id=b.id AND pv.status IN ('PAID','REFUND_PENDING','REFUNDED') AND pv.net_minor>0)) AS paid,
    COALESCE(sum(COALESCE((b.data->'financials'->>'total')::numeric*1000,(b.data->'contract'->>'total')::numeric*1000,GREATEST(0,COALESCE(l.subtotal,0)-COALESCE((b.data->>'discount')::numeric*1000,0)))) FILTER(WHERE b.status NOT IN ('CANCELLED','EXPIRED')),0)/1000.0 AS total,
    COALESCE(sum(GREATEST(0,COALESCE(l.subtotal,0)-COALESCE((b.data->>'discount')::numeric*1000,0))-l.cost) FILTER(WHERE l.known AND b.status NOT IN ('CANCELLED','EXPIRED')),0)/1000.0 AS profit
    FROM bookings b LEFT JOIN LATERAL(SELECT sum(price_minor*qty) AS subtotal,sum(cost_minor*qty) AS cost,bool_and(cost_minor IS NOT NULL) AS known FROM order_lines WHERE booking_id=b.id) l ON true WHERE ${where}`,params)).rows[0];
  const actual=(await c.query(`SELECT COALESCE(sum(p.net_minor),0)/1000.0 AS amount FROM payment_valuations p JOIN bookings b ON b.id=p.booking_id WHERE p.status IN ('PAID','REFUND_PENDING','REFUNDED') AND ${where}`,params)).rows[0];
  const months=(await c.query(`SELECT to_char(p.created_at AT TIME ZONE 'Asia/Kuwait','YYYY-MM') AS month,sum(p.net_minor)/1000.0 AS revenue,sum(p.net_minor*p.cost_minor/NULLIF(p.document_total_minor,0))/1000.0 AS cost,sum(p.net_minor*p.document_tax_minor/NULLIF(p.document_total_minor,0))/1000.0 AS tax FROM payment_valuations p JOIN bookings b ON b.id=p.booking_id WHERE p.status IN ('PAID','REFUND_PENDING','REFUNDED') AND p.created_at>=date_trunc('month',now())-($1::int-1)*interval '1 month' AND ($2='' OR b.data->'occasion'->>'type'=$2) GROUP BY month ORDER BY month`,params)).rows;
  return {total:Number(rows.total),profit:Number(rows.profit),actual:Number(actual.amount),count:Number(rows.bookings),quotes:Number(rows.quotes),contracts:Number(rows.contracts),paid:Number(rows.paid),months:months.map(r=>({month:r.month,revenue:Number(r.revenue),cost:Number(r.cost || 0),tax:Number(r.tax || 0)}))};
}
export async function registerReportingRoutes(app){
  const auth={preHandler:app.authenticate};
  app.get('/api/report-summary',auth,req=>{
    if(!['admin','staff'].includes(req.actor.role))throw httpError(403,'غير مخول');
    return app.db.transaction(c=>reportSummary(c,req.query),{readOnly:true});
  });
  app.get('/api/calendar',auth,req=>{
    const month=z.string().regex(/^(?:19|20|21)\d{2}-(0[1-9]|1[0-2])$/).parse(req.query.month),params=[month+'-01'];let scope='true';
    if(req.actor.role==='customer'){params.push(req.actor.id);scope='b.customer_id=$2';}
    else if(req.actor.role==='supplier'){params.push(req.actor.supplierId);scope='EXISTS(SELECT 1 FROM order_lines l WHERE l.booking_id=b.id AND l.supplier_id=$2)';}
    else if(!['admin','staff'].includes(req.actor.role))throw httpError(403,'غير مخول');
    return app.db.query(`SELECT to_char(b.occasion_date,'YYYY-MM-DD') AS day,count(*) AS n FROM bookings b WHERE ${scope} AND b.occasion_date >= $1::date AND b.occasion_date < $1::date+interval '1 month' GROUP BY b.occasion_date`,params).then(r=>Object.fromEntries(r.rows.map(x=>[x.day,Number(x.n)])));
  });
}
