import { createSession, sessionCookie } from "../../lib/admin-auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const username = String(req.body?.username || "");
  const password = String(req.body?.password || "");

  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD || !process.env.ADMIN_SESSION_SECRET) {
    return res.status(500).json({ error: "Admin environment variables are not configured." });
  }

  if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  res.setHeader("Set-Cookie", sessionCookie(createSession(username)));
  return res.status(200).json({ ok: true });
}
