import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,basename,resolve} from 'node:path';
import {prepareConfiguration} from '../scripts/prepare-configuration.mjs';
test('configuration preparation generates private stable keys and preserves existing operator files',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'habb-config-'));
  try {
    await mkdir(join(dir,'config'));
    await writeFile(join(dir,'.env.example'),'COOKIE_SECRET=\nENCRYPTION_KEY=\nMETRICS_TOKEN=\nMYFATOORAH_API_KEY=\n');
    await writeFile(join(dir,'config/business.example.json'),'{}');
    assert.ok((await prepareConfiguration(dir)).every(x=>x.status==='created'));
    const env=await readFile(join(dir,'.env'),'utf8');
    assert.match(env,/COOKIE_SECRET=[a-f0-9]{96}/);
    assert.match(env,/ENCRYPTION_KEY=[a-f0-9]{64}/);
    assert.match(env,/MYFATOORAH_API_KEY=\n/);
    assert.ok((await prepareConfiguration(dir)).every(x=>x.status==='preserved'));
    assert.equal(await readFile(join(dir,'.env'),'utf8'),env);
  }finally{
    assert.equal(dirname(resolve(dir)),resolve(tmpdir()));
    assert.ok(basename(dir).startsWith('habb-config-'));
    await rm(dir,{recursive:true,force:true});
  }
});
