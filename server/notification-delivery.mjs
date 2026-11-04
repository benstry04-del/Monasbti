import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import twilio from 'twilio';
import {Webhook} from 'svix';
import {integrationEnvironment} from './integration-runtime.mjs';
import {integrationError} from './providers/payments.mjs';
import {sendMessage} from './providers/notifications.mjs';
export const recipientHash=value=>createHash('sha256').update(String(value).replace(/^whatsapp:/,'').trim().toLowerCase()).digest('hex');
const ranks={SENDING:0,UNKNOWN:0,ACCEPTED:1,DELAYED:1,SENT:2,DELIVERED:3,READ:4};
const failures=new Set(['FAILED','BOUNCED','COMPLAINED']);
export function deliveryTransition(current,next){
  if(current==='READ')return current;
  if(current==='DELIVERED')return next==='READ'?'READ':current;
  if(failures.has(current))return current;
  if(failures.has(next))return next;
  return (ranks[next] ?? -1)>=(ranks[current] ?? -1)?next:current;
}
async function applyEvent(c,event){
  const delivery=(await c.query('SELECT * FROM notification_deliveries WHERE provider=$1 AND provider_message_id=$2 FOR UPDATE',[event.provider,event.message_id])).rows[0];
  if(!delivery)return;
  const status=deliveryTransition(delivery.status,event.status);
  await c.query('UPDATE notification_deliveries SET status=$2,error_code=COALESCE($3,error_code),updated_at=now() WHERE id=$1',[delivery.id,status,event.error_code || null]);
  if(['DELIVERED','READ',...failures].includes(status))
    await c.query("UPDATE outbox SET status='COMPLETED',locked_at=NULL,last_error=NULL WHERE id=$1",[delivery.job_id]);
}
export async function recordDeliveryEvent(db,event){
  await db.transaction(async c=>{
    const inserted=await c.query('INSERT INTO notification_delivery_events(provider,event_id,message_id,status,error_code) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING event_id',[event.provider,event.event_id,event.message_id,event.status,event.error_code || null]);
    if(inserted.rowCount)await applyEvent(c,event);
  });
}
export async function executeMessageDelivery(db,job,{sender=sendMessage,env=integrationEnvironment()}={}){
  const provider=job.job_type==='EMAIL'?(env.EMAIL_PROVIDER==='resend'?'resend':'smtp'):'twilio';
  if(sender===sendMessage){
    if(job.job_type==='EMAIL' && (env.INTEGRATION_EMAIL_ENABLED==='false' || !env.MAIL_FROM || (provider==='resend'?!env.RESEND_API_KEY:!env.SMTP_HOST)))throw integrationError('أكمل تفعيل البريد قبل الإرسال');
    if(provider==='twilio' && (env.INTEGRATION_MESSAGING_ENABLED==='false' || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_ACCOUNT_SID))throw integrationError('أكمل تفعيل الرسائل قبل الإرسال');
  }
  const attempt=await db.transaction(async c=>{
    let row=(await c.query('SELECT * FROM notification_deliveries WHERE job_id=$1 FOR UPDATE',[job.id])).rows[0];
    if(row){
      if(!['SENDING','UNKNOWN'].includes(row.status))return {row,send:false};
      if(row.provider!=='resend' || Date.now()-new Date(row.created_at).getTime()>23*3600000)
        throw integrationError('قبول الرسالة غير مؤكد؛ يلزم التحقق من الجهة قبل إعادة الإرسال',409,'DELIVERY_UNCERTAIN');
      return {row,send:true};
    }
    const user=job.job_type==='EMAIL'?(await c.query('SELECT id FROM users WHERE lower(email)=lower($1)',[job.payload.to])).rows[0]:null;
    row=(await c.query("INSERT INTO notification_deliveries(job_id,user_id,channel,provider,recipient_hash,status) VALUES($1,$2,$3,$4,$5,'SENDING') RETURNING *",[job.id,user?.id || null,job.job_type,provider,recipientHash(job.payload.to)])).rows[0];
    return {row,send:true};
  });
  if(!attempt.send)return attempt.row;
  const row=attempt.row;
  const payload={...job.payload,idempotencyKey:'notification:'+job.id,messageId:`<${row.id}@habb-notifications>`};
  if(provider==='twilio' && /^https:\/\//.test(env.APP_ORIGIN || ''))payload.statusCallback=new URL('/api/webhooks/twilio?deliveryId='+row.id,env.APP_ORIGIN).href;
  let result;
  try{result=await sender(job.job_type,payload);if(!result?.messageId)throw Error('No accepted provider reference');}
  catch(error){
    const current=(await db.query("UPDATE notification_deliveries SET status='UNKNOWN',updated_at=now() WHERE id=$1 AND provider_message_id IS NULL AND status='SENDING' RETURNING id",[row.id])).rows;
    if(!current.length){const known=(await db.query('SELECT status FROM notification_deliveries WHERE id=$1',[row.id])).rows[0];if(known && ['DELIVERED','READ',...failures].includes(known.status))return known;}
    throw error;
  }
  return db.transaction(async c=>{
    const stored=(await c.query('SELECT * FROM notification_deliveries WHERE id=$1 FOR UPDATE',[row.id])).rows[0];
    if(stored.provider_message_id && stored.provider_message_id!==result.messageId)throw integrationError('مرجع الرسالة لا يطابق محاولة الإرسال',409,'DELIVERY_REFERENCE_MISMATCH');
    await c.query("UPDATE notification_deliveries SET provider_message_id=$2,status=CASE WHEN status IN ('SENDING','UNKNOWN') THEN 'ACCEPTED' ELSE status END,updated_at=now() WHERE id=$1",[row.id,result.messageId]);
    const events=(await c.query('SELECT * FROM notification_delivery_events WHERE provider=$1 AND message_id=$2 ORDER BY created_at,event_id',[provider,result.messageId])).rows;
    for(const event of events)await applyEvent(c,event);
    return {accepted:true,messageId:result.messageId};
  });
}
export async function registerDeliveryRoutes(app){
  const db=app.db,auth={preHandler:app.authenticate};
  app.get('/api/notification-deliveries',auth,async req=>{
    if(!['admin','staff'].includes(req.actor.role))throw integrationError('غير مخول',403);
    const page=z.coerce.number().int().min(1).max(100000).default(1).parse(req.query.page),status=z.enum(['','SENDING','ACCEPTED','SENT','DELIVERED','READ','DELAYED','FAILED','BOUNCED','COMPLAINED','UNKNOWN']).default('').parse(req.query.status);
    const items=(await db.query("SELECT id,job_id,channel,provider,provider_message_id,status,error_code,created_at,updated_at FROM notification_deliveries WHERE ($1='' OR status=$1) ORDER BY created_at DESC,id LIMIT 25 OFFSET $2",[status,(page-1)*25])).rows;
    return {items,page,hasMore:items.length===25};
  });
  app.post('/api/webhooks/resend',{config:{csrf:false,rawBody:true},bodyLimit:65536},async(req,reply)=>{
    const secret=integrationEnvironment().RESEND_WEBHOOK_SECRET;if(!secret)throw integrationError('تتبع البريد غير مهيأ',503);
    let event;try{new Webhook(secret).verify(req.rawBody,{'svix-id':req.headers['svix-id'],'svix-timestamp':req.headers['svix-timestamp'],'svix-signature':req.headers['svix-signature']});event=JSON.parse(req.rawBody);}catch{throw integrationError('توقيع إشعار البريد غير صالح',401);}
    const states={'email.sent':'SENT','email.delivered':'DELIVERED','email.delivery_delayed':'DELAYED','email.bounced':'BOUNCED','email.complained':'COMPLAINED','email.failed':'FAILED'};
    const status=states[event.type];if(!status)return reply.code(202).send({ignored:true});
    const id=z.string().min(1).max(160).parse(event.data?.email_id),eventId=z.string().min(1).max(160).parse(req.headers['svix-id']);
    await recordDeliveryEvent(db,{provider:'resend',event_id:eventId,message_id:id,status});return reply.code(202).send({accepted:true});
  });
  app.post('/api/webhooks/twilio',{config:{csrf:false},bodyLimit:16384},async(req,reply)=>{
    const env=integrationEnvironment(),url=new URL(req.raw.url,app.config.appOrigin).href;
    if(!env.TWILIO_AUTH_TOKEN || !twilio.validateRequest(env.TWILIO_AUTH_TOKEN,req.headers['x-twilio-signature'] || '',url,req.body || {}))throw integrationError('توقيع إشعار الرسائل غير صالح',401);
    const sid=z.string().regex(/^(SM|MM)[a-f\d]{32}$/i).parse(req.body.MessageSid),state=z.string().parse(req.body.MessageStatus || req.body.SmsStatus);
    if(req.body.AccountSid!==env.TWILIO_ACCOUNT_SID)throw integrationError('حساب الإشعار غير مطابق',401);
    const statuses={accepted:'ACCEPTED',queued:'ACCEPTED',sending:'SENDING',sent:'SENT',delivered:'DELIVERED',read:'READ',failed:'FAILED',undelivered:'FAILED'},status=statuses[state];
    if(!status)return reply.code(202).send({ignored:true});
    if(req.query.deliveryId){
      const deliveryId=z.string().uuid().parse(req.query.deliveryId);
      await db.transaction(async c=>{
        const row=(await c.query("SELECT * FROM notification_deliveries WHERE id=$1 AND provider='twilio' FOR UPDATE",[deliveryId])).rows[0];
        if(!row || row.recipient_hash!==recipientHash(req.body.To) || (row.provider_message_id && row.provider_message_id!==sid))throw integrationError('إشعار الرسالة لا يطابق المستلم',409);
        if(!row.provider_message_id)await c.query('UPDATE notification_deliveries SET provider_message_id=$2 WHERE id=$1',[row.id,sid]);
      });
    }
    await recordDeliveryEvent(db,{provider:'twilio',event_id:createHash('sha256').update(sid+':'+status+':'+(req.body.ErrorCode || '')).digest('hex'),message_id:sid,status,error_code:String(req.body.ErrorCode || '').slice(0,30)});
    return reply.code(202).send({accepted:true});
  });
}
