# Web Image & Video Editor — Project Plan

A lightweight, browser-based editor for images and video. All media is processed **on the user's device**: no uploads, no server costs, and good privacy.

- **Framework:** Next.js (App Router) + TypeScript
- **Hosting:** Vercel (auto-deploy from GitHub)
- **Source control:** GitHub

---

## 1. Goals and Scope

### Image features (MVP)
| Feature | Description |
|---|---|
| Open / save | Load from device, drag-and-drop, paste; export PNG / JPG / WebP |
| Crop | Free crop and preset ratios (1:1, 4:3, 16:9) |
| Resize / rotate / flip | Basic transforms |
| Merge | Combine images side by side, stacked, or as layers on a canvas |
| Remove background | One-click, runs in the browser, transparent PNG output |
| Adjustments | Brightness, contrast, saturation, simple filters |
| Text overlay | Add text and simple shapes (optional) |

### Video features (MVP)
| Feature | Description |
|---|---|
| Open / save | Load MP4 / WebM / MOV; export MP4 or WebM |
| Trim | Set start and end points |
| Crop / resize | Crop frame, scale to a target resolution |
| Merge | Join several clips end to end |
| Extract audio / mute | Remove or export the audio track |
| Extract frame | Save a frame as an image |

### Out of scope (for now)
Multi-track timelines, transitions and effects, user accounts, cloud storage, collaboration. These can come later as phase 4+.

---

## 2. Key Architecture Decision: Process Everything Client-Side

Vercel serverless functions have small request-body limits (a few MB on the free tier) and execution time limits, so uploading video to a server is not practical. Processing in the browser avoids this entirely.

```
Browser
 ├─ UI (React / Next.js)
 ├─ Image engine  → Canvas API + Fabric.js (or Konva)
 ├─ Video engine  → ffmpeg.wasm (runs in a Web Worker)
 ├─ BG removal    → ONNX/WASM model running in the browser
 └─ Storage       → File System Access API + IndexedDB
Vercel = static hosting of the app only
```

---

## 3. Tech Stack

| Area | Choice | Notes |
|---|---|---|
| Framework | Next.js + TypeScript | App Router; most editor pages are client components |
| Styling | Tailwind CSS + shadcn/ui | Fast, consistent UI |
| State | Zustand | Simple store for editor state and undo/redo |
| Image editing | Fabric.js or Konva | Layers, selection, crop handles, text. Pick one |
| Video processing | `@ffmpeg/ffmpeg` + `@ffmpeg/util` | WASM build of FFmpeg, run inside a Web Worker |
| Background removal | `@imgly/background-removal` | Runs locally. **Check its license** before any commercial use. Alternative: Transformers.js with an open model (also check the model license) |
| Local persistence | `idb` (IndexedDB wrapper) | Save projects and recent files |
| Local file access | File System Access API with `<input type="file">` fallback | See section 5 |
| Testing | Vitest + Playwright | Unit tests plus a few end-to-end flows |
| Lint / format | ESLint + Prettier | Enforced in CI |

---

## 4. Suggested Folder Structure

```
/
├─ app/
│  ├─ layout.tsx
│  ├─ page.tsx                  # landing / choose image or video
│  ├─ image/page.tsx            # image editor
│  └─ video/page.tsx            # video editor
├─ components/
│  ├─ ui/                       # shadcn components
│  ├─ image/                    # Canvas, Toolbar, CropTool, MergePanel...
│  └─ video/                    # Player, TrimSlider, ClipList...
├─ lib/
│  ├─ image/                    # canvas helpers, export, merge
│  ├─ video/                    # ffmpeg wrapper, commands
│  ├─ bgremoval/                # model loading + inference
│  ├─ storage/                  # file access + IndexedDB
│  └─ utils.ts
├─ workers/
│  └─ ffmpeg.worker.ts
├─ store/
│  └─ editor-store.ts
├─ public/
├─ next.config.mjs
├─ PROJECT_PLAN.md
└─ README.md
```

---

## 5. Accessing Local Storage / Files

"Local storage" can mean three different things, and this app uses each for a different job:

1. **Opening and saving files on the device**
   - Use `<input type="file">` and drag-and-drop everywhere (works on all browsers).
   - Where available, use the **File System Access API** (`showOpenFilePicker`, `showSaveFilePicker`) to open and save directly. This is mainly **Chromium browsers** (Chrome, Edge); Safari and Firefox need the fallback (download via a Blob link).
2. **Saving projects and recent work in the browser**
   - Use **IndexedDB** (not `localStorage`, which is tiny and string-only).
   - Store project state (JSON) and media as Blobs.
   - Call `navigator.storage.persist()` to reduce the chance of the browser clearing data.
3. **Small settings** (theme, last used export format)
   - `localStorage` is fine here.

---

## 6. Important Configuration

### Video: SharedArrayBuffer headers
Multi-threaded ffmpeg.wasm needs cross-origin isolation. Add headers in `next.config.mjs`:

```js
const nextConfig = {
  async headers() {
    return [
      {
        source: "/video/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};
export default nextConfig;
```

Notes:
- Apply these only to the video route, because they can break third-party embeds elsewhere.
- Host the ffmpeg core files yourself (in `/public`) so they satisfy `require-corp`.
- If this proves fiddly, start with the **single-threaded** ffmpeg core, which needs no special headers (slower, but simpler).

### Performance
- Load ffmpeg and the background-removal model **lazily** (dynamic import) only when the user opens that tool.
- Show progress bars; these operations take seconds to minutes.
- Cap input size (for example, warn above 500 MB for video) because browser memory is limited.

---

## 7. Development Phases

### Phase 0 — Setup (day 1)
- [ ] Create GitHub repo; add README, `.gitignore`, license
- [ ] `npx create-next-app@latest` (TypeScript, Tailwind, App Router, ESLint)
- [ ] Connect repo to Vercel (Import Project); confirm first deploy
- [ ] Add Prettier, basic CI (lint + typecheck + build) with GitHub Actions

### Phase 1 — Image editor core
- [ ] Open image (picker, drag-and-drop, paste)
- [ ] Canvas view with zoom and pan
- [ ] Crop, rotate, flip, resize
- [ ] Export PNG / JPG / WebP
- [ ] Undo / redo

### Phase 2 — Image extras
- [ ] Merge / combine images (layers, then side-by-side and stacked presets)
- [ ] Background removal with progress indicator
- [ ] Adjustments and filters
- [ ] Save / load projects with IndexedDB

### Phase 3 — Video editor
- [ ] Load video and preview player
- [ ] Trim (slider with start and end handles)
- [ ] Crop / resize with ffmpeg.wasm in a Web Worker
- [ ] Merge clips
- [ ] Mute / extract audio, extract frame
- [ ] Export with progress and cancel

### Phase 4 — Polish
- [ ] Responsive layout, keyboard shortcuts
- [ ] Error handling, friendly messages for unsupported browsers
- [ ] Accessibility pass
- [ ] Optional: PWA (installable, works offline)
- [ ] Optional: Supabase for accounts and cloud-saved projects

---

## 8. Deployment Workflow (GitHub → Vercel)

1. Push code to GitHub (`main` = production).
2. Vercel builds automatically on each push.
3. Every pull request gets a **preview URL** for testing.
4. Use feature branches: `feature/crop-tool`, `feature/bg-removal`, etc.
5. Merge to `main` when the preview looks good.

Commit style suggestion: `feat:`, `fix:`, `chore:`, `docs:`.

---

## 9. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Large video files exhaust browser memory | Size warnings, process in chunks where possible, recommend desktop browsers |
| ffmpeg.wasm is slow compared to native | Set expectations with progress UI; keep video operations simple |
| Background-removal model is a big download (tens of MB) | Lazy load, cache in the browser, show a one-time "downloading model" message |
| Browser differences (File System Access API) | Always keep the file-input and download fallback |
| Library licensing | Check licenses of the background-removal package/model and ffmpeg build before commercial use |
| Cross-origin isolation headers break things | Scope headers to `/video` only; fall back to single-thread core |

---

## 10. Definition of Done for the MVP

- A user can open an image, crop it, remove its background, merge it with another image, and save the result to their device.
- A user can open a video, trim it, crop it, join it with another clip, and save the result.
- Everything works with no server upload.
- The app deploys automatically from GitHub to Vercel, and works in current Chrome, Edge, Firefox, and Safari (with fallbacks where needed).

---

## 11. Handy Commands

```bash
npx create-next-app@latest media-editor --typescript --tailwind --app --eslint
cd media-editor
npm install zustand idb fabric @ffmpeg/ffmpeg @ffmpeg/util @imgly/background-removal
npm run dev
```

Recommended first milestone: **open image → crop → export**. Get that working and deployed on Vercel before touching video.
