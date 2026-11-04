import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
process.env.DATABASE_URL ||= 'pglite:memory';
process.env.NODE_ENV ||= 'test';
const { query, pool, transaction } = await import('../server/db.mjs');
const { migrate } = await import('../server/migrate.mjs');
await migrate();
after(async () => { await pool.end(); });
test('migrations have immutable checksums and are safely repeatable', async () => {
  const before = await query('SELECT name,checksum FROM schema_migrations ORDER BY name');
  await migrate();
  assert.deepEqual((await query('SELECT name,checksum FROM schema_migrations ORDER BY name')).rows,before.rows);
  assert.ok(before.rows.length > 0);
});
test('email uniqueness ignores case and roles have database constraints', async () => {
  const id=randomUUID(), email=`DB-${id}@example.test`;
  await query("INSERT INTO users(id,email,name,role,password_hash) VALUES($1,$2,'database test','customer','invalid-test-hash')",[id,email]);
  await assert.rejects(()=>query("INSERT INTO users(id,email,name,role,password_hash) VALUES($1,$2,'duplicate','customer','hash')",[randomUUID(),email.toLowerCase()]), e=>e.code==='23505');
  await assert.rejects(()=>query("INSERT INTO users(id,email,name,role,password_hash) VALUES($1,$2,'bad role','superuser','hash')",[randomUUID(),`${randomUUID()}@example.test`]),e=>e.code==='23514');
});
test('transaction rollback cannot leave a partial booking workspace', async()=>{
  const id=`rollback-${randomUUID()}`;
  await assert.rejects(()=>transaction(async client=>{
    await client.query('INSERT INTO workspaces(id,data) VALUES($1,$2)',[id,{cart:['not-committed']}]);
    throw Error('abort workflow');
  }),/abort workflow/);
  assert.equal((await query('SELECT id FROM workspaces WHERE id=$1',[id])).rows.length,0);
});
test('audit records reject mutation and deletion',async()=>{
  const id=randomUUID();
  await query("INSERT INTO audit_log(id,action,resource_type,resource_id) VALUES($1,'TEST','test',$2)",[id,id]);
  await assert.rejects(()=>query("UPDATE audit_log SET action='FORGED' WHERE id=$1",[id]),/append only/);
  await assert.rejects(()=>query('DELETE FROM audit_log WHERE id=$1',[id]),/append only/);
});
test('concurrent transactions serialize shared updates without lost writes',async()=>{
  const id=`concurrent-${randomUUID()}`;
  await query('INSERT INTO workspaces(id,data) VALUES($1,$2)',[id,{counter:0}]);
  await Promise.all(Array.from({length:5},()=>transaction(async client=>{
    const {rows}=await client.query('SELECT data FROM workspaces WHERE id=$1 FOR UPDATE',[id]);
    await client.query('UPDATE workspaces SET data=$2 WHERE id=$1',[id,{counter:rows[0].data.counter+1}]);
  },{attempts:8})));
  assert.equal((await query('SELECT data FROM workspaces WHERE id=$1',[id])).rows[0].data.counter,5);
});
test('untrusted values are bound as parameters, not interpreted as SQL',async()=>{
  const malicious=`'; DROP TABLE users; -- ${randomUUID()}`;
  await query('INSERT INTO workspaces(id,data) VALUES($1,$2)',[malicious,{test:true}]);
  assert.equal((await query('SELECT id FROM workspaces WHERE id=$1',[malicious])).rows[0].id,malicious);
  assert.ok((await query("SELECT tablename FROM pg_tables WHERE tablename='users'")).rows.length);
});
test('reservation quantities and financial amounts reject invalid values',async()=>{
  const {rows}=await query("SELECT conname FROM pg_constraint WHERE conname IN ('reservations_qty_check','payments_amount_minor_check','order_lines_qty_check')");
  assert.equal(rows.length,3);
  await assert.rejects(()=>query("INSERT INTO catalog_services(id,name,capacity) VALUES($1,'invalid capacity',0)",[randomUUID()]),e=>e.code==='23514');
});
