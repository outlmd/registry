// Netlify build step: materialise the per-plugin bundles served at
// /p/<id>/ WITHOUT keeping them in git.
//
// Reads registry.json, derives each plugin's raw-GitHub source from its
// `repository` field, downloads plugin.json + the bundle (+ optional config
// schema), and writes them into ./p/<id>/. The repo stays a clean index;
// the bundles are a build artifact.
//
// Ref defaults to `main`; override with OUTL_REF (e.g. a release tag).

import { readFile, mkdir, writeFile, rm } from "node:fs/promises";

const ROOT = new URL("..", import.meta.url);
const REF = process.env.OUTL_REF || "main";

/** `github:owner/repo[/subpath]` → raw.githubusercontent base URL. */
function rawBase(repository) {
  const path = repository.replace(/^github:/, "");
  const [owner, repo, ...sub] = path.split("/");
  if (!owner || !repo) throw new Error(`bad repository: ${repository}`);
  const subpath = sub.join("/");
  const base = `https://raw.githubusercontent.com/${owner}/${repo}/${REF}/${subpath}`;
  return base.replace(/\/$/, "");
}

async function get(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

const reg = JSON.parse(await readFile(new URL("registry.json", ROOT), "utf8"));

await rm(new URL("p", ROOT), { recursive: true, force: true });

let count = 0;
for (const entry of reg.plugins) {
  const base = rawBase(entry.repository);
  const dest = new URL(`p/${entry.id}/`, ROOT);
  await mkdir(dest, { recursive: true });

  const manifestBytes = await get(`${base}/plugin.json`);
  const manifest = JSON.parse(manifestBytes.toString());
  await writeFile(new URL("plugin.json", dest), manifestBytes);

  const main = manifest.main || "index.js";
  await writeFile(new URL(main, dest), await get(`${base}/${main}`));

  const schema = manifest.contributes?.configSchema;
  if (schema) {
    try {
      await writeFile(new URL(schema, dest), await get(`${base}/${schema}`));
    } catch (e) {
      console.warn(`  (no config schema for ${entry.id}: ${e.message})`);
    }
  }

  console.log(`  p/${entry.id}/`);
  count++;
}

console.log(`built ${count} bundle(s) from avelino/outl@${REF}`);
