import '../server/env.mjs';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
const schema=z.object({
  companyName:z.string().trim().min(2).max(200),
  registrationNumber:z.string().trim().min(1).max(100),
  contactEmail:z.email(),contactPhone:z.string().regex(/^\+?[\d ()-]{8,24}$/),
  terms:z.string().trim().min(20).max(50000),
  privacy:z.string().trim().min(20).max(50000),
  cancellation:z.string().trim().min(20).max(50000),
  taxRate:z.number().min(0).max(100),deposit:z.number().min(0).max(100),
  second:z.number().min(0).max(100),threshold:z.number().min(0).max(100),
  earlyPayment:z.boolean(),doubleApproval:z.literal(true),
}).strict().refine(v=>v.deposit+v.second<=100,{message:'Payment percentages exceed100'});
const result=schema.safeParse(JSON.parse(await readFile('data/business-settings.json','utf8')));
if(!result.success) {
  console.error(JSON.stringify({error:'Complete and review the business settings first',fields:result.error.issues.map(i=>i.path.join('.') || 'paymentSchedule')}));
  process.exitCode=1;
} else {
  const db=await import('../server/db.mjs');
  try {
    const owner=(await db.query("SELECT id,name,email,role FROM users WHERE role='admin' AND active=true AND verified_at IS NOT NULL ORDER BY created_at LIMIT 1")).rows[0];
    if(!owner)throw Error('Bootstrap a verified owner before applying business settings');
    const {executeCommand}=await import('../server/business.mjs');
    await db.transaction(c=>executeCommand(c,owner,'operator-cli','SETTINGS',result.data,randomUUID()));
    console.log(JSON.stringify({businessSettings:'applied',auditRecorded:true}));
  } finally {await db.pool.end();}
}
