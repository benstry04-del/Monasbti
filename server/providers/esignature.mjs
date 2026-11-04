import {integrationEnvironment} from '../integration-runtime.mjs';
import {integrationError} from './payments.mjs';
export class SignatureBridge {
  constructor({env=integrationEnvironment(),fetchImpl=fetch}={}){this.env=env;this.fetch=fetchImpl;}
  assertConfigured({newEnvelope=false}={}){
    let base;try{base=new URL(this.env.ESIGNATURE_BASE_URL);}catch{}
    if(!base || base.protocol!=='https:' || base.username || base.password || base.search || base.hash || !this.env.ESIGNATURE_API_KEY || (this.env.ESIGNATURE_WEBHOOK_SECRET || '').length<32)throw integrationError('جهة التوقيع تحتاج تهيئة واعتمادًا');
    if(newEnvelope && this.env.INTEGRATION_SIGNATURE_ENABLED==='false')throw integrationError('بدء طلبات توقيع جديدة موقوف');
  }
  async request(method,path,body,key){
    this.assertConfigured();
    const response=await this.fetch(this.env.ESIGNATURE_BASE_URL.replace(/\/$/,'')+path,{method,headers:{Authorization:'Bearer '+this.env.ESIGNATURE_API_KEY,'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000),redirect:'error'}).catch(()=>{throw integrationError('نتيجة جهة التوقيع غير مؤكدة؛ تجري المتابعة دون تكرار الطلب',503);});
    if(!response.ok)throw integrationError('تعذر التحقق من جهة التوقيع',502);
    return response;
  }
  async create(input){this.assertConfigured({newEnvelope:true});const response=await this.request('POST','/envelopes',input,input.externalId);await response.arrayBuffer();}
  async lookup(id){return(await this.request('GET','/envelopes/by-external-id/'+encodeURIComponent(id))).json();}
  async document(id){
    const response=await this.request('GET','/envelopes/'+encodeURIComponent(id)+'/document');
    const chunks=[];let size=0;
    for await(const chunk of response.body){size+=chunk.length;if(size>10*1024*1024)throw integrationError('حجم الوثيقة الموقعة تجاوز الحد',502);chunks.push(Buffer.from(chunk));}
    return Buffer.concat(chunks);
  }
  signingURL(value){const url=new URL(value),allowed=new URL(this.env.ESIGNATURE_SIGNING_ORIGIN || this.env.ESIGNATURE_BASE_URL);if(url.protocol!=='https:' || url.origin!==allowed.origin || url.username || url.password)throw integrationError('رابط جهة التوقيع غير مطابق',409,'SIGNATURE_MISMATCH');return url.href;}
}
