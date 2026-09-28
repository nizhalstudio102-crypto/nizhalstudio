const DEFAULT_REPO = "nizhalstudio102-crypto/nizhalstudio";
export const BRANCH = "main";

export function repoName() {
  return process.env.GITHUB_REPO || DEFAULT_REPO;
}

export function githubHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Nizhal-Studio-Admin"
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

export async function githubFetch(path, options = {}) {
  const response = await fetch(`https://api.github.com/repos/${repoName()}/${path}`, {
    ...options,
    headers: { ...githubHeaders(), ...(options.headers || {}) }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status}: ${body.slice(0, 500)}`);
  }

  return response;
}

export async function getTree() {
  const response = await githubFetch(`git/trees/${BRANCH}?recursive=1`);
  return response.json();
}
