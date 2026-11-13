import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const testStorage = await mkdtemp(join(tmpdir(),"habb-enhancement-"));
process.env.STORAGE_DIR = testStorage;
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "pglite:memory";
process.env.ENABLE_DEMO = "true";
process.env.DEV_DEMO_PASSWORD = "Enhancements fixture password!";
const db = await import("../server/db.mjs");
const { migrate } = await import("../server/migrate.mjs");
const { seedDemo } = await import("../server/seed-demo.mjs");
const { createApp } = await import("../server/app.mjs");
await migrate();
await seedDemo();
const app = await createApp({ logger:false });
after(async () => { await app.close(); await db.pool.end(); await rm(testStorage,{recursive:true,force:true}); });
const origin = "http://localhost:5173";

async function browser(role) {
  const cookies = new Map();
  let csrf;
  async function call(method,url,payload,extraHeaders={}) {
    const response = await app.inject({method,url,payload,headers:{
      origin, "x-csrf-token":csrf || "", "idempotency-key":randomUUID(),
      cookie:[...cookies].map(([key,value])=>key+"="+value).join("; "), ...extraHeaders,
    }});
    for (const cookie of response.cookies) {
      if (cookie.value) cookies.set(cookie.name,cookie.value);
      else cookies.delete(cookie.name);
    }
    const body = response.headers["content-type"]?.includes("json") ? response.json() : response.body;
    if (body?.csrfToken) csrf=body.csrfToken;
    return {status:response.statusCode,body};
  }
  await call("GET","/api/auth/session");
  if (role) assert.equal((await call("POST","/api/auth/login",{email:role+"@demo.kw",password:process.env.DEV_DEMO_PASSWORD})).status,200);
  return { get:url=>call("GET",url), post:(url,data,headers)=>call("POST",url,data,headers), command:(action,payload={})=>call("POST","/api/commands",{action,payload}) };
}

test("guest plans and keeps one configured package after registration",async()=>{
  const guest=await browser();
  const catalog=(await guest.get("/api/state")).body;
  const pack=catalog.packages.find(item=>item.serviceIds.length);
  assert.equal((await guest.command("PLANNER",{date:"2036-02-10",location:"حولي",guests:80})).status,200);
  assert.equal((await guest.command("CART_PACKAGE",{id:pack.id,qty:2})).status,409);
  const added=await guest.command("CART_PACKAGE",{id:pack.id,guests:80});
  assert.equal(added.status,200,JSON.stringify(added.body));
  assert.equal((await guest.command("CART_PACKAGE",{id:pack.id})).status,409);
  assert.equal((await guest.command("SUBMIT")).status,403);
  assert.equal((await guest.post("/api/auth/register",{email:"guest-enhancement@example.test",name:"Guest test",mobile:"96555551234",password:"Valid test password!"})).status,201);
  const account=(await guest.get("/api/state")).body;
  assert.equal(account.planner.location,"حولي");
  assert.equal(account.cart.length,pack.serviceIds.length);
  assert.ok(account.cart.every(line=>line.qty===1 && line.packageId===pack.id));
});

test("scoped staff creates a customer booking and only permitted reads and actions succeed",async()=>{
  const admin=await browser("admin");
  const staff=await browser("staff");
  const role=await admin.post("/api/backoffice/roles",{name:"Bookings",active:true,permissions:["orders.create","orders.view","customers.view"]});
  assert.equal(role.status,200,JSON.stringify(role.body));
  assert.equal((await admin.post("/api/backoffice/role-assignments",{userId:"staff",roleId:role.body.id})).status,200);
  assert.equal((await admin.post("/api/backoffice/roles",{id:role.body.id,name:"Bookings",active:false,permissions:[]})).status,409);
  assert.equal((await staff.get("/api/records/customers")).status,200);
  assert.equal((await staff.get("/api/records/bookings/export")).status,403);
  assert.equal((await staff.get("/api/report-summary")).status,403);
  assert.equal((await staff.get("/api/backoffice/roles")).status,403);
  const input={customerId:"customer",occasion:{type:"حفل زفاف",date:"2036-02-11",location:"حولي",guests:20},items:[{id:"s1",kind:"service",qty:1}]};
  assert.equal((await staff.command("ASSISTED_SUBMIT",{...input,discount:1})).status,403);
  const created=await staff.command("ASSISTED_SUBMIT",input);
  assert.equal(created.status,200,JSON.stringify(created.body));
  const id=created.body.activeOrder;
  const order=(await staff.get("/api/records/bookings?id="+id)).body.items[0];
  assert.equal(order.createdBy,"staff");
  assert.equal(order.customerId,"customer");
  assert.ok(!Object.hasOwn(order.lines[0],"cost"));
  const customer=await browser("customer");
  assert.equal((await customer.get("/api/records/bookings?id="+id)).body.items[0].id,id);
  assert.equal((await staff.command("APPROVE_INTERNAL",{id,reason:"Denied"})).status,403);

  await admin.command("SETTINGS",{workflow:{supplierReview:false,staffReview:false,approval:"owner"}});
  assert.equal((await admin.command("APPROVE_INTERNAL",{id,reason:"Owner approval"})).status,200);
  assert.equal((await admin.command("PUBLISH",{id})).status,200);
  assert.equal((await customer.command("QUOTE_ACCEPT",{id})).status,200);
  assert.equal((await customer.command("SIGN",{id,consent:true,signature:"Customer test"})).status,409);
  assert.equal((await admin.command("SUPPLIER_RESPONSE",{id,lineId:"s1",response:"CONFIRMED_SUPPLIER",reason:"Telephone confirmation"})).status,200);
  assert.equal((await admin.command("CONTRACT_REVISE",{id,terms:"Updated contract terms"})).status,200);
  const versions=(await db.query("SELECT version FROM contracts WHERE booking_id=$1 ORDER BY version",[id])).rows;
  assert.equal(versions.length,2);
  const pdf=await admin.get("/api/contracts/"+id+"?format=pdf&version="+versions[1].version);
  assert.equal(pdf.status,200);
  assert.ok(pdf.body.startsWith("%PDF-"));
  assert.equal((await customer.command("SIGN",{id,consent:true,signature:"Customer test",contractVersion:versions[0].version})).status,409);
  assert.equal((await customer.command("SIGN",{id,consent:true,signature:"Customer test",contractVersion:versions[1].version})).status,200);
  assert.equal((await admin.command("CONTRACT_REVISE",{id,terms:"Do not overwrite signed terms"})).status,409);
});

test("expenses, purchase order and CMS writes are linked and audited",async()=>{
  const admin=await browser("admin");
  const guest=await browser();
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kuwait"}).format(new Date());
  const expense=await admin.post("/api/backoffice/records/expenses/new",{
    date:today,category:"Office",amount:25000,paid:15000,archived:false,method:"Cash",recipient:"Office",notes:"",invoice:"",recurring:"none",
  });
  assert.equal(expense.status,200,JSON.stringify(expense.body));
  const expenseDetail=(await admin.get("/api/backoffice/records/expenses/"+expense.body.id)).body;
  assert.equal(expenseDetail.history.length,1);
  assert.equal((await admin.get("/api/report-summary")).body.operatingExpenses,15);
  const purchase=await admin.post("/api/backoffice/records/procurement/new",{
    date:today,supplierId:"v1",status:"DRAFT",items:[{name:"Supplies",quantity:2,unitCost:2500}],paid:0,notes:"",invoice:"",
  });
  assert.equal(purchase.status,200,JSON.stringify(purchase.body));
  assert.equal(Number(purchase.body.amount_minor),5000);
  const document=await admin.get("/api/backoffice/records/procurement/"+purchase.body.id+"/print?format=pdf");
  assert.equal(document.status,200);
  assert.ok(document.body.startsWith("%PDF-"));
  const sent=await admin.post("/api/backoffice/records/procurement/"+purchase.body.id,{
    ...purchase.body.data,version:purchase.body.version,status:"SENT",
  });
  assert.equal(sent.status,200,JSON.stringify(sent.body));
  assert.equal((await admin.post("/api/backoffice/records/procurement/"+purchase.body.id,{
    ...purchase.body.data,version:purchase.body.version,status:"SENT",
  })).status,409);
  const key="home.hero.title";
  const draft=await admin.post("/api/backoffice/content/"+key,{action:"draft",value:"نص جديد"});
  assert.equal(draft.status,200,JSON.stringify(draft.body));
  assert.equal((await guest.get("/api/content")).body[key],undefined);
  assert.equal((await admin.post("/api/backoffice/content/"+key,{action:"publish",id:draft.body.id})).status,200);
  assert.equal((await guest.get("/api/content")).body[key],"نص جديد");
  assert.equal((await guest.get("/api/backoffice/records/expenses")).status,401);
  const template=await admin.post("/api/backoffice/records/expenses/new",{
    date:"2025-01-01",category:"Recurring",amount:5000,paid:0,archived:false,method:"Cash",
    recipient:"Office",notes:"",invoice:"",recurring:"monthly",
  });
  assert.equal(template.status,200);
  const {scheduleDueReminders}=await import("../server/worker.mjs");
  await scheduleDueReminders();
  await scheduleDueReminders();
  const generated=(await db.query("SELECT * FROM admin_expenses WHERE recurring_from=$1",[template.body.id])).rows;
  assert.equal(generated.length,1);
  assert.equal(Number(generated[0].paid_minor),0);
});

test("package options use server pricing and reject invalid customization", async()=>{
  const owner=await browser("admin");
  const guest=await browser();
  const state=(await owner.get("/api/state")).body;
  const pack=state.packages.find(item=>item.id==="p1");
  const extra=state.services.find(item=>!pack.serviceIds.includes(item.id));
  const saved=await owner.command("PACKAGE_SAVE",{
    id:pack.id,title:pack.title,price:250,capacity:100,serviceIds:pack.serviceIds,
    configuration:{minGuests:50,maxGuests:150,pricing:"fixed",options:[{name:"مميز",surcharge:25}],extraServiceIds:[extra.id]},
  });
  assert.equal(saved.status,200,JSON.stringify(saved.body));
  assert.equal((await guest.command("CART_PACKAGE",{id:pack.id,guests:20,option:"مميز"})).status,409);
  assert.equal((await guest.command("CART_PACKAGE",{id:pack.id,guests:100,option:"وهمي"})).status,409);
  const added=await guest.command("CART_PACKAGE",{id:pack.id,guests:100,option:"مميز",extras:[extra.id]});
  assert.equal(added.status,200,JSON.stringify(added.body));
  assert.equal(Math.round(added.body.cart.reduce((sum,line)=>sum+line.price,0)*1000),Math.round((275+extra.price)*1000));
  assert.ok(added.body.cart.every(line=>line.qty===1));
});

test("content ordering rejects invalid values and media requires publication", async()=>{
  const owner=await browser("admin");
  const guest=await browser();
  const key="home.sections.order";
  const valid="banner,welcome,promo,occasions,audience,packages,steps,reviews";
  assert.equal((await owner.post("/api/backoffice/content/"+key,{action:"draft",value:"banner,banner"})).status,400);
  const draft=await owner.post("/api/backoffice/content/"+key,{action:"draft",value:valid});
  assert.equal(draft.status,200);
  assert.equal((await owner.post("/api/backoffice/content/"+key,{action:"publish",id:draft.body.id})).status,200);
  assert.equal((await guest.get("/api/content")).body[key],valid);
  assert.equal((await guest.get("/api/content-media/00000000-0000-0000-0000-000000000001.png")).status,404);
  assert.equal((await owner.post("/api/backoffice/content/home.hero.image",{action:"draft",value:"/api/content-media/00000000-0000-0000-0000-000000000001.png"})).status,400);
  const boundary="habb-"+randomUUID();
  const payload=Buffer.concat([
    Buffer.from("--"+boundary+"\r\nContent-Disposition: form-data; name=\"file\"; filename=\"example.png\"\r\nContent-Type: image/png\r\n\r\n"),
    Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1sAAAAASUVORK5CYII=","base64"),
    Buffer.from("\r\n--"+boundary+"--\r\n"),
  ]);
  const media=await owner.post("/api/backoffice/content-media",payload,{"content-type":"multipart/form-data; boundary="+boundary});
  assert.equal(media.status,200,JSON.stringify(media.body));
  assert.equal((await guest.get(media.body.path)).status,404);
  assert.equal((await owner.get(media.body.path)).status,200);
  const image=await owner.post("/api/backoffice/content/home.hero.image",{action:"draft",value:media.body.path});
  assert.equal(image.status,200);
  assert.equal((await owner.post("/api/backoffice/content/home.hero.image",{action:"publish",id:image.body.id})).status,200);
  assert.equal((await guest.get(media.body.path)).status,200);

});
