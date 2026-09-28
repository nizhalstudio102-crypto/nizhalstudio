import { requireAdmin } from "../../lib/admin-auth.js";
import { githubFetch, getTree, repoName, BRANCH } from "../../lib/github.js";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

function validTarget(path) {
  return /^assets\/images\/[A-Za-z0-9._\/-]+$/.test(path);
}

function allowedImage(name) {
  return /\.(jpe?g|png|webp|gif|avif)$/i.test(name);
}

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.GITHUB_TOKEN) {
    return res.status(500).json({ error: "GITHUB_TOKEN is not configured in Vercel." });
  }

  try {
    const { path, filename, base64 } = req.body || {};
    const targetPath = String(path || "");
    const selectedName = String(filename || "");

    if (!validTarget(targetPath)) {
      return res.status(400).json({ error: "Only image replacement is enabled in this first production-safe version." });
    }

    const expectedName = targetPath.split("/").at(-1);

    if (selectedName !== expectedName) {
      return res.status(400).json({
        error: `Filename mismatch. Required: ${expectedName}`
      });
    }

    if (!allowedImage(selectedName)) {
      return res.status(400).json({ error: "Unsupported image format." });
    }

    if (!base64 || typeof base64 !== "string") {
      return res.status(400).json({ error: "No image data received." });
    }

    const raw = base64.replace(/^data:[^;]+;base64,/, "");
    const bytes = Buffer.from(raw, "base64");

    if (bytes.length > MAX_IMAGE_SIZE) {
      return res.status(400).json({ error: "Image must be 10 MB or smaller." });
    }

    const tree = await getTree();
    const exists = (tree.tree || []).some(
      item => item.type === "blob" && item.path === targetPath
    );

    if (!exists) {
      return res.status(404).json({ error: "Target file does not exist in the repository." });
    }

    const encodedPath = targetPath.split("/").map(encodeURIComponent).join("/");
    const current = await githubFetch(`contents/${encodedPath}?ref=${BRANCH}`);
    const currentData = await current.json();

    const updated = await githubFetch(`contents/${encodedPath}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Admin: replace ${targetPath}`,
        content: bytes.toString("base64"),
        sha: currentData.sha,
        branch: BRANCH,
        committer: {
          name: "Nizhal Studio Admin",
          email: process.env.ADMIN_COMMIT_EMAIL || "admin@nizhalstudio.in"
        }
      })
    });

    const result = await updated.json();

    return res.status(200).json({
      ok: true,
      path: targetPath,
      commit: result.commit?.sha || null,
      repository: repoName()
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
