// Persistent local client trial, isolated from the application's working database.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {resolve} from 'node:path';
const directory=resolve('data/client-demo');await mkdir(directory,{recursive:true});
const credentialsPath=resolve(directory,'access.json');
let access;
try{access=JSON.parse(await readFile(credentialsPath,'utf8'));}catch(error){
  if(error.code!=='ENOENT')throw error;
  access={password:'Habb-Trial-'+randomBytes(6).toString('hex')+'!',cookieSecret:randomBytes(48).toString('hex'),encryptionKey:randomBytes(32).toString('hex')};
  await writeFile(credentialsPath,JSON.stringify(access,null,2),{flag:'wx',mode:0o600});
}
const origin=process.env.CLIENT_TRIAL_ORIGIN || 'http://127.0.0.1:4302';
const parsedOrigin=new URL(origin);
if(parsedOrigin.origin!==origin || (parsedOrigin.protocol!=='https:' && origin!=='http://127.0.0.1:4302'))throw Error('Trial public origin must be an HTTPS origin or the local trial URL');
Object.assign(process.env,{NODE_ENV:'development',DATABASE_URL:'pglite:'+resolve(directory,'database'),ENABLE_DEMO:'true',DEV_DEMO_PASSWORD:access.password,APP_ORIGIN:origin,HOST:'127.0.0.1',PORT:'4302',COOKIE_SECRET:access.cookieSecret,ENCRYPTION_KEY:access.encryptionKey,STORAGE_DIR:resolve(directory,'uploads')});
// No inherited merchant/sender credentials or monitoring traffic in this trial.
for(const key of ['MYFATOORAH_API_KEY','MYFATOORAH_WEBHOOK_SECRET','SUPPLIER_PAYOUT_API_KEY','SUPPLIER_PAYOUT_WEBHOOK_SECRET','SMTP_HOST','SMTP_PASSWORD','RESEND_API_KEY','RESEND_WEBHOOK_SECRET','TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','ESIGNATURE_API_KEY','ESIGNATURE_WEBHOOK_SECRET','SENTRY_DSN'])process.env[key]='';
const {migrate}=await import('../server/migrate.mjs');await migrate();
const {seedDemo}=await import('../server/seed-demo.mjs');await seedDemo();
const db=await import('../server/db.mjs');const {verifyPassword}=await import('../server/security.mjs');
for(const role of ['customer','staff','admin','supplier']){
  const user=(await db.query('SELECT password_hash,role FROM users WHERE email=$1',[role+'@demo.kw'])).rows[0];
  if(!user || user.role!==role || !await verifyPassword(access.password,user.password_hash))throw Error('Trial account verification failed: '+role);
}
const {createApp}=await import('../server/app.mjs');const app=await createApp();
const stop=async()=>{await app.close();await db.pool.end();};
process.once('SIGINT',()=>stop());process.once('SIGTERM',()=>stop());
await app.listen({host:'127.0.0.1',port:4302});
console.log(JSON.stringify({trial:origin+'/auth/login',accountsVerified:4,accessFile:credentialsPath}));
