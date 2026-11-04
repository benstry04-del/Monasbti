import pg from 'pg';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
if (process.env.CONFIRM_ISOLATED_DATABASE !== 'true' || !process.env.TEST_DATABASE_URL || !process.env.TEST_RESTORE_URL)
  throw Error('Explicit isolated source and restored URLs required');
assert.notEqual(process.env.TEST_DATABASE_URL,process.env.TEST_RESTORE_URL);
const source=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL});
const restored=new pg.Pool({connectionString:process.env.TEST_RESTORE_URL});
try {
  const tables=(await source.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
  for (const {tablename} of tables) {
    assert.match(tablename,/^[a-z_]+$/);
    const sql=`SELECT count(*) AS n FROM "${tablename}"`;
    assert.equal((await restored.query(sql)).rows[0].n,(await source.query(sql)).rows[0].n,tablename);
    const digestSQL=`SELECT md5(COALESCE(string_agg(row_text,E'\\n' ORDER BY row_text),'')) AS digest FROM (SELECT row_to_json(t)::text AS row_text FROM "${tablename}" t) x`;
    assert.equal((await restored.query(digestSQL)).rows[0].digest,(await source.query(digestSQL)).rows[0].digest,tablename+' content');
  }
  const contracts=(await restored.query('SELECT document_hash,data FROM contracts')).rows;
  for (const ct of contracts)
    assert.equal(ct.document_hash,createHash('sha256').update(ct.data.html).digest('hex'));
  const migrations=(await restored.query('SELECT name,checksum FROM schema_migrations ORDER BY name')).rows;
  assert.deepEqual(migrations,(await source.query('SELECT name,checksum FROM schema_migrations ORDER BY name')).rows);
  let settlementEvidenceCompared=0;
  if(tables.some(t=>t.tablename==='supplier_settlements')) {
    for(const table of ['supplier_settlements','supplier_settlement_approvals']) {
      const order=table==='supplier_settlements'?'id':'settlement_id,actor_id';
      const sql=`SELECT row_to_json(s)::text AS evidence FROM (SELECT * FROM ${table} ORDER BY ${order}) s`;
      const before=(await source.query(sql)).rows,after=(await restored.query(sql)).rows;
      assert.deepEqual(after,before,table);
      settlementEvidenceCompared+=after.length;
    }
  }
  console.log(JSON.stringify({restored:true,tablesCompared:tables.length,tableContentsVerified:true,contractHashesVerified:contracts.length,migrationChecksums:true,settlementEvidenceCompared}));
} finally {await source.end();await restored.end();}
