import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {hashPassword} from '../server/security.mjs';
process.env.DATABASE_URL=process.env.TEST_DATABASE_URL || 'pglite:memory';process.env.NODE_ENV='test';
const db=await import('../server/db.mjs');const {migrate}=await import('../server/migrate.mjs');await migrate();
const {saveIntegrationSettings,listIntegrationSettings,checkIntegrationSettings}=await import('../server/admin-integrations.mjs');
const {loadIntegrationEnvironment,withIntegrationEnvironment,integrationEnvironment}=await import('../server/integration-runtime.mjs');
const {MyFatoorahProvider}=await import('../server/providers/payments.mjs');
const password='Owner-settings-passphrase!',key=randomBytes(32).toString('hex'),owner={id:'config-owner',role:'admin',mfaVerified:false};
await db.query("INSERT INTO users(id,email,name,role,password_hash,verified_at) VALUES($1,'owner@example.test','Owner','admin',$2,now())",[owner.id,await hashPassword(password)]);
after(()=>db.pool.end());
const secret='private-key-only-in-encrypted-database-12345';
test('configuration requires verified owner and password; secrets never appear in metadata or audit',async()=>{
  const input={revision:0,password,values:{MYFATOORAH_ENVIRONMENT:'sandbox',MYFATOORAH_API_KEY:secret,MYFATOORAH_WEBHOOK_SECRET:'webhook-secret-for-tests-only'},clearSecrets:[]};
  await assert.rejects(()=>saveIntegrationSettings(db,{...owner,role:'staff'},key,'payments',input),e=>e.statusCode===403);
  await assert.rejects(()=>saveIntegrationSettings(db,owner,key,'payments',{...input,password:'wrong'}),e=>e.statusCode===403);
  await saveIntegrationSettings(db,owner,key,'payments',input);
  const row=(await db.query("SELECT * FROM integration_settings WHERE id='payments'")).rows[0];
  assert.equal(row.enabled,false);assert.ok(!row.ciphertext.includes(secret));
  const metadata=await listIntegrationSettings(db,key);
  assert.ok(!JSON.stringify(metadata).includes(secret));
  assert.equal(metadata.find(i=>i.id==='payments').fields.find(f=>f.name==='MYFATOORAH_API_KEY').configured,true);
  assert.ok(!JSON.stringify((await db.query('SELECT * FROM audit_log')).rows).includes(secret));
  await assert.rejects(()=>saveIntegrationSettings(db,owner,key,'payments',input),e=>e.statusCode===409);
});
test('activation probes before switching live configuration; new drafts do not replace active secrets',async()=>{
  const before=await loadIntegrationEnvironment(db,key,{force:true});
  assert.notEqual(before.MYFATOORAH_API_KEY,secret);
  const probe=async(id,values)=>{assert.equal(id,'payments');assert.equal(values.MYFATOORAH_API_KEY,secret);return{ok:true,message:'اختبار معزول دون دفع'};};
  const result=await checkIntegrationSettings(db,owner,key,'payments',{password,revision:1},{activate:true,probe});assert.equal(result.activated,true);
  let env=await loadIntegrationEnvironment(db,key,{force:true});assert.equal(env.MYFATOORAH_API_KEY,secret);
  await saveIntegrationSettings(db,owner,key,'payments',{password,revision:1,values:{MYFATOORAH_API_KEY:'draft-key-not-active'},clearSecrets:[]});
  env=await loadIntegrationEnvironment(db,key,{force:true});assert.equal(env.MYFATOORAH_API_KEY,secret);
  const failed=await checkIntegrationSettings(db,owner,key,'payments',{password,revision:2},{activate:true,probe:async()=>{throw Error('secret should not be shown '+secret);}});
  assert.equal(failed.activated,false);assert.ok(!failed.message.includes(secret));
  assert.equal((await loadIntegrationEnvironment(db,key,{force:true})).MYFATOORAH_API_KEY,secret);
});
test('disabled new payments retain credentials for authoritative reconciliation and request contexts stay isolated',async()=>{
  await db.query("UPDATE integration_settings SET enabled=false WHERE id='payments'");
  const env=await loadIntegrationEnvironment(db,key,{force:true});
  assert.equal(env.MYFATOORAH_API_KEY,secret);assert.equal(env.INTEGRATION_PAYMENTS_ENABLED,'false');
  withIntegrationEnvironment(env,()=>{
    const provider=new MyFatoorahProvider();provider.assertConfigured();
    assert.throws(()=>provider.assertConfigured({forNewPayment:true}),/إيقاف/);
  });
  const result=await Promise.all([withIntegrationEnvironment({isolated:'a'},async()=>{await new Promise(r=>setTimeout(r,10));return integrationEnvironment().isolated;}),withIntegrationEnvironment({isolated:'b'},async()=>integrationEnvironment().isolated)]);
  assert.deepEqual(result,['a','b']);assert.notEqual(integrationEnvironment().isolated,'a');
});
test('explicit secret clearing is stored without falling back to an inherited key; ciphertext is bound to its integration',async()=>{
  await saveIntegrationSettings(db,owner,key,'payments',{password,revision:2,values:{MYFATOORAH_API_KEY:''},clearSecrets:['MYFATOORAH_API_KEY']});
  const metadata=await listIntegrationSettings(db,key);
  assert.equal(metadata.find(i=>i.id==='payments').fields.find(f=>f.name==='MYFATOORAH_API_KEY').configured,false);
  const row=(await db.query("SELECT ciphertext FROM integration_settings WHERE id='payments'")).rows[0];
  await db.query("INSERT INTO integration_settings(id,ciphertext) VALUES('email',$1)",[row.ciphertext]);
  await assert.rejects(()=>listIntegrationSettings(db,key),/binding/);
  await db.query("DELETE FROM integration_settings WHERE id='email'");
});
test('revision changed during an external probe cannot activate an obsolete draft',async()=>{
  await assert.rejects(()=>checkIntegrationSettings(db,owner,key,'payments',{password,revision:3},{activate:true,probe:async()=>{
    await saveIntegrationSettings(db,owner,key,'payments',{password,revision:3,values:{MYFATOORAH_API_KEY:'newer-draft'},clearSecrets:[]});return{ok:true,message:'stale'};
  }}),e=>e.statusCode===409);
  const row=(await db.query("SELECT revision,active_revision FROM integration_settings WHERE id='payments'")).rows[0];
  assert.equal(row.revision,4);assert.equal(row.active_revision,1);
});
