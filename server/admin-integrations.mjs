import {z} from 'zod';
import nodemailer from 'nodemailer';
import {encryptSecret,verifyPassword,httpError} from './security.mjs';
import {INTEGRATIONS,decodeIntegration,invalidateIntegrationCache,withIntegrationEnvironment} from './integration-runtime.mjs';

function owner(actor){if(actor?.role!=='admin')throw httpError(403,'إعدادات الربط متاحة للمالك فقط');}
const definitionFor=id=>{if(!Object.hasOwn(INTEGRATIONS,id))throw httpError(404,'الخدمة غير موجودة');return INTEGRATIONS[id];};
const encrypted=(id,values,key)=>encryptSecret(JSON.stringify({id,values}),key);
const inherited=d=>Object.fromEntries(Object.keys(d.fields).map(k=>[k,process.env[k] ?? d.fields[k].default ?? '']));
function validateValues(id,values,{complete=false}={}){
  const d=definitionFor(id);
  for(const [name,value] of Object.entries(values)){
    if(!Object.hasOwn(d.fields,name) || typeof value!=='string' || value.length>16000)throw httpError(400,'حقل إعداد غير صالح');
    const f=d.fields[name];
    if(f.enum && value && !f.enum.includes(value))throw httpError(400,'اختيار إعداد غير صالح');
    if(f.url && value){let url;try{url=new URL(value);}catch{throw httpError(400,'عنوان الخدمة غير صالح');}if(url.protocol!=='https:' || url.username || url.password || url.hash || url.search)throw httpError(400,'يلزم عنوان آمن دون كلمات مرور أو معاملات');}
    if(f.port && value && (!/^\d+$/.test(value) || Number(value)<1 || Number(value)>65535))throw httpError(400,'منفذ غير صالح');
  }
  if(complete){
    let required=[...d.required];
    if(id==='signature' && values.ESIGNATURE_MODE==='clickwrap')required=[];
    if(id==='email')required.push(values.EMAIL_PROVIDER==='resend'?'RESEND_API_KEY':'SMTP_HOST');
    if(required.some(k=>!values[k]?.trim()))throw httpError(400,'أكمل الحقول المطلوبة قبل الاختبار والتفعيل');
    if(id==='payouts' && values.SUPPLIER_PAYOUT_WEBHOOK_SECRET.length<32)throw httpError(400,'سر إشعارات التحويل يجب ألا يقل عن 32 محرفًا');
    if(id==='signature' && values.ESIGNATURE_MODE==='bridge' && (values.ESIGNATURE_WEBHOOK_SECRET || '').length<32)throw httpError(400,'سر إشعارات التوقيع يجب ألا يقل عن 32 محرفًا');
  }
}
async function reauthenticate(db,actor,password){
  owner(actor);z.string().min(1).max(256).parse(password);
  const user=(await db.query("SELECT password_hash FROM users WHERE id=$1 AND role='admin' AND active=true",[actor.id])).rows[0];
  if(!user || !await verifyPassword(password,user.password_hash)){
    await db.query("INSERT INTO audit_log(actor_id,action,resource_type,resource_id,after_data) VALUES($1,'INTEGRATION_STEPUP_REJECTED','user',$1,$2)",[actor.id,{reason:'INVALID_PASSWORD'}]);
    throw httpError(403,'كلمة مرور المالك غير صحيحة');
  }
}
export async function listIntegrationSettings(db,key){
  const rows=(await db.query('SELECT * FROM integration_settings')).rows;
  return Object.entries(INTEGRATIONS).map(([id,d])=>{
    const row=rows.find(r=>r.id===id),values=row?decodeIntegration(row,key):inherited(d);
    return {id,label:d.label,revision:row?.revision || 0,enabled:row?.enabled || false,activeRevision:row?.active_revision || 0,restart:!!d.restart,lastCheck:row?.last_check || {},fields:Object.entries(d.fields).map(([name,f])=>({name,...f,configured:!!values[name],...(f.secret?{}:{value:values[name] || ''})}))};
  });
}
export async function saveIntegrationSettings(db,actor,key,id,input){
  const d=definitionFor(id);
  const p=z.object({revision:z.number().int().min(0),password:z.string(),values:z.record(z.string(),z.string()),clearSecrets:z.array(z.string()).max(20).default([])}).strict().parse(input);
  await reauthenticate(db,actor,p.password);validateValues(id,p.values);
  if(p.clearSecrets.some(k=>!d.fields[k]?.secret))throw httpError(400,'حقل الحذف غير صالح');
  const result=await db.transaction(async c=>{
    const row=(await c.query('SELECT * FROM integration_settings WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if((row?.revision || 0)!==p.revision)throw httpError(409,'عُدّلت الإعدادات؛ أعد تحميلها قبل الحفظ');
    const values=row?decodeIntegration(row,key):inherited(d);
    for(const [name,value] of Object.entries(p.values))if(!d.fields[name].secret || value!=='')values[name]=value;
    for(const name of p.clearSecrets)values[name]='';
    const cipher=encrypted(id,values,key),revision=p.revision+1;
    await c.query(`INSERT INTO integration_settings(id,revision,ciphertext,updated_by) VALUES($1,$2,$3,$4)
      ON CONFLICT(id) DO UPDATE SET revision=EXCLUDED.revision,ciphertext=EXCLUDED.ciphertext,updated_by=EXCLUDED.updated_by,updated_at=now(),last_check='{}'`,[id,revision,cipher,actor.id]);
    await c.query("INSERT INTO audit_log(actor_id,action,resource_type,resource_id,after_data) VALUES($1,'INTEGRATION_DRAFT_SAVED','integration',$2,$3)",[actor.id,id,{revision,changedFields:Object.keys(p.values),clearedFields:p.clearSecrets}]);
    return {saved:true,revision};
  });
  invalidateIntegrationCache(db);return result;
}
export async function probeIntegration(id,values,{fetchImpl=fetch,smtpFactory=nodemailer.createTransport}={}){
  validateValues(id,values,{complete:true});
  const env={...process.env,...values};
  return withIntegrationEnvironment(env,async()=>{
    if(id==='signature' && values.ESIGNATURE_MODE==='clickwrap')return {ok:true,message:'الموافقة الموثقة داخل المنصة جاهزة؛ لا تُعرض كشهادة توقيع من جهة خارجية.'};
    if(id==='email'){
      if(values.EMAIL_PROVIDER==='resend'){
        const response=await fetchImpl('https://api.resend.com/domains',{headers:{Authorization:'Bearer '+values.RESEND_API_KEY},signal:AbortSignal.timeout(10000),redirect:'error'});
        if(!response.ok)throw httpError(502,'تعذر التحقق من مفتاح البريد وصلاحية قراءة النطاقات');
      }else{
        const transport=smtpFactory({host:values.SMTP_HOST,port:Number(values.SMTP_PORT || 587),secure:values.SMTP_SECURE==='true',requireTLS:['production','staging'].includes(process.env.NODE_ENV),auth:values.SMTP_USER?{user:values.SMTP_USER,pass:values.SMTP_PASSWORD}:undefined,connectionTimeout:8000,socketTimeout:10000});
        try{await transport.verify();}finally{transport.close?.();}
      }
      return {ok:true,message:'تم التحقق من اتصال البريد؛ لم تُرسل رسالة. التسليم الفعلي يُثبت بإشعارات الجهة.'};
    }
    if(id==='payments'){
      const {MyFatoorahProvider}=await import('./providers/payments.mjs');
      const provider=new MyFatoorahProvider({apiKey:values.MYFATOORAH_API_KEY,environment:values.MYFATOORAH_ENVIRONMENT || 'sandbox',fetchImpl});
      const result=await provider.request('POST','/v2/InitiatePayment',{InvoiceAmount:1,CurrencyIso:'KWD'});
      if(!result.PaymentMethods?.length)throw httpError(502,'لم تُرجع الجهة طرق دفع مفعلة');
      return {ok:true,message:'تم التحقق من اعتماد طرق الدفع؛ لم تُنشأ فاتورة ولم يُخصم مبلغ.'};
    }
    if(id==='messaging'){
      if(!/^AC[a-f\d]{32}$/i.test(values.TWILIO_ACCOUNT_SID))throw httpError(400,'معرف الحساب غير صالح');
      const response=await fetchImpl('https://api.twilio.com/2010-04-01/Accounts/'+values.TWILIO_ACCOUNT_SID+'.json',{headers:{Authorization:'Basic '+Buffer.from(values.TWILIO_ACCOUNT_SID+':'+values.TWILIO_AUTH_TOKEN).toString('base64')},signal:AbortSignal.timeout(10000),redirect:'error'});
      if(!response.ok || (await response.json()).status!=='active')throw httpError(502,'تعذر التحقق من تفعيل حساب الرسائل');
      return {ok:true,message:'تم التحقق من الحساب؛ اعتماد المرسل والقالب وموافقة المستلم مطلوب قبل الإرسال.'};
    }
    if(id==='payouts' || id==='signature'){
      const prefix=id==='payouts'?'SUPPLIER_PAYOUT':'ESIGNATURE';
      const response=await fetchImpl(values[prefix+'_BASE_URL'].replace(/\/$/,'')+'/health',{headers:{Authorization:'Bearer '+values[prefix+'_API_KEY']},signal:AbortSignal.timeout(10000),redirect:'error'});
      if(!response.ok || (await response.json()).status!=='ok')throw httpError(502,'تعذر التحقق من جهة الربط');
      return {ok:true,message:'نجح اتصال جهة الربط؛ لا يثبت ذلك وحده الاعتماد البنكي أو القانوني.'};
    }
    throw httpError(409,'إعدادات الاستضافة محفوظة للتطبيق عند النشر؛ لا يمكن نقل قاعدة التشغيل من داخلها تلقائيًا');
  });
}
export async function checkIntegrationSettings(db,actor,key,id,input,{activate=false,probe=probeIntegration}={}){
  const d=definitionFor(id);await reauthenticate(db,actor,input?.password);
  const revision=z.number().int().positive().parse(input.revision);
  if(d.restart)throw httpError(409,'هذه الإعدادات تتطلب تطبيقًا على الاستضافة وإعادة نشر');
  const row=(await db.query('SELECT * FROM integration_settings WHERE id=$1',[id])).rows[0];
  if(!row || row.revision!==revision)throw httpError(409,'أعد تحميل نسخة الإعدادات الحالية');
  const values=decodeIntegration(row,key);
  if(id==='signature' && values.ESIGNATURE_MODE==='bridge' && activate && input.certifiedProviderConfirmed!==true)throw httpError(400,'أكد اعتماد جهة التوقيع تجاريًا قبل تفعيلها');
  if(activate && process.env.NODE_ENV==='production'){
    const field=id==='payments'?'MYFATOORAH_ENVIRONMENT':id==='payouts'?'SUPPLIER_PAYOUT_ENVIRONMENT':null;
    if(field && values[field]!=='live')throw httpError(400,'لا يمكن تفعيل بيئة اختبار في الإنتاج');
  }
  let result;try{result=await probe(id,values);}catch(error){result={ok:false,message:error.statusCode?error.message:'تعذر التحقق من الاتصال؛ راجع الإعدادات والجهة'};}
  await db.transaction(async c=>{
    const current=(await c.query('SELECT revision FROM integration_settings WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if(current.revision!==revision)throw httpError(409,'تغيرت المسودة أثناء الفحص؛ أعد المحاولة');
    await c.query(`UPDATE integration_settings SET last_check=$2,
      enabled=CASE WHEN $3 THEN true ELSE enabled END,
      active_ciphertext=CASE WHEN $3 THEN ciphertext ELSE active_ciphertext END,
      active_revision=CASE WHEN $3 THEN revision ELSE active_revision END WHERE id=$1`,[id,{...result,at:new Date().toISOString(),revision},activate && result.ok]);
    await c.query("INSERT INTO audit_log(actor_id,action,resource_type,resource_id,after_data) VALUES($1,$2,'integration',$3,$4)",[actor.id,activate && result.ok?'INTEGRATION_ACTIVATED':'INTEGRATION_CHECKED',id,{revision,ok:result.ok}]);
  });
  invalidateIntegrationCache(db);return {...result,activated:activate && result.ok};
}
export async function registerAdminIntegrationRoutes(app){
  const db=app.db,key=app.config.encryptionKey,auth={preHandler:app.authenticate};
  const sensitive={...auth,config:{rateLimit:{max:5,timeWindow:'1 minute'}}};
  app.get('/api/admin/integrations',auth,async req=>{owner(req.actor);return {items:await listIntegrationSettings(db,key)};});
  app.post('/api/admin/integrations/:id/save',sensitive,req=>saveIntegrationSettings(db,req.actor,key,req.params.id,req.body));
  app.post('/api/admin/integrations/:id/check',sensitive,req=>checkIntegrationSettings(db,req.actor,key,req.params.id,req.body));
  app.post('/api/admin/integrations/:id/activate',sensitive,req=>checkIntegrationSettings(db,req.actor,key,req.params.id,req.body,{activate:true}));
  app.post('/api/admin/integrations/:id/disable',sensitive,async req=>{
    definitionFor(req.params.id);await reauthenticate(db,req.actor,req.body?.password);
    await db.transaction(async c=>{
      await c.query('UPDATE integration_settings SET enabled=false,updated_at=now(),updated_by=$2 WHERE id=$1',[req.params.id,req.actor.id]);
      await c.query("INSERT INTO audit_log(actor_id,action,resource_type,resource_id,after_data) VALUES($1,'INTEGRATION_DISABLED','integration',$2,$3)",[req.actor.id,req.params.id,{newOperationsDisabled:true}]);
    });invalidateIntegrationCache(db);return {disabled:true};
  });
}
