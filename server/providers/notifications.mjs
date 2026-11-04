import nodemailer from "nodemailer";
import { integrationError } from "./payments.mjs";
import {integrationEnvironment} from '../integration-runtime.mjs';

export async function sendEmail(
  { to, subject, text, html, idempotencyKey, messageId },
  { transport } = {},
) {
  const env=integrationEnvironment();
  if(!transport && env.INTEGRATION_EMAIL_ENABLED==='false')throw integrationError('إرسال البريد موقوف من إعدادات المالك');
  if(!transport && env.EMAIL_PROVIDER==='resend'){
    if(!env.RESEND_API_KEY || !env.MAIL_FROM)throw integrationError('خدمة البريد تحتاج تفعيلًا');
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json',...(idempotencyKey?{'Idempotency-Key':idempotencyKey}:{})},body:JSON.stringify({from:env.MAIL_FROM,to:[to],subject,text,...(html?{html}:{})}),signal:AbortSignal.timeout(15000),redirect:'error'});
    if(!response.ok)throw integrationError('تعذر تأكيد قبول البريد لدى الجهة',502);
    const data=await response.json();if(!data.id)throw integrationError('لم تعد الجهة مرجعًا للرسالة',502);
    return {messageId:data.id,provider:'resend',accepted:true};
  }
  if (!transport) {
    if (!env.SMTP_HOST || !env.MAIL_FROM)
      throw integrationError("SMTP delivery is not configured");
    transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT || 587),
      secure: env.SMTP_SECURE === "true",
      requireTLS: ["production", "staging"].includes(process.env.NODE_ENV),
      auth: env.SMTP_USER
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,
      connectionTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  const result = await transport.sendMail({
    from: env.MAIL_FROM || "Habb <local@example.test>",
    to,
    subject,
    ...(messageId?{messageId}:{}),
    text,
    ...(html ? { html } : {}),
  });
  if (!result.accepted?.length || result.rejected?.length)
    throw integrationError("SMTP recipient delivery rejected");
  return { messageId: result.messageId };
}
export async function sendMessage(channel, message) {
  if (channel === "EMAIL") return sendEmail(message);
  if (["SMS", "WHATSAPP"].includes(channel))
    return sendTwilio(channel, message);
  throw integrationError(
    `${channel} adapter is not configured. Configure an approved transactional provider before enabling this channel.`,
  );
}
export async function sendTwilio(
  channel,
  message,
  { env = integrationEnvironment(), fetchImpl = fetch } = {},
) {
  if(env.INTEGRATION_MESSAGING_ENABLED==='false')throw integrationError('إرسال الرسائل موقوف من إعدادات المالك');
  const sid = env.TWILIO_ACCOUNT_SID,
    secret = env.TWILIO_AUTH_TOKEN;
  if (!/^AC[a-f\d]{32}$/i.test(sid || "") || !secret)
    throw integrationError("Twilio adapter is not configured");
  if (!/^\+[1-9]\d{7,14}$/.test(message.to || "") || message.consent !== true)
    throw integrationError(
      "A valid E.164 recipient and explicit messaging consent are required",
      400,
    );
  const whatsapp = channel === "WHATSAPP",
    from = whatsapp ? env.TWILIO_WHATSAPP_FROM : env.TWILIO_FROM;
  if (!from) throw integrationError("Approved sender is not configured");
  const body = new URLSearchParams({
    To: (whatsapp ? "whatsapp:" : "") + message.to,
    From: (whatsapp ? "whatsapp:" : "") + from,
  });
  if(message.statusCallback){
    const callback=new URL(message.statusCallback);if(callback.protocol!=='https:')throw integrationError('تتبع الرسائل يتطلب رابطًا آمنًا',400);
    body.set('StatusCallback',callback.href);
  }
  if (whatsapp) {
    if (!/^HX[a-f\d]{32}$/i.test(message.contentSid || ""))
      throw integrationError(
        "An approved WhatsApp ContentSid template is required",
        400,
      );
    body.set("ContentSid", message.contentSid);
    body.set("ContentVariables", JSON.stringify(message.variables || {}));
  } else {
    if (
      typeof message.text !== "string" ||
      !message.text.length ||
      message.text.length > 1600
    )
      throw integrationError("Invalid SMS content", 400);
    body.set("Body", message.text);
  }
  const response = await fetchImpl(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(sid + ":" + secret).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(15000),
    },
  );
  const data = await response.json();
  if (
    !response.ok ||
    !data.sid ||
    ["failed", "undelivered"].includes(data.status)
  )
    throw integrationError("Messaging provider rejected the request", 502);
  return { messageId: data.sid, status: data.status, accepted: true }; // Acceptance is not proof of handset delivery.
}
