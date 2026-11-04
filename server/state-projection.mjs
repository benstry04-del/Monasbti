import {readState} from './business.mjs';
const minimal=new Set(['orders','quotes','contracts','approvals','payments','users','customers','audit','suppliers','catalog','packages','integrations','deliveries','settlements','settings','reports','events']);
export async function stateProjection(c,actor,route){
  if(typeof route!=='string' || route.length>300)return {};
  const path=route.split('?')[0];
  const detail=path.match(/^\/(?:admin\/orders|bookings|quote|contract|checkout)\/([^/]+)$/);
  if(detail){let id;try{id=decodeURIComponent(detail[1]);}catch{return {light:true,bookingIds:[]};}return {light:true,catalog:true,payments:true,bookingIds:[id]};}
  if(actor?.role==='customer' && path==='/dashboard'){
    const row=(await c.query("SELECT id FROM bookings WHERE customer_id=$1 ORDER BY (id=COALESCE((SELECT data->>'activeOrder' FROM workspaces WHERE id=$1),'')) DESC,created_at DESC,id LIMIT 1",[actor.id])).rows[0];
    return {light:true,catalog:true,payments:true,bookingIds:row?[row.id]:[]};
  }
  if(actor?.role==='supplier' && path.startsWith('/supplier'))return {light:true,catalog:true,bookingIds:path.split('/')[3]?[path.split('/')[3]]:[]};
  if(path.startsWith('/auth/'))return {light:true,bookingIds:[]};
  if(['admin','staff'].includes(actor?.role)){
    if(path==='/admin'){
      const ids=(await c.query(`SELECT id FROM (SELECT id FROM bookings ORDER BY created_at DESC,id LIMIT 5) a UNION SELECT id FROM (SELECT id FROM bookings WHERE data->'contract' IS NOT NULL AND data->'contract'<>'null'::jsonb ORDER BY created_at DESC,id LIMIT 5) b UNION SELECT id FROM (SELECT id FROM bookings WHERE occasion_date>=current_date AND status NOT IN ('CANCELLED','EXPIRED') ORDER BY occasion_date,id LIMIT 3) c`)).rows.map(r=>r.id);
      return {light:true,catalog:true,bookingIds:ids,overview:true};
    }
    const page=path.split('/')[2];if(path.startsWith('/admin/') && minimal.has(page))return {light:true,bookingIds:[],catalog:['catalog','packages','suppliers','users','reports'].includes(page)};
  }
  return {};
}
export async function adminAnalytics(c){
  const counts=(await c.query(`SELECT count(*) FILTER(WHERE status IN ('REQUESTED','INTERNAL_REVIEW','SUPPLIER_CONFIRMATION')) AS new_orders,
    count(*) FILTER(WHERE status IN ('CONTRACT_PENDING','NEEDS_OWNER_APPROVAL','CONTRACT_APPROVED')) AS pending_contracts,
    count(*) FILTER(WHERE status='NEEDS_OWNER_APPROVAL') AS owner_approvals,
    COALESCE(sum(COALESCE((data->'contract'->>'total')::numeric,0)),0) AS contract_total,
    COALESCE(sum(GREATEST(0,COALESCE((data->'contract'->>'total')::numeric,(data->'financials'->>'total')::numeric,0)-COALESCE((data->>'paid')::numeric,0))) FILTER(WHERE status NOT IN ('CANCELLED','EXPIRED')),0) AS outstanding
    FROM bookings`)).rows[0];
  const money=(await c.query(`SELECT COALESCE((SELECT sum(net_minor) FROM payment_valuations WHERE status IN ('PAID','REFUND_PENDING','REFUNDED')),0)/1000.0 AS revenue,COALESCE((SELECT sum(amount_minor) FROM payments WHERE status IN ('CREATED','PENDING')),0)/1000.0 AS pending`)).rows[0];
  const profit=(await c.query(`SELECT COALESCE(sum(GREATEST(0,l.price-COALESCE(round((b.data->>'discount')::numeric*1000),0))-l.cost) FILTER(WHERE l.known),0)/1000.0 AS profit
    FROM bookings b JOIN (SELECT booking_id,sum(price_minor*qty) AS price,sum(cost_minor*qty) AS cost,bool_and(cost_minor IS NOT NULL) AS known FROM order_lines GROUP BY booking_id) l ON l.booking_id=b.id WHERE b.status NOT IN ('CANCELLED','EXPIRED')`)).rows[0];
  const months=(await c.query(`SELECT to_char(created_at AT TIME ZONE 'Asia/Kuwait','YYYY-MM') AS month,
    sum(net_minor)/1000.0 AS revenue,
    sum(net_minor*cost_minor/NULLIF(document_total_minor,0))/1000.0 AS cost,
    sum(net_minor*document_tax_minor/NULLIF(document_total_minor,0))/1000.0 AS tax
    FROM payment_valuations WHERE status IN ('PAID','REFUND_PENDING','REFUNDED') AND created_at>=date_trunc('month',now())-interval '5 months' GROUP BY month ORDER BY month`)).rows;
  const sources=(await c.query(`SELECT COALESCE(l->>'category','أخرى') AS category,
    sum(p.net_minor*round((l->>'price')::numeric*1000)*(l->>'qty')::int/NULLIF(p.subtotal_minor,0))/1000.0 AS amount
    FROM payment_valuations p CROSS JOIN LATERAL jsonb_array_elements(p.lines) l
    WHERE p.status IN ('PAID','REFUND_PENDING','REFUNDED') GROUP BY category ORDER BY amount DESC`)).rows;
  return {newOrders:Number(counts.new_orders),pendingContracts:Number(counts.pending_contracts),ownerApprovals:Number(counts.owner_approvals),contractTotal:Number(counts.contract_total),outstanding:Number(counts.outstanding),revenue:Number(money.revenue),pendingPayments:Number(money.pending),profit:Number(profit.profit),months:months.map(r=>({month:r.month,revenue:Number(r.revenue),cost:Number(r.cost || 0),tax:Number(r.tax || 0)})),sources:sources.map(r=>[r.category,Number(r.amount)])};
}
export async function projectedState(c,actor,visitorId,route){
  const projection=await stateProjection(c,actor,route),state=await readState(c,actor,visitorId,false,null,projection);
  if(['admin','staff'].includes(actor?.role)){
    if(projection.overview)state.analytics=await adminAnalytics(c);
    state.counters={ownerApprovals:Number((await c.query("SELECT count(*) FROM bookings WHERE status='NEEDS_OWNER_APPROVAL'")).rows[0].count)};
  }
  return state;
}
