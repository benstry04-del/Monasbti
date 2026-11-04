import test from 'node:test';
import assert from 'node:assert/strict';
import {createSerialExecutor} from '../src/services/serial-mutations.mjs';
test('mutations preserve submitted order and one failed operation does not stall later work',async()=>{
  const execute=createSerialExecutor(),events=[];
  let release;
  const blocked=new Promise(resolve=>release=resolve);
  const first=execute(async()=>{events.push('first:start');await blocked;events.push('first:end');});
  const second=execute(async()=>{events.push('second');throw Error('expected failure');});
  const rejection=assert.rejects(second,/expected failure/);
  const third=execute(async()=>{events.push('third');return 'persisted';});
  await Promise.resolve();
  assert.deepEqual(events,['first:start']);
  release();
  await first;await rejection;
  assert.equal(await third,'persisted');
  assert.deepEqual(events,['first:start','first:end','second','third']);
});
