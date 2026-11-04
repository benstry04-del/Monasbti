// Isolated test process only. This entrypoint is never copied into the production image.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "pglite:memory";
process.env.APP_ORIGIN = "http://127.0.0.1:4301";
process.env.ENABLE_DEMO = "true";
process.env.DEV_DEMO_PASSWORD = "E2E-Isolated-Password!";
const db = await import("../server/db.mjs");
const { migrate } = await import("../server/migrate.mjs");
const { seedDemo } = await import("../server/seed-demo.mjs");
const { createApp } = await import("../server/app.mjs");
await migrate();
await seedDemo();
const app = await createApp({ logger: { level: "error" } });
app.get("/__test/verification", async (request) => {
  const row = (
    await db.query(
      "SELECT payload FROM outbox WHERE job_type='EMAIL' AND payload->>'to'=$1 ORDER BY created_at DESC LIMIT 1",
      [request.query.email],
    )
  ).rows[0];
  return { code: row?.payload.text.match(/: (\d{6})/)?.[1] };
});
// Isolated operational fixture, never copied into the production image.
app.post('/__test/complete-booking/:id',async(request,reply)=>db.transaction(async c=>{
  const b=(await c.query('SELECT * FROM bookings WHERE id=$1 FOR UPDATE',[request.params.id])).rows[0];
  if(!b)return reply.code(404).send({error:'fixture booking missing'});
  const data=b.data;data.status='COMPLETED';data.execution='Completed';
  data.lines.forEach(l=>l.execution='Completed');
  await c.query("UPDATE bookings SET status='COMPLETED',data=$2,version=version+1 WHERE id=$1",[b.id,data]);
  await c.query("UPDATE order_lines SET data=data||'{\"execution\":\"Completed\"}'::jsonb WHERE booking_id=$1",[b.id]);
  return {fixture:true};
}));
await app.listen({ host: "127.0.0.1", port: 4301 });
