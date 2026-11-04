import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {withIntegrationEnvironment} from '../server/integration-runtime.mjs';
process.env.DATABASE_URL=process.env.TEST_DATABASE_URL || 'pglite:memory';process.env.NODE_ENV='test';
const db=await import('../server/db.mjs');const {migrate}=await import('../server/migrate.mjs');await migrate();
const {requestSignature,createSignatureEnvelope,reconcileSignature}=await import('../server/signatures.mjs');
const {executeCommand}=await import('../server/business.mjs');
const dir=await mkdtemp(join(tmpdir(),'habb-signature-'));process.env.STORAGE_DIR=dir;
const key=randomBytes(32).toString('hex'),actor={id:'signer',role:'customer',name:'Signer'},env={...process.env,ESIGNATURE_MODE:'bridge',APP_ORIGIN:'https://app.example.test'};
const run=fn=>withIntegrationEnvironment(env,fn),hash=v=>createHash('sha256').update(v).digest('hex');
await db.query("INSERT INTO users(id,email,name,role,password_hash,verified_at) VALUES('signer','signer@example.test','Signer','customer','fixture',now())");
await db.query("INSERT INTO suppliers(id,name) VALUES('sign-vendor','Vendor')");
await db.query("INSERT INTO catalog_services(id,supplier_id,name,capacity,data) VALUES('sign-service','sign-vendor','Service',100,$1)",[{id:'sign-service',supplierId:'sign-vendor',price:10,cost:5,available:true}]);
await db.query("INSERT INTO app_settings(data) VALUES('{}')");
async function booking(id){
  const lines=[{id:'sign-service',supplierId:'sign-vendor',title:'Service',qty:1,price:10,cost:5,response:'CONFIRMED_SUPPLIER'}],html='<html>Frozen terms '+id+'</html>';
  const contract={version:1,status:'APPROVED',snapshot:lines,total:10,html,documentHash:hash(html)};
  await db.query("INSERT INTO bookings(id,customer_id,status,occasion_date,data) VALUES($1,'signer','CONTRACT_APPROVED','2031-01-01',$2)",[id,{id,customerId:'signer',customer:'Signer',status:'CONTRACT_APPROVED',occasion:{date:'2031-01-01'},lines,contract,timeline:[],approvals:[],notes:[]}]);
  await db.query("INSERT INTO contracts(id,booking_id,version,status,document_hash,data) VALUES($1,$2,1,'APPROVED',$3,$4)",[id+':v1',id,hash(html),contract]);
  await db.query("INSERT INTO reservations(booking_id,service_id,event_date,qty,status,expires_at) VALUES($1,'sign-service','2031-01-01',1,'HELD',now()+interval '1 hour')",[id]);
  return contract;
}
after(async()=>{await db.pool.end();assert.equal(dirname(resolve(dir)),resolve(tmpdir()));assert.ok(basename(dir).startsWith('habb-signature-'));await rm(dir,{recursive:true,force:true});});
let request,contract;
const pdf=Buffer.from('%PDF-1.7\nIsolated provider proof fixture\n');
let status='PENDING',calls=0;
const provider={assertConfigured(){},async create(){calls++;throw Error('lost provider response');},async lookup(id){return{id:'provider-'+id,externalId:id,documentHash:contract.documentHash,signerEmail:'signer@example.test',status,signingURL:'https://sign.example.test/private-token',signerName:'Verified Signer',completedAt:new Date().toISOString(),signedDocumentHash:hash(pdf)};},signingURL:url=>url,async document(){return pdf;}};
test('external consent is bound to the owned frozen version and uncertain creation is not repeated',async()=>{
  contract=await booking('signature-one');
  await assert.rejects(()=>run(()=>requestSignature(db,{...actor,id:'other'},{bookingId:'signature-one',consent:true,signature:'Signer'},{provider})),e=>e.statusCode===404);
  request=await run(()=>requestSignature(db,actor,{bookingId:'signature-one',consent:true,signature:'Signer'},{provider}));
  const replay=await run(()=>requestSignature(db,actor,{bookingId:'signature-one',consent:true,signature:'Signer'},{provider}));assert.equal(replay.id,request.id);
  await assert.rejects(()=>run(()=>createSignatureEnvelope(db,request.id,key,provider)));
  await run(()=>createSignatureEnvelope(db,request.id,key,provider));assert.equal(calls,1);
  const row=(await db.query('SELECT * FROM signature_requests WHERE id=$1',[request.id])).rows[0];assert.equal(row.status,'READY');assert.ok(!row.signing_url_ciphertext.includes('private-token'));
  assert.equal((await db.query("SELECT status FROM contracts WHERE id='signature-one:v1'")).rows[0].status,'APPROVED');
});
test('verified completion stores the signed PDF and signs exactly once without rewriting frozen terms',async()=>{
  status='COMPLETED';await run(()=>reconcileSignature(db,request.id,key,provider));await run(()=>reconcileSignature(db,request.id,key,provider));
  const row=(await db.query("SELECT * FROM contracts WHERE id='signature-one:v1'")).rows[0];assert.equal(row.status,'SIGNED');assert.equal(row.document_hash,contract.documentHash);assert.equal(row.data.externalSignature.sha256,hash(pdf));
  assert.equal((await db.query('SELECT * FROM files WHERE id=$1',[request.id])).rowCount,1);
  await assert.rejects(()=>db.query("UPDATE contracts SET status='APPROVED' WHERE id='signature-one:v1'"),/immutable/);
});
test('wrong signer or document proof cannot sign a contract',async()=>{
  contract=await booking('signature-wrong');const row=await run(()=>requestSignature(db,actor,{bookingId:'signature-wrong',consent:true,signature:'Signer'},{provider}));
  const bad={...provider,lookup:async id=>({...await provider.lookup(id),signerEmail:'attacker@example.test'})};
  await assert.rejects(()=>run(()=>reconcileSignature(db,row.id,key,bad)),e=>e.code==='SIGNATURE_MISMATCH');
  assert.equal((await db.query("SELECT status FROM contracts WHERE id='signature-wrong:v1'")).rows[0].status,'APPROVED');
});
test('a cancellation during external signing is retained for review and never silently confirms availability',async()=>{
  contract=await booking('signature-cancel');const row=await run(()=>requestSignature(db,actor,{bookingId:'signature-cancel',consent:true,signature:'Signer'},{provider}));
  await db.query("UPDATE bookings SET status='CANCELLED',data=jsonb_set(data,'{status}','\"CANCELLED\"') WHERE id='signature-cancel'");
  await run(()=>reconcileSignature(db,row.id,key,provider));
  assert.equal((await db.query('SELECT status FROM signature_requests WHERE id=$1',[row.id])).rows[0].status,'MANUAL_REVIEW');
  assert.equal((await db.query("SELECT status FROM bookings WHERE id='signature-cancel'")).rows[0].status,'CANCELLED');
});
test('a pending provider request cannot be bypassed by switching the client back to local signing',async()=>{
  contract=await booking('signature-bypass');await run(()=>requestSignature(db,actor,{bookingId:'signature-bypass',consent:true,signature:'Signer'},{provider}));
  await assert.rejects(()=>withIntegrationEnvironment({...env,ESIGNATURE_MODE:'clickwrap'},()=>db.transaction(c=>executeCommand(c,actor,'visitor','SIGN',{id:'signature-bypass',consent:true,signature:'Signer'},randomUUID()))),e=>e.statusCode===409 && /جهة التوقيع/.test(e.message));
});
