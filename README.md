# outl plugin registry

The day-zero "store" for [outl](https://github.com/avelino/outl) plugins: a single versioned `registry.json` that the CLI and GUI clients read to **list and search** installable plugins.
No server, no API — just a JSON file, served statically.

Clients fetch it from:

```
https://plugins.outl.app/registry.json
```

## Hosting (Netlify → plugins.outl.app)

The repo root **is** the published site — there's no build step.
`netlify.toml` serves `registry.json` and `schema/` with a JSON content-type and permissive CORS (so the desktop/mobile webviews can fetch cross-origin), plus `index.html` as the landing page.

To deploy: connect this repo to a Netlify site and point the `plugins.outl.app` custom domain at it.
Every push to `main` publishes.

## What's here

| File | Purpose |
|---|---|
| `registry.json` | The index every client reads (`https://plugins.outl.app/registry.json`). |
| `schema/registry-v1.json` | JSON Schema the index validates against (CI + editor autocomplete). |
| `netlify.toml` | Static hosting config — content-type, CORS, cache headers. |
| `index.html` | Landing page at the domain root. |

## Adding a plugin

Open a PR adding an entry to `registry.json`:

```jsonc
{
  "id": "app.outl.examples.todo-archiver",   // reverse-DNS, MUST match the plugin's plugin.json `id`
  "name": "TODO Archiver",
  "description": "One sentence on what it does.",
  "author": "your-handle",
  "repository": "github:user/repo",           // install source; subdir ok: github:user/repo/plugins/foo
  "category": "productivity",
  "keywords": ["todo", "archive"],
  "capabilities": ["op-hook", "slash-command"], // mirror plugin.json — drives discovery filters
  "permissions": ["read-page", "write-page"],   // mirror plugin.json — users see the ask before install
  "latest": "1.0.0",
  "versions": ["1.0.0"]                          // published tags, newest last
}
```

Rules:

- `id`, `capabilities`, and `permissions` **must** match the plugin's `plugin.json` (the install verifies the manifest anyway).
- `repository` is what `outl plugin install` resolves: `outl plugin install github:user/repo` clones the repo at the newest semver tag (or `…#v1.2.0` to pin one).
- Keep `versions` newest-last; bump `latest` on a new release.

Entries are validated against `schema/registry-v1.json` in CI.

## Installing from the registry

Today, install directly from a plugin's GitHub source (the `repository` field of its entry):

```sh
outl plugin install github:user/repo          # newest semver tag
outl plugin install github:user/repo#v1.2.0   # pin a tag
```

In-client discovery (`outl plugin search` + a browse/install screen in the desktop & mobile apps that read this `registry.json`) is the next step.
A hosted registry (`registry.outl.app`) with full-text search and install counts comes later, only when volume justifies the infrastructure — the schema here is forward-compatible with it.
