// Explicit isolated PostgreSQL benchmark. Never points at the application database.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import autocannon from 'autocannon';
const url=process.env.TEST_DATABASE_URL;
assert.equal(process.env.CONFIRM_ISOLATED_DATABASE,'true');
assert.match(new URL(url).pathname,/^\/habb_load_[a-z0-9_]+$/);
process.env.DATABASE_URL=url;process.env.NODE_ENV='test';process.env.APP_ORIGIN='http://127.0.0.1:4319';
const db=await import('../server/db.mjs');const {migrate}=await import('../server/migrate.mjs');
const {tokenHash}=await import('../server/security.mjs');
await migrate();
assert.equal(Number((await db.query('SELECT count(*) FROM users')).rows[0].count),0);
await db.query("INSERT INTO users(id,email,name,role,password_hash,verified_at) VALUES('load-owner','load@test.invalid','اختبار ضغط','admin','unused',now())");
await db.query(`INSERT INTO bookings(id,customer_id,status,occasion_date,data,created_at)
 SELECT 'load-'||n,'load-owner','REQUESTED','2027-01-01',jsonb_build_object('id','load-'||n,'customer','اختبار ضغط','status','REQUESTED','occasion',jsonb_build_object('date','2027-01-01'),'lines','[]'::jsonb),now()-n*interval '1 second' FROM generate_series(1,10000) n`);
const raw=randomBytes(32).toString('base64url');
await db.query("INSERT INTO sessions(id,user_id,csrf_token,expires_at,mfa_verified) VALUES($1,'load-owner','load-csrf',now()+interval '1 hour',true)",[tokenHash(raw)]);
const {createApp}=await import('../server/app.mjs');const app=await createApp({logger:false,testRateLimitMax:100000});
const failures={};app.addHook('onError',async(req,reply,error)=>{const key=error.code || error.message;failures[key]=(failures[key] || 0)+1;});
const statuses={};app.addHook('onResponse',async(req,reply)=>{statuses[reply.statusCode]=(statuses[reply.statusCode] || 0)+1;});
try{
 await app.listen({host:'127.0.0.1',port:4319});
 const cookie='habb_session='+encodeURIComponent(app.signCookie(raw));
 const preflight=await app.inject({url:'/api/records/bookings?page=200',headers:{cookie}});assert.equal(preflight.statusCode,200);assert.equal(preflight.json().total,10000);assert.equal(preflight.json().items.length,25);
 const result=await new Promise((resolve,reject)=>autocannon({url:'http://127.0.0.1:4319/api/records/bookings?page=200',connections:12,duration:10,headers:{cookie}},(error,result)=>error?reject(error):resolve(result)));
 const overviewPreflight=await app.inject({url:'/api/state?route=%2Fadmin',headers:{cookie}});
 assert.equal(overviewPreflight.statusCode,200);assert.ok(overviewPreflight.json().orders.length<=13);assert.equal(overviewPreflight.json().analytics.newOrders,10000);
 const overview=await new Promise((resolve,reject)=>autocannon({url:'http://127.0.0.1:4319/api/state?route=%2Fadmin',connections:12,duration:10,headers:{cookie}},(error,result)=>error?reject(error):resolve(result)));
 assert.equal(overview.errors+overview.timeouts+overview.non2xx,0);assert.ok(overview.latency.p99<2000);
 const report={overview:{requestsPerSecond:overview.requests.average,p99Ms:overview.latency.p99,errors:overview.errors,timeouts:overview.timeouts,non2xx:overview.non2xx},at:new Date().toISOString(),database:'PostgreSQL',bookings:10000,connections:12,durationSeconds:result.duration,requests:result.requests.total,requestsPerSecond:result.requests.average,latencyMs:{average:result.latency.average,p99:result.latency.p99,max:result.latency.max},failures,statuses,errors:result.errors,timeouts:result.timeouts,non2xx:result.non2xx,note:'Loopback capacity benchmark; API quota raised only through test-only app option. Not a production hosting SLA.'};
 await writeFile('docs/production/load-records.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 assert.equal(result.errors+result.timeouts+result.non2xx,0);
 assert.ok(result.latency.p99<2000,'Local p99 exceeded 2 seconds');
}finally{await app.close();await db.pool.end();}

