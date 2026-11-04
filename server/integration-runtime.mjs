import {AsyncLocalStorage} from 'node:async_hooks';
import {decryptSecret} from './security.mjs';
const context=new AsyncLocalStorage(),caches=new WeakMap();
export const integrationEnvironment=()=>context.getStore() || process.env;
export const withIntegrationEnvironment=(env,fn)=>context.run(env,fn);
export const invalidateIntegrationCache=db=>caches.delete(db);
export const INTEGRATIONS={
  payments:{label:'دفع العملاء',kind:'payment',fields:{MYFATOORAH_ENVIRONMENT:{label:'البيئة',enum:['sandbox','live'],default:'sandbox'},MYFATOORAH_API_KEY:{label:'مفتاح التاجر',secret:true},MYFATOORAH_WEBHOOK_SECRET:{label:'سر إشعارات الدفع',secret:true}},required:['MYFATOORAH_API_KEY','MYFATOORAH_WEBHOOK_SECRET'],disable:['MYFATOORAH_API_KEY','MYFATOORAH_WEBHOOK_SECRET']},
  payouts:{label:'تحويلات الموردين',kind:'payout',fields:{SUPPLIER_PAYOUT_PROVIDER:{label:'نوع الربط',enum:['bridge'],default:'bridge'},SUPPLIER_PAYOUT_ENVIRONMENT:{label:'البيئة',enum:['sandbox','live'],default:'sandbox'},SUPPLIER_PAYOUT_BASE_URL:{label:'عنوان جهة التحويل',url:true},SUPPLIER_PAYOUT_API_KEY:{label:'مفتاح الربط',secret:true},SUPPLIER_PAYOUT_WEBHOOK_SECRET:{label:'سر إشعارات التحويل',secret:true}},required:['SUPPLIER_PAYOUT_BASE_URL','SUPPLIER_PAYOUT_API_KEY','SUPPLIER_PAYOUT_WEBHOOK_SECRET'],disable:['SUPPLIER_PAYOUT_API_KEY']},
  email:{label:'البريد الإلكتروني',kind:'email',fields:{EMAIL_PROVIDER:{label:'مزود البريد',enum:['smtp','resend'],default:'smtp'},MAIL_FROM:{label:'عنوان المرسل'},SMTP_HOST:{label:'خادم البريد'},SMTP_PORT:{label:'المنفذ',default:'587',port:true},SMTP_USER:{label:'اسم المستخدم'},SMTP_PASSWORD:{label:'كلمة مرور البريد',secret:true},SMTP_SECURE:{label:'اتصال مشفر مباشر',enum:['false','true'],default:'false'},RESEND_API_KEY:{label:'مفتاح خدمة البريد',secret:true},RESEND_WEBHOOK_SECRET:{label:'سر تتبع تسليم البريد',secret:true}},required:['MAIL_FROM'],disable:['SMTP_HOST','RESEND_API_KEY']},
  messaging:{label:'الرسائل وواتساب',kind:'messaging',fields:{TWILIO_ACCOUNT_SID:{label:'معرف الحساب'},TWILIO_AUTH_TOKEN:{label:'سر الحساب',secret:true},TWILIO_FROM:{label:'مرسل الرسائل النصية'},TWILIO_WHATSAPP_FROM:{label:'مرسل واتساب'},TWILIO_WHATSAPP_CONTENT_SID:{label:'مرجع قالب واتساب المعتمد'}},required:['TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN'],disable:['TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN']},
  signature:{label:'التوقيع المعتمد الاختياري',kind:'signature',fields:{ESIGNATURE_MODE:{label:'طريقة التوقيع',enum:['clickwrap','bridge'],default:'clickwrap'},ESIGNATURE_BASE_URL:{label:'عنوان جهة التوقيع',url:true},ESIGNATURE_SIGNING_ORIGIN:{label:'نطاق صفحة التوقيع',url:true},ESIGNATURE_API_KEY:{label:'مفتاح الربط',secret:true},ESIGNATURE_WEBHOOK_SECRET:{label:'سر إشعارات التوقيع',secret:true}},required:['ESIGNATURE_BASE_URL','ESIGNATURE_API_KEY','ESIGNATURE_WEBHOOK_SECRET'],disable:['ESIGNATURE_API_KEY','ESIGNATURE_MODE']},
  deployment:{label:'الاستضافة والنشر والنسخ الاحتياطي',kind:'deployment',restart:true,fields:{DEPLOYMENT_PUBLIC_URL:{label:'نطاق الإنتاج المطلوب',url:true},DEPLOYMENT_DATABASE_URL:{label:'اتصال قاعدة الإنتاج',secret:true},BACKUP_TARGET:{label:'وجهة النسخ الاحتياطي'},BACKUP_ACCESS_KEY:{label:'مفتاح خدمة النسخ',secret:true},DEVICE_FARM_USERNAME:{label:'حساب اختبار الأجهزة الفعلية'},DEVICE_FARM_ACCESS_KEY:{label:'مفتاح اختبار الأجهزة',secret:true},SENTRY_DSN:{label:'اتصال خدمة مراقبة الأخطاء',secret:true},OPERATIONS_EMAIL:{label:'بريد مسؤول التشغيل'},SANDBOX_CERTIFICATION_REFERENCE:{label:'مرجع اعتماد اختبارات الدفع'},RESTORE_DRILL_REFERENCE:{label:'مرجع الاستعادة على الاستضافة'},SECURITY_REVIEW_REFERENCE:{label:'مرجع المراجعة الأمنية'}},required:['DEPLOYMENT_PUBLIC_URL'],disable:[]},
};
export function decodeIntegration(row,key,active=false){
  const envelope=JSON.parse(decryptSecret(active && row.active_ciphertext ? row.active_ciphertext : row.ciphertext,key));
  if(envelope.id!==row.id || !envelope.values || typeof envelope.values!=='object')throw Error('Integration ciphertext binding failed');
  return envelope.values;
}
export async function loadIntegrationEnvironment(db,key,{force=false}={}){
  const cached=caches.get(db);if(!force && cached?.until>Date.now())return cached.env;
  const rows=(await db.query('SELECT id,enabled,ciphertext,active_ciphertext FROM integration_settings')).rows;
  const env={...process.env};
  for(const row of rows){
    const definition=INTEGRATIONS[row.id];if(!definition || definition.restart)continue;
    const values=row.active_ciphertext?decodeIntegration(row,key,true):{};
    for(const field of Object.keys(definition.fields))if(Object.hasOwn(values,field))env[field]=values[field];
    env['INTEGRATION_'+row.id.toUpperCase()+'_ENABLED']=String(row.enabled);
  }
  const snapshot=Object.freeze(env);caches.set(db,{until:Date.now()+2000,env:snapshot});return snapshot;
}
export function integrationRuntimeHook(db,key){
  return (request,reply,done)=>{
    if(!request.url.startsWith('/api/'))return done();
    loadIntegrationEnvironment(db,key).then(env=>context.run(env,done),done);
  };
}
