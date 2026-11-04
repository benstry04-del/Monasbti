import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { hashPassword, verifyPassword, tokenHash, encryptSecret, decryptSecret, encodeBase32, totp, verifyTotp } from '../server/security.mjs';
import { getConfig } from '../server/config.mjs';
import { createApp } from '../server/app.mjs';
process.env.DATABASE_URL = 'pglite:memory';
process.env.NODE_ENV = 'test';
let app, db;
const cfg = getConfig({ NODE_ENV: 'test', COOKIE_SECRET: 'a'.repeat(48), ENCRYPTION_KEY: 'bc'.repeat(32), APP_ORIGIN: 'http://localhost:5173' });
before(async () => {
  db = await import('../server/db.mjs');
  const { migrate } = await import('../server/migrate.mjs'); await migrate();
  app = await createApp({ db, config: cfg, logger: false, registerIntegrations: false, business: {
    readState: async (_client, actor) => ({ session: actor, services: [], packages: [] }),
    executeCommand: async (_client, actor, _visitor, action) => ({ actor, action }),
  } });
  await app.ready();
});
after(async () => { await app?.close(); await db?.pool.end(); });
function browser() {
  const jar = new Map(); let csrfToken;
  return {
    async request(method, url, payload, headers = {}) {
      const response = await app.inject({ method, url, payload, headers: { origin: cfg.appOrigin, cookie: [...jar].map(([key,value]) => `${key}=${value}`).join('; '), ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}), ...headers } });
      for (const cookie of response.cookies) { if (cookie.value) jar.set(cookie.name, cookie.value); else jar.delete(cookie.name); }
      let body; try { body = response.json(); } catch { body = response.body; }
      if (body.csrfToken) csrfToken = body.csrfToken;
      return { response, body, status: response.statusCode };
    },
  };
}
async function signup(client, suffix) {
  await client.request('GET', '/api/auth/session');
  const email = `test-${suffix}@example.test`, password = 'A secure passphrase 2026!';
  const result = await client.request('POST','/api/auth/register',{ email, password, name: 'عميل الاختبار', mobile: '+96550001234' });
  assert.equal(result.status, 202, JSON.stringify(result.body));
  const job = (await db.query("SELECT payload FROM outbox WHERE job_type='EMAIL' AND payload->>'to'=$1 ORDER BY created_at DESC LIMIT 1", [email])).rows[0];
  const code = job.payload.text.match(/: (\d{6})/)[1];
  return { email, password, code };
}

test('scrypt salts passwords and verifies without accepting malformed formats', async () => {
  const a = await hashPassword('password phrase 123'), b = await hashPassword('password phrase 123');
  assert.notEqual(a,b); assert.equal(await verifyPassword('password phrase 123',a),true);
  assert.equal(await verifyPassword('wrong',a),false); assert.equal(await verifyPassword('x','sha256$unacceptable'),false);
});
test('AES-GCM protects MFA secrets and rejects altered ciphertext', () => {
  const key = randomBytes(32).toString('hex'), encrypted = encryptSecret('TOP-SECRET',key);
  assert.equal(decryptSecret(encrypted,key),'TOP-SECRET');
  const [iv,tag,value] = encrypted.split('.');
  assert.throws(()=>decryptSecret(`${iv}.${tag}.${Buffer.from('tampered').toString('base64url')}`,key));
});
test('TOTP matches RFC secret and rejects replayed time step', () => {
  const secret = encodeBase32(Buffer.from('12345678901234567890'));
  assert.equal(totp(secret,1),'287082');
  assert.equal(verifyTotp(secret,'287082',-1,59000),1);
  assert.equal(verifyTotp(secret,'287082',1,59000),null);
});
test('production configuration refuses missing secrets and HTTP origins', () => {
  assert.throws(()=>getConfig({ NODE_ENV:'production' }),/APP_ORIGIN/);
  assert.throws(()=>getConfig({ NODE_ENV:'production', APP_ORIGIN:'http://example.test' }),/HTTPS/);
  assert.throws(()=>getConfig({ NODE_ENV:'staging', APP_ORIGIN:'http://example.test' }),/HTTPS/);
  assert.throws(()=>getConfig({ NODE_ENV:'staging', APP_ORIGIN:'https://staging.example.test' }),/COOKIE_SECRET/);
});
test('CSRF validates both origin and unpredictable token before mutation', async () => {
  const client = browser();
  let r = await client.request('POST','/api/auth/logout',{});
  assert.equal(r.status,403);
  assert.match(String(r.response.headers['set-cookie']),/HttpOnly/);
  r = await client.request('GET','/api/auth/session'); assert.equal(r.status,200); assert.equal(r.body.user,null);
  assert.ok(r.body.csrfToken.length>=40);
  r = await client.request('POST','/api/auth/logout',{}, { origin:'https://attacker.test' }); assert.equal(r.status,403);
  r = await client.request('POST','/api/auth/logout',{}); assert.equal(r.status,200);
});
test('registration validates server input, forces customer role, stores scrypt and no session before verification', async () => {
  const client = browser(); await client.request('GET','/api/auth/session');
  let r = await client.request('POST','/api/auth/register',{ email:'bad', password:'weak',name:'a',mobile:'1234' }); assert.equal(r.status,400);
  r = await client.request('POST','/api/auth/register',{email:'escalate@example.test',password:'Very secure pass 2026',name:'Escalation',mobile:'50001234',role:'admin'}); assert.equal(r.status,400);
  const account = await signup(client,'registered');
  const user = (await db.query('SELECT * FROM users WHERE email=$1',[account.email])).rows[0];
  assert.match(user.password_hash,/^scrypt\$/); assert.equal(user.role,'customer'); assert.equal(user.verified_at,null);
  r = await client.request('GET','/api/auth/session'); assert.equal(r.body.user,null);
  r = await client.request('POST','/api/auth/login',{email:account.email,password:account.password}); assert.equal(r.status,403);
  r = await client.request('POST','/api/auth/verify',{email:account.email,code:account.code}); assert.equal(r.status,200); assert.equal(r.body.user.email,account.email);
  const session = (await db.query('SELECT * FROM sessions WHERE user_id=$1',[user.id])).rows[0]; assert.equal(session.id.length,64); assert.notEqual(session.id,r.body.csrfToken);
  r = await client.request('POST','/api/auth/verify',{email:account.email,code:account.code}); assert.equal(r.status,400);
});
test('verification code locks after five failed attempts', async () => {
  const client = browser(), account = await signup(client,'locked');
  const wrong = account.code === '000000' ? '111111' : '000000';
  for(let i=0;i<5;i++) assert.equal((await client.request('POST','/api/auth/verify',{email:account.email,code:wrong})).status,400);
  assert.equal((await client.request('POST','/api/auth/verify',{email:account.email,code:account.code})).status,400);
});
test('password reset is single-use, queued and revokes all existing sessions', async () => {
  const client = browser(), account = await signup(client,'recovery');
  await client.request('POST','/api/auth/verify',{email:account.email,code:account.code});
  let r = await client.request('POST','/api/auth/forgot-password',{email:account.email}); assert.equal(r.status,202);
  const job = (await db.query("SELECT payload FROM outbox WHERE payload->>'to'=$1 AND payload->>'subject' LIKE '%استعادة%' ORDER BY created_at DESC LIMIT 1",[account.email])).rows[0];
  const raw = job.payload.text.match(/token=([\w-]+)/)[1]; assert.ok(raw.length>=40);
  assert.equal((await db.query('SELECT token_hash FROM auth_tokens WHERE token_hash=$1',[tokenHash(raw)])).rows.length,1);
  r = await client.request('POST','/api/auth/reset-password',{token:raw,password:'New secure passphrase 2026!'}); assert.equal(r.status,200);
  r = await client.request('GET','/api/auth/session'); assert.equal(r.body.user,null);
  r = await client.request('POST','/api/auth/reset-password',{token:raw,password:'Another secure passphrase!'}); assert.equal(r.status,400);
  r = await client.request('POST','/api/auth/login',{email:account.email,password:account.password}); assert.equal(r.status,401);
  r = await client.request('POST','/api/auth/login',{email:account.email,password:'New secure passphrase 2026!'}); assert.equal(r.status,200);
});
test('all roles log in directly with passwords, including previously enrolled accounts',async()=>{
  const password='Direct login passphrase 2026!';
  await db.query("INSERT INTO suppliers(id,name) VALUES('direct-login-vendor','مورد اختبار')");
  for(const role of ['customer','supplier','staff','admin']){
    const id='direct-'+role,client=browser();await client.request('GET','/api/auth/session');
    await db.query("INSERT INTO users(id,email,name,role,supplier_id,password_hash,verified_at,mfa_secret) VALUES($1,$2,$1,$3,$4,$5,now(),'legacy-encrypted-authenticator')",[id,id+'@example.test',role,role==='supplier'?'direct-login-vendor':null,await hashPassword(password)]);
    const response=await client.request('POST','/api/auth/login',{email:id+'@example.test',password});
    assert.equal(response.status,200);assert.equal(response.body.user.role,role);assert.equal(response.body.user.mfaVerified,false);
    assert.equal(response.body.mfaRequired,undefined);assert.equal(response.body.mfaEnrollmentRequired,undefined);assert.equal(response.body.secret,undefined);
    assert.equal((await client.request('GET','/api/auth/session')).body.user.role,role);
    assert.equal((await client.request('POST','/api/auth/mfa/complete',{challengeId:'obsolete-challenge',code:'000000'})).status,404);
    assert.equal((await client.request('GET','/api/records/users')).status,role==='admin'?200:403);
  }
});

test('command transport requires idempotency and rejects card data at the API boundary', async()=>{
  const client=browser();await client.request('GET','/api/auth/session');
  let r=await client.request('POST','/api/commands',{action:'PLANNER',payload:{}});assert.equal(r.status,400);
  r=await client.request('POST','/api/commands',{action:'PAY',payload:{cardNumber:'4111111111111111'}},{'idempotency-key':'test-card-123'});assert.equal(r.status,400);
  r=await client.request('POST','/api/commands',{action:'PLANNER',payload:{}},{'idempotency-key':'test-safe-123'});assert.equal(r.status,200);
});
test('reports and audit enforce real server authorization; health reflects database availability',async()=>{
  const client=browser();
  assert.equal((await client.request('GET','/api/reports')).status,401);
  assert.equal((await client.request('GET','/api/audit')).status,401);
  assert.equal((await client.request('GET','/health/live')).status,200);
  assert.equal((await client.request('GET','/health/ready')).status,200);
  const receipt=(await db.query("SELECT * FROM schema_migrations WHERE name='003_supplier_settlements.sql'")).rows[0];
  await db.query("DELETE FROM schema_migrations WHERE name=$1",[receipt.name]);
  try { assert.equal((await client.request('GET','/health/ready')).status,503); }
  finally { await db.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)',[receipt.name,receipt.checksum]); }
});

