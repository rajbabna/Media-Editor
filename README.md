# Web Image & Video Editor

A lightweight, browser-based image and video editor. All media is processed
**on the user's device** — nothing is uploaded, so there are no server costs and
your files stay private.

**Live:** https://media-editor.rajbabna.workers.dev

See [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md) for the full plan, feature list,
architecture, and roadmap.

## Status

Phases 1 and 2 are implemented at `/image`:

- Open from a file picker, drag-and-drop, or clipboard paste
- Canvas view with zoom, pan, fit, and actual-size controls
- Crop (free and fixed ratios), rotate, flip, and resize
- Merge images side by side, stacked, or as centered overlays
- Adjustments with brightness, contrast, saturation, and presets
  (Mono, Sepia, Warm, Cool) with a live preview
- One-click background removal with ORMBg
- Undo/redo with keyboard shortcuts
- Save and reopen projects locally with IndexedDB
- Export to PNG, JPG (white background), or WebP with quality control

Phase 3 (the video editor) is next.

## Tech stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- Tailwind CSS
- React / client-side canvas work
- Zustand for editor state and undo/redo
- react-image-crop for the crop UI, lucide-react for icons
- Transformers.js for in-browser background removal
- `idb` for local project storage
- Planned: ffmpeg.wasm for video

## Getting started

Requires Node.js 24+ (see `.github/workflows/ci.yml`).

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command                | Description                             |
| ---------------------- | --------------------------------------- |
| `npm run dev`          | Start the dev server                    |
| `npm run build`        | Build the static export into `out/`     |
| `npm run start`        | Preview the static export with Wrangler |
| `npm run deploy`       | Build and deploy to Cloudflare          |
| `npm run lint`         | Run ESLint                              |
| `npm run typecheck`    | Type-check with `tsc --noEmit`          |
| `npm run format`       | Format with Prettier                    |
| `npm run format:check` | Check formatting (used in CI)           |
| `npm run test:e2e`     | Run Playwright end-to-end tests         |

The e2e tests use the locally installed Google Chrome (`channel: "chrome"`),
so no browser download is required.

## Project structure

```
app/            Next.js App Router pages and layouts
components/     UI primitives, editor dialogs, and (later) video components
lib/image/      Render pipeline, adjustments, merge, projects, export helpers
lib/bgremoval/  Transformers.js background-removal wrapper
lib/storage/    IndexedDB project persistence
store/          Zustand editor store with undo/redo
scripts/        Post-build cleanup for the static export
e2e/            Playwright smoke tests
workers/        ffmpeg Web Worker (to come)
docs/           Project plan and docs
public/         Static assets
wrangler.jsonc  Cloudflare Workers static-assets config
```

## Background removal

Background removal uses **MODNet** through Transformers.js. It is Apache-2.0
licensed and bundled under `public/models/Xenova/modnet` (about 6.3 MB), so the
feature works offline and never talks to Hugging Face. It is matting-trained,
so results are best on photos of people and portraits.

Projects store their edits as operations plus PNG snapshots for merged and
background-removed results. Saved projects live in this browser's IndexedDB.

## Dependency overrides

`package.json` pins `minimatch` to `^11.0.1` inside
`@typescript-eslint/typescript-estree`. That package still declares `^10.2.2`,
which is affected by CVE-2026-118764 (dev-only lint tooling). Remove the override
once `typescript-eslint` ships a fixed release.

## Deployment

Source: [github.com/rajbabna/Media-Editor](https://github.com/rajbabna/Media-Editor)
· Live: [media-editor.rajbabna.workers.dev](https://media-editor.rajbabna.workers.dev)

The app is a static export (`output: "export"`) hosted on **Cloudflare Workers**
static assets. Local preview and deployment use
[Wrangler](https://developers.cloudflare.com/workers/wrangler/):

```bash
npx wrangler login   # once
npm run start        # preview out/ locally
npm run deploy       # build and publish
```

The post-build script removes the bundled ONNX Runtime WASM file (25.6 MB)
because Cloudflare's per-file limit is 25 MB. Transformers.js loads that file
from jsDelivr at runtime.

### Automatic deploys

`.github/workflows/deploy-cloudflare.yml` deploys on pushes to `main` once these
repository secrets are set (Settings → Secrets and variables → Actions):

- `CLOUDFLARE_API_TOKEN` — a Workers API token with edit permission
- `CLOUDFLARE_ACCOUNT_ID` — visible in the Cloudflare dashboard or
  `npx wrangler whoami`

Until the secrets exist, the deploy job is skipped and CI still passes.

## License

[MIT](LICENSE)
