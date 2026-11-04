import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
process.env.DATABASE_URL=process.env.TEST_DATABASE_URL || 'pglite:memory';process.env.NODE_ENV='test';
const db=await import('../server/db.mjs');const {migrate}=await import('../server/migrate.mjs');await migrate();
const {executeMessageDelivery,recordDeliveryEvent,deliveryTransition}=await import('../server/notification-delivery.mjs');
after(()=>db.pool.end());
async function job(channel='EMAIL'){const id=randomUUID(),payload={to:channel==='EMAIL'?'recipient@example.test':'+96555551234',subject:'Test',text:'Actual test intent',consent:true};await db.query('INSERT INTO outbox(id,job_type,payload,dedupe_key) VALUES($1,$2,$3,$4)',[id,channel,payload,id]);return{id,job_type:channel,payload};}
test('delivery does not claim receipt on acceptance and duplicate job retries do not send twice',async()=>{
  const j=await job();let calls=0;
  const sender=async()=>{calls++;return{messageId:'smtp-reference'};};
  await executeMessageDelivery(db,j,{sender,env:{}});await executeMessageDelivery(db,j,{sender,env:{}});
  assert.equal(calls,1);assert.equal((await db.query('SELECT status FROM notification_deliveries WHERE job_id=$1',[j.id])).rows[0].status,'ACCEPTED');
});
test('signed provider events that arrive before acceptance are applied once when the provider id is linked',async()=>{
  const j=await job(),event={provider:'resend',event_id:'early-delivery',message_id:'early-message',status:'DELIVERED'};
  await recordDeliveryEvent(db,event);await recordDeliveryEvent(db,event);
  await executeMessageDelivery(db,j,{env:{EMAIL_PROVIDER:'resend'},sender:async()=>({messageId:'early-message'})});
  assert.equal((await db.query('SELECT status FROM notification_deliveries WHERE job_id=$1',[j.id])).rows[0].status,'DELIVERED');
  await recordDeliveryEvent(db,{...event,event_id:'late-sent',status:'SENT'});
  assert.equal((await db.query('SELECT status FROM notification_deliveries WHERE job_id=$1',[j.id])).rows[0].status,'DELIVERED');
  assert.equal((await db.query('SELECT status FROM outbox WHERE id=$1',[j.id])).rows[0].status,'COMPLETED');
});
test('an uncertain SMTP attempt is not blindly repeated, whereas Resend recovery reuses its idempotency key',async()=>{
  const smtp=await job();let calls=0;
  await assert.rejects(()=>executeMessageDelivery(db,smtp,{env:{},sender:async()=>{calls++;throw Error('lost after acceptance');}}));
  await assert.rejects(()=>executeMessageDelivery(db,smtp,{env:{},sender:async()=>{calls++;}}),e=>e.code==='DELIVERY_UNCERTAIN');assert.equal(calls,1);
  const resend=await job(),keys=[];
  await assert.rejects(()=>executeMessageDelivery(db,resend,{env:{EMAIL_PROVIDER:'resend'},sender:async(_c,p)=>{keys.push(p.idempotencyKey);throw Error('timeout');}}));
  await executeMessageDelivery(db,resend,{env:{EMAIL_PROVIDER:'resend'},sender:async(_c,p)=>{keys.push(p.idempotencyKey);return{messageId:'recovered-message'};}});
  assert.equal(keys[0],keys[1]);
});
test('delivery rank never regresses a verified receipt and SMTP acceptance is distinct from delivery',()=>{
  assert.equal(deliveryTransition('ACCEPTED','SENT'),'SENT');assert.equal(deliveryTransition('DELIVERED','FAILED'),'DELIVERED');assert.equal(deliveryTransition('READ','SENT'),'READ');assert.equal(deliveryTransition('SENT','FAILED'),'FAILED');assert.equal(deliveryTransition('FAILED','ACCEPTED'),'FAILED');
});

test('HTTP delivery callbacks verify raw signed payloads and reject altered bodies',async()=>{
  const {createApp}=await import('../server/app.mjs');
  const {withIntegrationEnvironment}=await import('../server/integration-runtime.mjs');
  const {Webhook}=await import('svix');const twilio=(await import('twilio')).default;
  const secret='whsec_'+Buffer.from('isolated-svix-signing-secret-32bytes').toString('base64');
  process.env.RESEND_WEBHOOK_SECRET=secret;process.env.TWILIO_AUTH_TOKEN='isolated-twilio-auth-secret';process.env.TWILIO_ACCOUNT_SID='AC'+'a'.repeat(32);
  const app=await createApp({logger:false});
  try{
    const id='msg_signed_test',date=new Date(),payload=JSON.stringify({type:'email.delivered',data:{email_id:'signed-email'}});
    const headers={'content-type':'application/json','svix-id':id,'svix-timestamp':String(Math.floor(date.getTime()/1000)),'svix-signature':new Webhook(secret).sign(id,date,payload)};
    assert.equal((await app.inject({method:'POST',url:'/api/webhooks/resend',headers,payload})).statusCode,202);
    assert.equal((await app.inject({method:'POST',url:'/api/webhooks/resend',headers,payload:payload.replace('signed-email','tampered')})).statusCode,401);
    const params={MessageSid:'SM'+'b'.repeat(32),MessageStatus:'delivered',AccountSid:process.env.TWILIO_ACCOUNT_SID,To:'+96555551234'};
    const url='/api/webhooks/twilio',signature=twilio.getExpectedTwilioSignature(process.env.TWILIO_AUTH_TOKEN,new URL(url,app.config.appOrigin).href,params);
    const response=await app.inject({method:'POST',url,headers:{'content-type':'application/x-www-form-urlencoded','x-twilio-signature':signature},payload:new URLSearchParams(params).toString()});assert.equal(response.statusCode,202);
    assert.equal((await app.inject({method:'POST',url,headers:{'content-type':'application/x-www-form-urlencoded','x-twilio-signature':signature},payload:new URLSearchParams({...params,MessageStatus:'failed'}).toString()})).statusCode,401);
    assert.equal(Number((await db.query("SELECT count(*) FROM notification_delivery_events WHERE message_id IN ('signed-email',$1)",[params.MessageSid])).rows[0].count),2);
  }finally{await app.close();delete process.env.RESEND_WEBHOOK_SECRET;delete process.env.TWILIO_AUTH_TOKEN;delete process.env.TWILIO_ACCOUNT_SID;}
});
