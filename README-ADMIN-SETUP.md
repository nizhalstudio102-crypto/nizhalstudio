# Nizhal Studio Admin Portal

This package adds a professional admin dashboard to the existing Nizhal Studio site.

## Files
- admin.html — login + dashboard UI
- admin.css — dashboard styling
- admin.js — dashboard logic
- api/admin/login.js — secure login
- api/admin/logout.js — logout
- api/admin/catalog.js — reads the repository media tree
- api/admin/replace.js — replaces a repository file after filename validation
- lib/admin-auth.js — signed HttpOnly session cookie
- lib/github.js — GitHub API helper
- package.json — Vercel dependency

## Vercel environment variables
Set these in the Vercel project:

ADMIN_USERNAME=admin
ADMIN_PASSWORD=CHANGE_THIS_TO_A_STRONG_PASSWORD
ADMIN_SESSION_SECRET=GENERATE_A_LONG_RANDOM_SECRET
GITHUB_TOKEN=YOUR_GITHUB_TOKEN
GITHUB_REPO=nizhalstudio102-crypto/nizhalstudio
ADMIN_COMMIT_EMAIL=admin@nizhalstudio.in

Do not put GITHUB_TOKEN or the admin password inside HTML/JS.

## Important
GitHub repository file replacement is practical for smaller images. Large videos may exceed GitHub/API/Vercel limits. For large video files, use dedicated media storage (such as Vercel Blob) and a media manifest instead of committing videos to Git.

## Main website
The admin button is added before </body>. If you already have the button, do not duplicate it.
