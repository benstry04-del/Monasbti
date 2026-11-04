import test,{after} from 'node:test';
import assert from 'node:assert/strict';
process.env.DATABASE_URL=process.env.TEST_DATABASE_URL || 'pglite:memory';process.env.NODE_ENV='test';
const db=await import('../server/db.mjs');await (await import('../server/migrate.mjs')).migrate();
const {readRecordPage,registerRecordRoutes}=await import('../server/records.mjs');
const {adminAnalytics}=await import('../server/state-projection.mjs');
for(const id of ['records-c1','records-c2'])await db.query("INSERT INTO users(id,email,name,role,password_hash) VALUES($1,$1||'@test.invalid','نفس الاسم','customer','unused')",[id]);
await db.query(`INSERT INTO bookings(id,customer_id,status,occasion_date,data,created_at)
 SELECT 'record-'||n,CASE WHEN n%2=0 THEN 'records-c1' ELSE 'records-c2' END,'REQUESTED','2027-01-01',jsonb_build_object('customer',CASE WHEN n=1 THEN '=FORMULA' ELSE 'نفس الاسم' END,'occasion',jsonb_build_object('type','حفل زفاف','location','حولي','date','2027-01-01'),'lines','[]'::jsonb),now()-n*interval '1 second' FROM generate_series(1,1001) n`);
const owner={id:'owner',role:'admin',mfaVerified:false},customer={id:'records-c1',role:'customer'};
after(()=>db.pool.end());
test('database pagination is bounded, deterministic and filters across the whole dataset',async()=>{
  const first=await readRecordPage(db,owner,'visitor','bookings',{page:1});
  const next=await readRecordPage(db,owner,'visitor','bookings',{page:2});
  assert.equal(first.total,1001);assert.equal(first.items.length,25);assert.equal(first.pages,41);
  assert.equal(new Set([...first.items,...next.items].map(r=>r.id)).size,50);
  assert.equal((await readRecordPage(db,owner,'visitor','bookings',{q:'record-1001'})).items[0].id,'record-1001');
  await assert.rejects(()=>readRecordPage(db,owner,'v','bookings',{pageSize:1000}));
});
test('record pages enforce ownership and role checks before counting or returning rows',async()=>{
  const page=await readRecordPage(db,customer,'v','bookings',{pageSize:100});assert.equal(page.total,500);assert.equal(page.items.length,100);
  assert.ok(page.items.every(r=>Number(r.id.split('-')[1])%2===0));
  await assert.rejects(()=>readRecordPage(db,customer,'v','audit'),e=>e.statusCode===403);
  await assert.rejects(()=>readRecordPage(db,{...owner,role:'staff'},'v','users'),e=>e.statusCode===403);
  await assert.rejects(()=>readRecordPage(db,null,'v','bookings'),e=>e.statusCode===401);
  const people=await readRecordPage(db,owner,'v','customers');assert.equal(people.total,2);assert.notEqual(people.items[0].id,people.items[1].id);
});
test('streamed export includes every matching page and neutralizes spreadsheet formulas',async()=>{
  const app=(await import('fastify')).default();app.decorate('db',db);app.decorate('authenticate',async req=>{req.actor=owner;req.visitorId='v';});await registerRecordRoutes(app);
  try{const response=await app.inject('/api/records/bookings/export');assert.equal(response.statusCode,200);assert.equal(response.body.trim().split('\r\n').length,1002);assert.ok(response.body.includes("'=FORMULA"));}finally{await app.close();}
});
test('reporting views and aggregate queries execute on the migrated schema',async()=>{
  const report=await db.transaction(adminAnalytics);assert.equal(report.newOrders,1001);assert.equal(report.revenue,0);assert.equal(report.profit,0);
});

test('overview and report projections stay bounded while aggregates cover all bookings',async()=>{
  const {projectedState}=await import('../server/state-projection.mjs');
  const {reportSummary}=await import('../server/reporting.mjs');
  const state=await db.transaction(c=>projectedState(c,owner,'v','/admin'));
  assert.ok(state.orders.length<=13);assert.equal(state.analytics.newOrders,1001);
  const customerState=await db.transaction(c=>projectedState(c,customer,'v','/dashboard'));
  assert.equal(customerState.orders.length,1);assert.equal(customerState.orders[0].customerId,customer.id);
  const report=await db.transaction(c=>reportSummary(c,{period:6}));assert.equal(report.count,1001);assert.equal(report.total,0);
  assert.equal((await db.transaction(c=>reportSummary(c,{period:6,occasion:'غير موجود'}))).count,0);
});

test('financial aggregates use verified refunds and preserve tax and cost allocation; calendar stays scoped',async()=>{
 const {reportSummary,registerReportingRoutes}=await import('../server/reporting.mjs');
 const line={id:'report-line',title:'خدمة',category:'ضيافة',price:100,cost:40,qty:1};
 await db.query("INSERT INTO bookings(id,customer_id,status,occasion_date,data) VALUES('financial-report','records-c1','CONFIRMED','2027-02-01',$1)",[{customerId:'records-c1',customer:'عميل',occasion:{type:'اختبار مالي',date:'2027-02-01'},lines:[line],contract:{snapshot:[line],total:110},financials:{total:110,tax:10}}]);
 await db.query("INSERT INTO order_lines(id,booking_id,qty,cost_minor,price_minor) VALUES('report-line','financial-report',1,40000,100000)");
 const payment=(await db.query("INSERT INTO payments(booking_id,user_id,provider,amount_minor,status,idempotency_key) VALUES('financial-report','records-c1','myfatoorah',110000,'PAID','report-payment') RETURNING id")).rows[0];
 await db.query("INSERT INTO refunds(payment_id,amount_minor,status,idempotency_key) VALUES($1,11000,'COMPLETED','report-refund')",[payment.id]);
 const report=await db.transaction(c=>reportSummary(c,{period:6,occasion:'اختبار مالي'}));
 assert.equal(report.total,110);assert.equal(report.profit,60);assert.equal(report.actual,99);assert.equal(report.months[0].cost,36);assert.equal(report.months[0].tax,9);
 const overview=await db.transaction(adminAnalytics);assert.equal(overview.revenue,99);
 const page=await readRecordPage(db,owner,'v','payments');assert.equal(page.summary.REFUNDED,11);assert.equal(page.items[0].refunded,11);
 const app=(await import('fastify')).default();app.decorate('db',db);app.decorate('authenticate',async req=>{req.actor=customer;});await registerReportingRoutes(app);
 try{assert.equal((await app.inject('/api/report-summary')).statusCode,403);const calendar=await app.inject('/api/calendar?month=2027-02');assert.equal(calendar.statusCode,200);assert.deepEqual(calendar.json(),{'2027-02-01':1});}finally{await app.close();}
});
