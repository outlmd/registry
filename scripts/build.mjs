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

/** Download one plugin's bundle into p/<id>/. Throws on a fetch failure. */
async function buildOne(entry) {
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
}

// A single plugin whose source isn't reachable (not pushed yet, repo moved,
// a bad tag) must NOT fail the whole deploy — the index is the primary
// artifact and the other bundles are still good. Skip + warn instead.
let ok = 0;
const skipped = [];
for (const entry of reg.plugins) {
  try {
    await buildOne(entry);
    console.log(`  p/${entry.id}/`);
    ok++;
  } catch (e) {
    skipped.push(entry.id);
    console.warn(`  SKIP ${entry.id}: ${e.message}`);
  }
}

console.log(`built ${ok}/${reg.plugins.length} bundle(s) from avelino/outl@${REF}`);
if (skipped.length) {
  console.warn(
    `skipped ${skipped.length}: ${skipped.join(", ")} — their source isn't reachable at @${REF} yet`,
  );
}
// Exit 0 even with skips: the index + reachable bundles still deploy.
