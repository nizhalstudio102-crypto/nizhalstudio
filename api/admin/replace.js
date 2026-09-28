import { requireAdmin } from "../../lib/admin-auth.js";
import { githubFetch, getTree, repoName, BRANCH } from "../../lib/github.js";

const MAX_IMAGE_SIZE = 3 * 1024 * 1024;

/**
 * Only allow files inside assets/images/
 * and prevent path traversal.
 */
function validTarget(path) {
  return /^assets\/images\/[A-Za-z0-9._\/-]+$/.test(path);
}

/**
 * Allowed image formats.
 */
function allowedImage(name) {
  return /\.(jpe?g|png|webp|gif|avif)$/i.test(name);
}

/**
 * Extract filename from a repository path.
 */
function getFilename(path) {
  return path.split("/").pop() || "";
}

export default async function handler(req, res) {
  // --------------------------------------------------
  // ADMIN AUTHENTICATION
  // --------------------------------------------------
  if (!requireAdmin(req, res)) return;

  // --------------------------------------------------
  // METHOD CHECK
  // --------------------------------------------------
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  // --------------------------------------------------
  // GITHUB TOKEN CHECK
  // --------------------------------------------------
  if (!process.env.GITHUB_TOKEN) {
    return res.status(500).json({
      error: "GITHUB_TOKEN is not configured in Vercel."
    });
  }

  try {
    // ------------------------------------------------
    // READ REQUEST DATA
    // ------------------------------------------------
    const { path, filename, base64 } = req.body || {};

    const targetPath = String(path || "").trim();
    const selectedName = String(filename || "").trim();

    // ------------------------------------------------
    // VALIDATE TARGET PATH
    // ------------------------------------------------
    if (!validTarget(targetPath)) {
      return res.status(400).json({
        error:
          "Invalid image path. Only files inside assets/images/ can be replaced."
      });
    }

    // ------------------------------------------------
    // GET EXISTING FILENAME
    // ------------------------------------------------
    const expectedName = getFilename(targetPath);

    // ------------------------------------------------
    // STRICT SAME-FILENAME RULE
    // ------------------------------------------------
    if (selectedName !== expectedName) {
      return res.status(400).json({
        error: `Filename mismatch. Required: ${expectedName}`
      });
    }

    // ------------------------------------------------
    // VALIDATE IMAGE EXTENSION
    // ------------------------------------------------
    if (!allowedImage(selectedName)) {
      return res.status(400).json({
        error:
          "Unsupported image format. Allowed: JPG, JPEG, PNG, WEBP, GIF and AVIF."
      });
    }

    // ------------------------------------------------
    // CHECK BASE64 DATA
    // ------------------------------------------------
    if (!base64 || typeof base64 !== "string") {
      return res.status(400).json({
        error: "No image data received."
      });
    }

    // ------------------------------------------------
    // REMOVE DATA URL PREFIX
    //
    // Example:
    // data:image/jpeg;base64,XXXXXX
    //
    // becomes:
    // XXXXXX
    // ------------------------------------------------
    const raw = base64.replace(/^data:[^;]+;base64,/, "");

    if (!raw) {
      return res.status(400).json({
        error: "Invalid image data."
      });
    }

    // ------------------------------------------------
    // CONVERT BASE64 TO BUFFER
    // ------------------------------------------------
    const bytes = Buffer.from(raw, "base64");

    if (!bytes.length) {
      return res.status(400).json({
        error: "The uploaded image is empty or invalid."
      });
    }

    // ------------------------------------------------
    // IMAGE SIZE LIMIT
    // ------------------------------------------------
    if (bytes.length > MAX_IMAGE_SIZE) {
      return res.status(400).json({
        error: "Image must be 10 MB or smaller."
      });
    }

    // ------------------------------------------------
    // CHECK FILE EXISTS IN GITHUB
    // ------------------------------------------------
    const tree = await getTree();

    const exists = (tree.tree || []).some(
      item =>
        item.type === "blob" &&
        item.path === targetPath
    );

    if (!exists) {
      return res.status(404).json({
        error:
          "Target image does not exist in the GitHub repository."
      });
    }

    // ------------------------------------------------
    // ENCODE PATH SAFELY
    // ------------------------------------------------
    const encodedPath = targetPath
      .split("/")
      .map(encodeURIComponent)
      .join("/");

    // ------------------------------------------------
    // IMPORTANT:
    // ALWAYS FETCH THE CURRENT GITHUB FILE FIRST.
    //
    // This gets the NEW SHA after every previous replacement.
    // Therefore repeated replacements will not use an old SHA.
    // ------------------------------------------------
    const current = await githubFetch(
      `contents/${encodedPath}?ref=${encodeURIComponent(BRANCH)}`
    );

    const currentData = await current.json();

    // ------------------------------------------------
    // HANDLE GITHUB GET ERROR
    // ------------------------------------------------
    if (!current.ok) {
      return res.status(current.status).json({
        error:
          currentData?.message ||
          "Failed to retrieve the current image from GitHub."
      });
    }

    // ------------------------------------------------
    // VERIFY CURRENT SHA
    // ------------------------------------------------
    if (!currentData.sha) {
      return res.status(500).json({
        error:
          "GitHub did not return the current file SHA."
      });
    }

    // ------------------------------------------------
    // REPLACE IMAGE
    // ------------------------------------------------
    const updated = await githubFetch(
      `contents/${encodedPath}`,
      {
        method: "PUT",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          message: `Admin: replace ${targetPath}`,

          // New image content
          content: bytes.toString("base64"),

          // VERY IMPORTANT:
          // Use the CURRENT SHA fetched immediately above.
          sha: currentData.sha,

          // Repository branch
          branch: BRANCH,

          // Commit identity
          committer: {
            name: "Nizhal Studio Admin",
            email:
              process.env.ADMIN_COMMIT_EMAIL ||
              "admin@nizhalstudio.in"
          }
        })
      }
    );

    // ------------------------------------------------
    // READ GITHUB RESPONSE
    // ------------------------------------------------
    const result = await updated.json();

    // ------------------------------------------------
    // HANDLE GITHUB UPDATE ERROR
    // ------------------------------------------------
    if (!updated.ok) {
      return res.status(updated.status).json({
        error:
          result?.message ||
          "GitHub rejected the image replacement.",
        details: result?.errors || null
      });
    }

    // ------------------------------------------------
    // SUCCESS
    // ------------------------------------------------
    return res.status(200).json({
      ok: true,

      path: targetPath,

      filename: selectedName,

      // Return new commit SHA
      commit: result?.commit?.sha || null,

      repository: repoName(),

      branch: BRANCH
    });

  } catch (error) {
    // ------------------------------------------------
    // UNEXPECTED ERROR
    // ------------------------------------------------
    console.error("Image replacement error:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "Unexpected error while replacing the image."
    });
  }
}
