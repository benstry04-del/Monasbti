import '../server/env.mjs';
import { existsSync } from 'node:fs';
import { spawnSync,spawn } from 'node:child_process';
if(!existsSync('node_modules/vite')){const r=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['ci'],{stdio:'inherit',shell:process.platform==='win32'});if(r.status)process.exit(r.status);}
process.env.DATABASE_URL ||= 'pglite:./data/development';
process.env.NODE_ENV ||= 'development';
if(['production','staging'].includes(process.env.NODE_ENV))throw Error('Use npm run start:production with explicit database and secrets.');
const {migrate}=await import('../server/migrate.mjs');const {query,pool}=await import('../server/db.mjs');const {emptyState}=await import('../server/business.mjs');
await migrate();await query('INSERT INTO app_settings(id,data) VALUES(true,$1) ON CONFLICT DO NOTHING',[emptyState().settings]);await pool.end();
const children=[spawn(process.execPath,['server/app.mjs'],{stdio:'inherit',env:process.env}),spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1'],{stdio:'inherit',env:process.env})];
function stop(){for(const c of children)c.kill();}
process.once('SIGINT',stop);process.once('SIGTERM',stop);for(const c of children)c.on('exit',code=>{if(code){stop();process.exitCode=code;}});
