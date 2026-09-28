import crypto from "node:crypto";

const COOKIE_NAME = "nizhal_admin";
const SESSION_SECONDS = 60 * 60 * 8;

function sign(value) {
  return crypto
    .createHmac("sha256", process.env.ADMIN_SESSION_SECRET || "")
    .update(value)
    .digest("base64url");
}

export function createSession(username) {
  if (!process.env.ADMIN_SESSION_SECRET) {
    throw new Error("ADMIN_SESSION_SECRET is not configured.");
  }

  const payload = Buffer.from(JSON.stringify({
    u: username,
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS
  })).toString("base64url");

  return payload + "." + sign(payload);
}

export function isAdmin(request) {
  const cookieHeader = request.headers.cookie || "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").filter(Boolean).map(part => {
      const i = part.indexOf("=");
      return [part.slice(0, i).trim(), decodeURIComponent(part.slice(i + 1).trim())];
    })
  );

  const token = cookies[COOKIE_NAME];
  if (!token || !process.env.ADMIN_SESSION_SECRET) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  try {
    const expected = sign(payload);
    if (
      signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) return false;

    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return (
      data.exp > Math.floor(Date.now() / 1000) &&
      data.u === (process.env.ADMIN_USERNAME || "")
    );
  } catch {
    return false;
  }
}

export function requireAdmin(req, res) {
  if (!isAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

export function sessionCookie(token) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
