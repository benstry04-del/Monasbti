import {spawnSync} from 'node:child_process';
// A local .env with NODE_ENV=development must never ship React's development runtime.
const result=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build'],{
  stdio:'inherit',env:{...process.env,NODE_ENV:'production'},
});
if(result.error)throw result.error;
process.exitCode=result.status ?? 1;
