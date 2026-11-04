import {
  randomBytes,
  scrypt as callbackScrypt,
  timingSafeEqual,
  createHash,
  createHmac,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(callbackScrypt);
export function httpError(statusCode, message, code = "REQUEST_REJECTED") {
  return Object.assign(new Error(message), { statusCode, code });
}
export function token() {
  return randomBytes(32).toString("base64url");
}
export function tokenHash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length)
    return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
export async function hashPassword(password) {
  const salt = randomBytes(32);
  const derived = await scrypt(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$32768$8$1$${salt.toString("hex")}$${derived.toString("hex")}`;
}
export async function verifyPassword(password, encoded) {
  try {
    const [algorithm, n, r, p, salt, key] = String(encoded).split("$");
    if (
      algorithm !== "scrypt" ||
      Number(n) !== 32768 ||
      Number(r) !== 8 ||
      Number(p) !== 1 ||
      !/^[a-f\d]{64}$/.test(salt) ||
      !/^[a-f\d]{128}$/.test(key)
    )
      return false;
    const derived = await scrypt(password, Buffer.from(salt, "hex"), 64, {
      N: 32768,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024,
    });
    return timingSafeEqual(derived, Buffer.from(key, "hex"));
  } catch {
    return false;
  }
}
export function csrfForVisitor(visitorId, secret) {
  return createHmac("sha256", secret)
    .update(`csrf:${visitorId}`)
    .digest("base64url");
}
export function encryptSecret(value, encryptionKey) {
  const iv = randomBytes(12),
    cipher = createCipheriv(
      "aes-256-gcm",
      Buffer.from(encryptionKey, "hex"),
      iv,
    );
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), ciphertext]
    .map((x) => x.toString("base64url"))
    .join(".");
}
export function decryptSecret(value, encryptionKey) {
  const [iv, tag, ciphertext] = value
    .split(".")
    .map((x) => Buffer.from(x, "base64url"));
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(encryptionKey, "hex"),
    iv,
  );
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function encodeBase32(bytes) {
  let bits = 0,
    value = 0,
    out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}
function decodeBase32(value) {
  let bits = 0,
    accumulator = 0,
    out = [];
  for (const char of value.replace(/=+$/, "").toUpperCase()) {
    const n = alphabet.indexOf(char);
    if (n < 0) throw Error("Invalid TOTP secret");
    accumulator = (accumulator << 5) | n;
    bits += 5;
    if (bits >= 8) {
      out.push((accumulator >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
export function totp(secret, step = Math.floor(Date.now() / 30000)) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", decodeBase32(secret)).update(counter).digest(),
    offset = h.at(-1) & 15;
  return String((h.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(
    6,
    "0",
  );
}
export function verifyTotp(secret, code, previousStep = -1, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return null;
  const current = Math.floor(now / 30000);
  for (const delta of [0, -1, 1]) {
    const step = current + delta;
    if (step > Number(previousStep) && safeEqual(totp(secret, step), code))
      return step;
  }
  return null;
}
