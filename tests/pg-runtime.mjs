// Explicit isolated PostgreSQL verification; never targets a live database.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
if (!process.env.TEST_DATABASE_URL || process.env.CONFIRM_ISOLATED_DATABASE !== 'true')
  throw Error('TEST_DATABASE_URL and CONFIRM_ISOLATED_DATABASE=true are required');
const ownerURL = new URL(process.env.TEST_DATABASE_URL);
const password = randomBytes(32).toString('hex');
const result = spawnSync(process.execPath,['server/provision-runtime.mjs'],{
  encoding:'utf8',env:{...process.env,NODE_ENV:'test',DATABASE_URL:ownerURL.href,DB_APP_PASSWORD:password},
});
assert.equal(result.status,0,result.stderr);
ownerURL.username='habb_runtime';ownerURL.password=password;
process.env.DATABASE_URL=ownerURL.href;
process.env.NODE_ENV='production';
process.env.APP_ORIGIN='https://isolated.example.test';
process.env.COOKIE_SECRET=randomBytes(48).toString('hex');
process.env.ENCRYPTION_KEY=randomBytes(32).toString('hex');
delete process.env.SENTRY_DSN;
const db=await import('../server/db.mjs');
const {createApp}=await import('../server/app.mjs');
const app=await createApp({logger:false});
try {
  assert.equal((await app.inject('/health/ready')).statusCode,200);
  const publicState=await app.inject('/api/state');
  assert.equal(publicState.statusCode,200,publicState.body);
  assert.equal(publicState.json().orders.length,0);
  await assert.rejects(()=>db.query('CREATE TABLE forbidden_runtime_table(id int)'),e=>e.code==='42501');
  await assert.rejects(()=>db.query("UPDATE audit_log SET action='forbidden'"),e=>e.code==='42501');
  await assert.rejects(()=>db.query('TRUNCATE audit_log'),e=>e.code==='42501');
  await assert.rejects(()=>db.query('DELETE FROM schema_migrations'),e=>e.code==='42501');
  console.log(JSON.stringify({runtime:'restricted_postgresql',productionStartup:true,health:200,publicState:200,ddlDenied:true,auditMutationDenied:true,migrationMutationDenied:true}));
} finally {await app.close();await db.pool.end();}
