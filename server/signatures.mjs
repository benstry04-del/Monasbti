import {randomUUID,createHash} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {z} from 'zod';
import {encryptSecret,decryptSecret} from './security.mjs';
import {integrationEnvironment} from './integration-runtime.mjs';
import {integrationError} from './providers/payments.mjs';
import {SignatureBridge} from './providers/esignature.mjs';
import {verifyPayoutWebhook} from './providers/supplier-payouts.mjs';
import {enqueue} from './integrations.mjs';
import {reserveCapacity} from './business.mjs';
const fingerprint=lines=>JSON.stringify(lines.map(l=>({id:l.id,supplierId:l.supplierId,qty:l.qty,price:l.price,cost:l.cost})));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function requestSignature(db,actor,input,{ip=null,provider=new SignatureBridge()}={}){
  if(actor?.role!=='customer')throw integrationError('التوقيع متاح لصاحب العقد',403);
  const p=z.object({bookingId:z.string().min(1).max(150),consent:z.literal(true),signature:z.string().trim().min(2).max(120)}).strict().parse(input);
  return db.transaction(async c=>{
    const booking=(await c.query('SELECT * FROM bookings WHERE id=$1 FOR UPDATE',[p.bookingId])).rows[0];
    if(!booking || booking.customer_id!==actor.id)throw integrationError('العقد غير متاح',404);
    if(['CANCELLED','EXPIRED','COMPLETED'].includes(booking.status))throw integrationError('حالة الطلب لا تسمح بطلب توقيع',409);
    const contract=(await c.query('SELECT * FROM contracts WHERE booking_id=$1 AND version=$2 FOR UPDATE',[booking.id,booking.data.contract?.version || 0])).rows[0];
    if(!contract || contract.status!=='APPROVED')throw integrationError('يلزم عقد معتمد غير موقع',409);
    const existing=(await c.query('SELECT * FROM signature_requests WHERE contract_id=$1',[contract.id])).rows[0];
    if(existing){await enqueue(c,'SIGNATURE_RECONCILE',{signatureId:existing.id},'signature-refresh:'+existing.id+':'+Math.floor(Date.now()/60000));return {id:existing.id,status:existing.status};}
    if(integrationEnvironment().ESIGNATURE_MODE!=='bridge')throw integrationError('لم تُفعّل جهة توقيع خارجية لهذا العقد',409);
    provider.assertConfigured({newEnvelope:true});
    const user=(await c.query('SELECT email FROM users WHERE id=$1 AND verified_at IS NOT NULL',[actor.id])).rows[0];if(!user)throw integrationError('يلزم حساب موثق',403);
    const row=(await c.query("INSERT INTO signature_requests(booking_id,contract_id,user_id,document_hash,signer_email,status,consent) VALUES($1,$2,$3,$4,$5,'CREATED',$6) RETURNING id,status",[booking.id,contract.id,actor.id,contract.document_hash,user.email,{name:p.signature,consent:true,ip,at:new Date().toISOString()}])).rows[0];
    await enqueue(c,'SIGNATURE_CREATE',{signatureId:row.id},'signature-create:'+row.id);
    await c.query("INSERT INTO audit_log(actor_id,action,resource_type,resource_id,after_data) VALUES($1,'EXTERNAL_SIGNATURE_REQUESTED','contract',$2,$3)",[actor.id,contract.id,{requestId:row.id,documentHash:contract.document_hash}]);
    return row;
  });
}
export async function createSignatureEnvelope(db,id,key,provider=new SignatureBridge()){
  const intent=await db.transaction(async c=>{
    const row=(await c.query('SELECT * FROM signature_requests WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row || ['COMPLETED','DECLINED','EXPIRED','MANUAL_REVIEW'].includes(row.status))return null;
    if(row.first_attempt_at)return {row,first:false};provider.assertConfigured({newEnvelope:true});
    const contract=(await c.query('SELECT data,document_hash FROM contracts WHERE id=$1',[row.contract_id])).rows[0];
    if(contract.document_hash!==row.document_hash)throw integrationError('تغيرت نسخة العقد',409,'SIGNATURE_MISMATCH');
    await c.query('UPDATE signature_requests SET first_attempt_at=now() WHERE id=$1',[id]);return {row,contract,first:true};
  });
  if(!intent)return;
  if(intent.first)await provider.create({externalId:id,documentHash:intent.row.document_hash,html:intent.contract.data.html,signer:{email:intent.row.signer_email,name:intent.row.consent.name},returnURL:new URL('/contract/'+encodeURIComponent(intent.row.booking_id),integrationEnvironment().APP_ORIGIN).href});
  return reconcileSignature(db,id,key,provider);
}
export async function reconcileSignature(db,id,key,provider=new SignatureBridge()){
  const row=(await db.query('SELECT * FROM signature_requests WHERE id=$1',[id])).rows[0];
  if(!row || ['COMPLETED','DECLINED','EXPIRED','MANUAL_REVIEW'].includes(row.status))return;
  const proof=z.object({id:z.string().min(1).max(160),externalId:z.string().uuid(),documentHash:z.string().regex(/^[a-f\d]{64}$/),signerEmail:z.email(),status:z.enum(['PENDING','COMPLETED','DECLINED','EXPIRED']),signingURL:z.string().optional(),signerName:z.string().max(120).optional(),completedAt:z.iso.datetime().optional(),signedDocumentHash:z.string().regex(/^[a-f\d]{64}$/).optional()}).parse(await provider.lookup(id));
  if(proof.externalId!==row.id || proof.documentHash!==row.document_hash || proof.signerEmail.toLowerCase()!==row.signer_email.toLowerCase() || (row.provider_ref && row.provider_ref!==proof.id))throw integrationError('دليل جهة التوقيع لا يطابق العقد أو صاحبه',409,'SIGNATURE_MISMATCH');
  if(proof.status==='PENDING'){
    const url=proof.signingURL?provider.signingURL(proof.signingURL):null;
    await db.transaction(async c=>{
      await c.query("UPDATE signature_requests SET status=$4,provider_ref=$2,signing_url_ciphertext=$3,updated_at=now() WHERE id=$1 AND status IN ('CREATED','READY')",[id,proof.id,url?encryptSecret(url,key):null,url?'READY':'CREATED']);
      await enqueue(c,'SIGNATURE_RECONCILE',{signatureId:id},'signature-check:'+id+':'+Math.floor(Date.now()/60000),new Date(Date.now()+60000));
    });return;
  }
  if(proof.status!=='COMPLETED'){
    await db.query("UPDATE signature_requests SET status=$2,provider_ref=$3,signing_url_ciphertext=NULL,proof=$4,updated_at=now() WHERE id=$1 AND status IN ('CREATED','READY')",[id,proof.status,proof.id,proof]);return;
  }
  if(!proof.completedAt || !proof.signerName || !proof.signedDocumentHash)throw integrationError('شهادة التوقيع غير مكتملة',409,'SIGNATURE_MISMATCH');
  const pdf=await provider.document(proof.id);
  if(!Buffer.isBuffer(pdf) || !pdf.subarray(0,5).equals(Buffer.from('%PDF-')) || digest(pdf)!==proof.signedDocumentHash)throw integrationError('بصمة الوثيقة الموقعة غير مطابقة',409,'SIGNATURE_MISMATCH');
  const storageKey='signature-'+id+'.pdf',root=resolve(process.env.STORAGE_DIR || './data/uploads');await mkdir(root,{recursive:true,mode:0o700});
  try{await writeFile(resolve(root,storageKey),pdf,{flag:'wx',mode:0o600});}catch(error){if(error.code!=='EEXIST')throw error;if(digest(await readFile(resolve(root,storageKey)))!==proof.signedDocumentHash)throw integrationError('تعارض في نسخة الوثيقة المحفوظة',409,'SIGNATURE_MISMATCH');}
  return db.transaction(async c=>{
    const booking=(await c.query('SELECT * FROM bookings WHERE id=$1 FOR UPDATE',[row.booking_id])).rows[0];
    const contract=(await c.query('SELECT * FROM contracts WHERE id=$1 FOR UPDATE',[row.contract_id])).rows[0];
    const current=(await c.query('SELECT status FROM signature_requests WHERE id=$1 FOR UPDATE',[id])).rows[0];if(current.status==='COMPLETED')return;
    const fileId=id;
    await c.query('INSERT INTO files(id,owner_id,booking_id,storage_key,filename,mime,size,sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO NOTHING',[fileId,row.user_id,row.booking_id,storageKey,'signed-contract.pdf','application/pdf',pdf.length,proof.signedDocumentHash]);
    let review=booking.status!=='CONTRACT_APPROVED' || contract.status!=='APPROVED' || booking.data.contract?.version!==contract.version || contract.document_hash!==row.document_hash || fingerprint(booking.data.lines)!==fingerprint(contract.data.snapshot);
    if(!review){try{await reserveCapacity(c,booking.data,'CONFIRMED',true);}catch(error){if(![400,409].includes(error.statusCode))throw error;review=true;}}
    if(review){
      await c.query("UPDATE signature_requests SET status='MANUAL_REVIEW',provider_ref=$2,proof=$3,signing_url_ciphertext=NULL,updated_at=now() WHERE id=$1",[id,proof.id,{...proof,fileId}]);
      await c.query("INSERT INTO audit_log(action,resource_type,resource_id,after_data) VALUES('EXTERNAL_SIGNATURE_REVIEW_REQUIRED','contract',$1,$2)",[contract.id,{signatureId:id,fileId}]);return;
    }
    const signed={...contract.data,status:'SIGNED',signature:proof.signerName,signedAt:proof.completedAt,externalSignature:{requestId:id,providerRef:proof.id,fileId,sha256:proof.signedDocumentHash},metadata:{assurance:'external-provider-verified',actorId:row.user_id,consent:row.consent,documentHash:row.document_hash}};
    await c.query("UPDATE contracts SET status='SIGNED',signed_at=$2,data=$3 WHERE id=$1 AND signed_at IS NULL",[contract.id,proof.completedAt,signed]);
    const b=booking.data;b.contract=signed;b.status='SIGNED';b.timeline=[...(b.timeline || []),{status:'تم التحقق من توقيع جهة خارجية',at:proof.completedAt}];
    await reserveCapacity(c,b,'CONFIRMED');
    await c.query("UPDATE bookings SET status='SIGNED',data=$2,version=version+1,updated_at=now() WHERE id=$1",[booking.id,b]);
    await c.query("UPDATE signature_requests SET status='COMPLETED',provider_ref=$2,proof=$3,signing_url_ciphertext=NULL,updated_at=now() WHERE id=$1",[id,proof.id,{...proof,fileId}]);
    await c.query("INSERT INTO audit_log(actor_id,action,resource_type,resource_id,after_data) VALUES($1,'EXTERNAL_SIGNATURE_VERIFIED','contract',$2,$3)",[row.user_id,contract.id,{signatureId:id,documentHash:row.document_hash,signedDocumentHash:proof.signedDocumentHash}]);
  });
}
export async function registerSignatureRoutes(app){
  const db=app.db,key=app.config.encryptionKey,auth={preHandler:app.authenticate};
  app.post('/api/signatures',auth,req=>requestSignature(db,req.actor,req.body,{ip:req.ip}));
  app.get('/api/signatures/:id',auth,async req=>{
    const row=(await db.query('SELECT * FROM signature_requests WHERE id=$1 AND user_id=$2',[z.string().uuid().parse(req.params.id),req.actor.id])).rows[0];if(!row)throw integrationError('طلب التوقيع غير موجود',404);
    return {id:row.id,status:row.status,...(row.status==='READY' && row.signing_url_ciphertext?{signingURL:decryptSecret(row.signing_url_ciphertext,key)}:{})};
  });
  app.post('/api/webhooks/esignature',{config:{csrf:false},bodyLimit:4096},async(req,reply)=>{
    const event=z.object({eventId:z.string().min(1).max(120),externalId:z.string().uuid(),timestamp:z.number().int()}).strict().parse(req.body);
    if(!verifyPayoutWebhook(event,req.headers['x-signature-signature'],integrationEnvironment().ESIGNATURE_WEBHOOK_SECRET))throw integrationError('توقيع إشعار جهة التوقيع غير صالح',401);
    await db.transaction(async c=>{
      const inserted=await c.query("INSERT INTO webhook_events(provider,event_id,payload) VALUES('esignature',$1,$2) ON CONFLICT DO NOTHING RETURNING event_id",[event.eventId,event]);
      if(inserted.rowCount)await enqueue(c,'SIGNATURE_RECONCILE',{signatureId:event.externalId,eventId:event.eventId},'signature-webhook:'+event.eventId);
    });return reply.code(202).send({accepted:true});
  });
}
