import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {parseEnv} from 'node:util';
const names=['COOKIE_SECRET','ENCRYPTION_KEY','METRICS_TOKEN','DATABASE_URL','DB_APP_PASSWORD','POSTGRES_PASSWORD','BOOTSTRAP_OWNER_PASSWORD','BOOTSTRAP_MFA_SECRET','MYFATOORAH_API_KEY','MYFATOORAH_WEBHOOK_SECRET','SMTP_PASSWORD','TWILIO_AUTH_TOKEN','SUPPLIER_PAYOUT_API_KEY','SUPPLIER_PAYOUT_WEBHOOK_SECRET'];
const local=await readFile('.env','utf8').then(parseEnv).catch(e=>{if(e.code==='ENOENT')return {};throw e;});
const values=names.flatMap(key=>[process.env[key],local[key]].filter(v=>typeof v==='string' && v.length>=8).map(value=>({key,value})));
async function files(directory){const entries=await readdir(directory,{withFileTypes:true});return(await Promise.all(entries.map(e=>e.isDirectory()?files(join(directory,e.name)):join(directory,e.name)))).flat();}
const leaks=[];
for(const file of (await files('dist')).filter(f=>/\.(?:js|css|html|map|json)$/.test(f))){
  const text=await readFile(file,'utf8');
  for(const {key,value} of values)if(text.includes(value))leaks.push({file,key});
}
console.log(JSON.stringify({clientSecretScan:leaks.length?'FAILED':'PASSED',configuredSecretsChecked:new Set(values.map(v=>v.key)).size,leaks}));
if(leaks.length)process.exitCode=1;
