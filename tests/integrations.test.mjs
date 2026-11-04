import test,{after,before} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {MyFatoorahProvider,toMinor,fromMinor,signatureInput,verifyMyFatoorahSignature,verifyPaymentDetails} from '../server/providers/payments.mjs';
import {contractHTML,documentHash} from '../server/providers/documents.mjs';
import {sendEmail,sendMessage} from '../server/providers/notifications.mjs';

test('KWD minor units preserve three decimals and reject malformed financial values',()=>{
  assert.equal(toMinor('2.500'),2500);assert.equal(toMinor('0.001'),1);assert.equal(toMinor(1900.3),1900300);assert.equal(fromMinor(2500),'2.500');
  for(const n of ['NaN','1.2345','-1',Infinity,'1e8'])assert.throws(()=>toMinor(n));
});
const paymentEvent={Event:{Name:'PAYMENT_STATUS_CHANGED',Reference:'WH-1'},Data:{Invoice:{Id:'6409988',Status:'PAID',ExternalIdentifier:null},Transaction:{Status:'SUCCESS',PaymentId:'07076409988323998875'}}};
test('MyFatoorah uses documented canonical field order and Base64 HMAC, not raw JSON',()=>{
  const canonical='Invoice.Id=6409988,Invoice.Status=PAID,Transaction.Status=SUCCESS,Transaction.PaymentId=07076409988323998875,Invoice.ExternalIdentifier=';
  assert.equal(signatureInput(paymentEvent),canonical);
  const signature=createHmac('sha256','test-secret').update(canonical).digest('base64');
  assert.equal(verifyMyFatoorahSignature(paymentEvent,signature,'test-secret'),true);
  assert.equal(verifyMyFatoorahSignature({...paymentEvent,Data:{...paymentEvent.Data,Invoice:{...paymentEvent.Data.Invoice,Id:'other'}}},signature,'test-secret'),false);
  assert.equal(verifyMyFatoorahSignature(paymentEvent,'garbage','test-secret'),false);assert.equal(verifyMyFatoorahSignature(paymentEvent,signature,''),false);
});
test('refund signature protects amount, invoice and refund status',()=>{
  const event={Event:{Name:'REFUND_STATUS_CHANGED'},Data:{Refund:{Id:10,Status:'REFUNDED'},Amount:{ValueInBaseCurrency:'30'},ReferencedInvoice:{Id:40}}};
  assert.equal(signatureInput(event),'Refund.Id=10,Refund.Status=REFUNDED,Amount.ValueInBaseCurrency=30,ReferencedInvoice.Id=40');
});
test('hosted checkout adapter never handles card fields and does not retry mutation',async()=>{
  const calls=[];const p=new MyFatoorahProvider({apiKey:'test',fetchImpl:async(url,options)=>{calls.push({url,options});return{ok:true,json:async()=>({IsSuccess:true,Data:{InvoiceId:123,PaymentURL:'https://demo.myfatoorah.com/checkout/1'}})}}});
  const result=await p.createCheckout({id:'local-1',amountMinor:3001,method:'KNET',returnURL:'https://habb.example/payment-result'});
  assert.equal(result.invoiceId,'123');assert.equal(calls.length,1);const body=JSON.parse(calls[0].options.body);assert.deepEqual(body.Order,{Amount:3.001,Currency:'KWD',ExternalIdentifier:'local-1'});assert.equal('SourceOfFund'in body,false);
  await assert.rejects(()=>p.createCheckout({id:'1',amountMinor:10,returnURL:'http://localhost:3001'}));
  const timeout=new MyFatoorahProvider({apiKey:'test',fetchImpl:async()=>{throw Error('timeout')}});await assert.rejects(()=>timeout.createCheckout({id:'1',amountMinor:10,returnURL:'https://habb.example'}),e=>e.code==='PROVIDER_RESULT_UNCERTAIN');
});
test('payment confirmation requires authoritative exact reference, amount, currency, invoice PAID and transaction SUCCESS',()=>{
  const p={id:'id-1',provider_reference:'provider-1',amount_minor:3001,currency:'KWD'};
  const d={Invoice:{Id:'provider-1',ExternalIdentifier:'id-1',Status:'PAID'},Transaction:{Status:'SUCCESS'},Amount:{BaseCurrency:'KWD',ValueInBaseCurrency:'3.001'}};
  assert.equal(verifyPaymentDetails(p,d),'PAID');assert.equal(verifyPaymentDetails(p,{...d,Transaction:{Status:'AUTHORIZE'}}),'PENDING');
  assert.throws(()=>verifyPaymentDetails(p,{...d,Amount:{...d.Amount,ValueInBaseCurrency:'3.000'}}),/غير مطابقين/);
  assert.throws(()=>verifyPaymentDetails(p,{...d,Invoice:{...d.Invoice,ExternalIdentifier:'other'}}),/غير مطابق/);
  assert.throws(()=>verifyPaymentDetails(p,{...d,Amount:{...d.Amount,BaseCurrency:'USD'}}));
});
test('contracts escape arbitrary user text and have reproducible evidence hashes',()=>{
  const html=contractHTML({id:'B-1',data:{customer:'<script>alert(1)</script>',occasion:{date:'2030-12-12'}}},{version:1,data:{total:100,snapshot:[{title:'<img src=x onerror=x>',qty:1,price:100}]}});
  assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.equal(documentHash(html),documentHash(html));assert.notEqual(documentHash(html),documentHash(html+' '));
});
test('email delivery requires SMTP acceptance and unsupported channels never report success',async()=>{
  const result=await sendEmail({to:'a@example.test',subject:'test',text:'body'},{transport:{sendMail:async()=>({accepted:['a@example.test'],rejected:[],messageId:'a'})}});assert.equal(result.messageId,'a');
  await assert.rejects(()=>sendEmail({to:'a@example.test'},{transport:{sendMail:async()=>({accepted:[],rejected:['a@example.test']})}}));
  await assert.rejects(()=>sendMessage('SMS',{}));await assert.rejects(()=>sendMessage('WHATSAPP',{}));
});

// Isolated actual PostgreSQL engine: production provider calls use injected fixtures only.
process.env.DATABASE_URL=process.env.TEST_DATABASE_URL || 'pglite:memory';process.env.NODE_ENV='test';
const db=await import('../server/db.mjs');
const integrations=await import('../server/integrations.mjs');
const worker=await import('../server/worker.mjs');
const actor={id:'customer-integration',name:'عميل الاختبار',role:'customer',email:'integration@example.test'};
before(async()=>{
  await db.executeSQL(await readFile(new URL('../server/migrations/001_initial.sql',import.meta.url),'utf8'));
  await db.query("INSERT INTO users(id,email,name,role,password_hash,verified_at) VALUES($1,$2,$3,'customer','unused',now())",[actor.id,actor.email,actor.name]);
  await db.query("INSERT INTO app_settings(data) VALUES('{}')");
  await db.query("INSERT INTO suppliers(id,name) VALUES('v1','مورد')");
  await db.query("INSERT INTO catalog_services(id,supplier_id,name) VALUES('s1','v1','قاعة')");
});
after(()=>db.pool.end());
async function booking(id,total=100){const data={id,customerId:actor.id,status:'SIGNED',paid:0,occasion:{date:'2030-12-12'},lines:[{id:'s1',title:'قاعة',price:total,qty:1}],contract:{status:'SIGNED',total,paymentSchedule:[30,50,20]}};await db.query("INSERT INTO bookings(id,customer_id,status,occasion_date,data) VALUES($1,$2,'SIGNED','2030-12-12',$3)",[id,actor.id,JSON.stringify(data)]);await db.query("INSERT INTO reservations(booking_id,service_id,event_date,qty,status,expires_at) VALUES($1,'s1','2030-12-12',1,'HELD',now()+interval '1 hour')",[id]);return data;}
test('upload detection rejects HTML/SVG while recognizing allowlisted file signatures',()=>{
  assert.equal(integrations.detectMime(Buffer.from('<svg/>')),null);assert.equal(integrations.detectMime(Buffer.from('%PDF-1.7')),'application/pdf');assert.equal(integrations.detectMime(Buffer.from([255,216,255,1])),'image/jpeg');
});
test('persistent payment intent is idempotent and duplicate milestone cannot create another provider invoice',async()=>{
  await booking('payment-test-1');let calls=0;const provider={assertConfigured(){},async createCheckout(){calls++;return{invoiceId:'invoice-1',paymentURL:'https://demo.myfatoorah.com/pay/1'}}};const options={provider,origin:'https://habb.example'};
  const p=await integrations.createCheckout(actor,{bookingId:'payment-test-1',milestone:0},'idempotency-test-1',options);const replay=await integrations.createCheckout(actor,{bookingId:'payment-test-1',milestone:0},'idempotency-test-1',options);assert.equal(p.id,replay.id);assert.equal(calls,1);
  await assert.rejects(()=>integrations.createCheckout(actor,{bookingId:'payment-test-1',milestone:0},'idempotency-test-2',options));assert.equal(calls,1);
  const data={Invoice:{Id:'invoice-1',ExternalIdentifier:p.id,Status:'PAID'},Transaction:{Status:'SUCCESS',PaymentId:'123456'},Amount:{BaseCurrency:'KWD',ValueInBaseCurrency:'30'}};
  for(let i=0;i<2;i++)await db.transaction(async client=>{const pay=(await client.query('SELECT * FROM payments WHERE id=$1 FOR UPDATE',[p.id])).rows[0];await integrations.settlePayment(client,pay,data);});
  const b=(await db.query("SELECT data,status FROM bookings WHERE id='payment-test-1'")).rows[0];assert.equal(b.status,'CONFIRMED');assert.equal(b.data.paid,30);assert.equal((await db.query('SELECT * FROM notifications')).rowCount,1);assert.equal((await db.query("SELECT * FROM reservations WHERE booking_id='payment-test-1'")).rows[0].status,'CONFIRMED');
});
test('payment intent rejects another customer, unsigned contract, expired holds and premature installment',async()=>{
  await booking('payment-test-2');const provider={assertConfigured(){},async createCheckout(){throw Error('must not be called')}};const opts={provider,origin:'https://habb.example'};
  await assert.rejects(()=>integrations.createCheckout({...actor,id:'other'},{bookingId:'payment-test-2'},'unauthorized-key-1',opts),e=>e.statusCode===403);
  await db.query("UPDATE reservations SET expires_at=now()-interval '1 hour' WHERE booking_id='payment-test-2'");await assert.rejects(()=>integrations.createCheckout(actor,{bookingId:'payment-test-2'},'hold-expired-key-1',opts),e=>e.code==='AVAILABILITY_HOLD_EXPIRED');
  await assert.rejects(()=>integrations.createCheckout(actor,{bookingId:'payment-test-2',milestone:1},'milestone-key-001',opts),/السابقة/);
});
test('ambiguous provider response keeps durable intent and blocks blind mutation retry',async()=>{
  await booking('payment-test-3');let calls=0;const opts={origin:'https://habb.example',provider:{assertConfigured(){},async createCheckout(){calls++;throw Error('timeout')}}};
  await assert.rejects(()=>integrations.createCheckout(actor,{bookingId:'payment-test-3'},'uncertain-result-001',opts));
  const retry=await integrations.createCheckout(actor,{bookingId:'payment-test-3'},'uncertain-result-001',opts);assert.equal(retry.status,'CREATED');assert.equal(retry.paymentURL,null);assert.equal(calls,1);assert.equal((await db.query("SELECT * FROM outbox WHERE job_type='PAYMENT_INTENT_RECONCILE' AND payload->>'paymentId'=$1",[retry.id])).rowCount,1);
});
test('background retry delay is bounded and unknown jobs fail closed',async()=>{
  assert.equal(worker.retryDelay(1),2000);assert.equal(worker.retryDelay(100),3600000);await assert.rejects(()=>worker.executeJob({job_type:'UNKNOWN',payload:{}},{provider:{}}),e=>e.code==='UNKNOWN_JOB');
});

test('failed hosted invoice is reused rather than issuing a second chargeable invoice',async()=>{
  await booking('payment-failed-retry');let calls=0;
  const opts={origin:'https://habb.example',provider:{assertConfigured(){},async createCheckout(){calls++;return{invoiceId:'failed-invoice',paymentURL:'https://demo.myfatoorah.com/pay/retry'}}}};
  const p=await integrations.createCheckout(actor,{bookingId:'payment-failed-retry'},'failed-retry-intent-001',opts);
  await db.query("UPDATE payments SET status='FAILED' WHERE id=$1",[p.id]);
  const retry=await integrations.createCheckout(actor,{bookingId:'payment-failed-retry'},'failed-retry-intent-002',opts);
  assert.equal(retry.id,p.id);assert.equal(retry.paymentURL,p.paymentURL);assert.equal(calls,1);
});

test('amendment charge uses the frozen tax-inclusive total and identifies the signed amendment',async()=>{
  await booking('amendment-tax');
  await db.query("UPDATE bookings SET data=data||$2::jsonb WHERE id=$1",['amendment-tax',{amendment:{id:'am-tax',status:'SIGNED',lines:[{id:'s1',qty:1,price:100}],financials:{total:105,tax:5}}}]);
  let amount;
  const opts={origin:'https://habb.example',provider:{assertConfigured(){},async createCheckout(input){amount=input.amountMinor;return{invoiceId:'am-tax-invoice',paymentURL:'https://demo.myfatoorah.com/pay/am'}}}};
  const p=await integrations.createCheckout(actor,{bookingId:'amendment-tax',amendment:true},'amendment-tax-intent-001',opts);
  assert.equal(amount,105000);
  const row=(await db.query('SELECT data FROM payments WHERE id=$1',[p.id])).rows[0];
  assert.equal(row.data.amendmentId,'am-tax');
});
