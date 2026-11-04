import test from "node:test";
import assert from "node:assert/strict";
import { sendTwilio } from "../server/providers/notifications.mjs";
test("SMS provider validates consent and uses authenticated form requests without exposing secrets", async () => {
  const env = {
    TWILIO_ACCOUNT_SID: "AC" + "a".repeat(32),
    TWILIO_AUTH_TOKEN: "test-secret",
    TWILIO_FROM: "+15555550123",
  };
  let calls = 0;
  const fetchImpl = async (url, options) => {
    calls++;
    assert.ok(url.endsWith("/Messages.json"));
    assert.equal(options.body.get("To"), "+96555551234");
    return {
      ok: true,
      json: async () => ({ sid: "SM" + "b".repeat(32), status: "queued" }),
    };
  };
  await assert.rejects(
    () =>
      sendTwilio("SMS", { to: "+96555551234", text: "Hi" }, { env, fetchImpl }),
    /consent/,
  );
  assert.equal(calls, 0);
  const result = await sendTwilio(
    "SMS",
    { to: "+96555551234", text: "Hi", consent: true },
    { env, fetchImpl },
  );
  assert.equal(result.status, "queued");
  assert.equal(calls, 1);
  await assert.rejects(
    () =>
      sendTwilio(
        "WHATSAPP",
        { to: "+96555551234", consent: true },
        { env: { ...env, TWILIO_WHATSAPP_FROM: "+15555550123" }, fetchImpl },
      ),
    /template/,
  );
});
