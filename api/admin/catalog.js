import { requireAdmin } from "../../lib/admin-auth.js";
import { getTree } from "../../lib/github.js";

const LABELS = {
  "traditional-weddings": "Wedding Photography",
  "newborn-baby-shoot": "Newborn Baby Shoot",
  "cultural-stories": "Cultural Stories",
  "couple-portraits": "Couple Portraits",
  "resorts-cinematic": "Resorts Cinematic",
  "baptism-ceremony": "Baptism Ceremony",
  "engagement-photography": "Engagement Photography",
  "indoor-portfolio": "Indoor Portfolio",
  "pre-wedding": "Pre-Wedding",
  "post-wedding": "Post-Wedding",
  "baby-shoot": "Baby Shoot",
  "maternity-shoot": "Maternity Shoot"
};

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;

function categoryFor(path) {
  const parts = path.split("/");
  const file = parts.at(-1);

  if (
    path.startsWith("assets/images/") &&
    parts.length === 3 &&
    /^main-[123]\./i.test(file)
  ) {
    return { key: "main-page", label: "Main Page — 3 Hero Images" };
  }

  if (parts.length >= 4 && parts[0] === "assets" && parts[1] === "images") {
    const key = parts[2];
    return {
      key,
      label: LABELS[key] ||
        key.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    };
  }

  if (path.startsWith("assets/videos/")) {
    return { key: "all-videos", label: "All Videos" };
  }

  return null;
}

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const tree = await getTree();

    if (tree.truncated) {
      return res.status(500).json({
        error: "GitHub returned a truncated media tree. Use a media manifest for very large repositories."
      });
    }

    const files = (tree.tree || [])
      .filter(item => item.type === "blob")
      .map(item => {
        const category = categoryFor(item.path);
        if (!category) return null;

        const type = IMAGE_EXT.test(item.path)
          ? "image"
          : VIDEO_EXT.test(item.path)
            ? "video"
            : null;

        if (!type) return null;

        return {
          path: item.path,
          name: item.path.split("/").at(-1),
          categoryKey: category.key,
          category: category.label,
          type,
          size: item.size || 0,
          preview: "/" + item.path
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.path.localeCompare(b.path));

    const categories = [];
    const seen = new Set();

    for (const file of files) {
      if (!seen.has(file.categoryKey)) {
        seen.add(file.categoryKey);
        categories.push({ key: file.categoryKey, label: file.category });
      }
    }

    return res.status(200).json({
      categories,
      files,
      totals: {
        images: files.filter(f => f.type === "image").length,
        videos: files.filter(f => f.type === "video").length,
        categories: categories.length
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
