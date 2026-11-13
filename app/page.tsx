import {
  ArrowRight,
  Clapperboard,
  Image as ImageIcon,
  Lock,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

const IMAGE_FEATURES = [
  "Crop",
  "Merge",
  "Adjust",
  "Remove BG",
  "Projects",
  "Zoom & pan",
  "PNG · JPG · WebP",
];

export default function Home() {
  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.16),transparent_65%)]" />

      <header className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-600/20">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Media Editor
          </span>
        </div>
        <span className="text-xs text-zinc-500">Runs in your browser</span>
      </header>

      <main className="relative mx-auto max-w-6xl px-5 pb-20">
        <section className="pt-14 pb-10 sm:pt-20 sm:pb-14">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
              <Lock className="h-3 w-3" />
              Private by design — nothing is uploaded
            </span>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
              Edit media{" "}
              <span className="text-zinc-400">without the upload.</span>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
              Crop, merge, adjust, and export images right in your browser.
              Video tools are on the roadmap.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Link
            href="/image"
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 transition-all hover:-translate-y-0.5 hover:border-blue-500/60 hover:bg-zinc-900"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                  <ImageIcon className="h-5 w-5" />
                </span>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
                  Available
                </span>
              </div>
              <h2 className="mt-5 text-xl font-semibold tracking-tight">
                Image editor
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
                Open an image from your device, drag it in, or paste it. Crop,
                merge, adjust colors, remove backgrounds, and save projects —
                then export as PNG, JPG, or WebP.
              </p>
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {IMAGE_FEATURES.map((feature) => (
                  <li
                    key={feature}
                    className="rounded-md border border-zinc-800 bg-zinc-950/60 px-2 py-0.5 text-[11px] text-zinc-400"
                  >
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
            <span className="mt-7 inline-flex items-center gap-1.5 text-sm font-medium text-blue-400">
              Open image editor
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>

          <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-6">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-800/80 text-zinc-400">
                  <Clapperboard className="h-5 w-5" />
                </span>
                <span className="rounded-full border border-zinc-700 px-2.5 py-0.5 text-[11px] font-medium text-zinc-400">
                  Coming soon
                </span>
              </div>
              <h2 className="mt-5 text-xl font-semibold tracking-tight text-zinc-300">
                Video editor
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
                Trim and crop clips, merge them end to end, extract audio or a
                single frame, and export — processed locally with ffmpeg.wasm.
              </p>
            </div>
            <span className="mt-7 text-sm font-medium text-zinc-500">
              Planned for Phase 3
            </span>
          </div>
        </section>

        <section className="mt-10 grid gap-3 text-sm text-zinc-400 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-900 bg-zinc-900/30 px-4 py-3">
            <p className="font-medium text-zinc-200">Your files stay put</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Decoding, editing, and exporting all happen in your browser.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-900 bg-zinc-900/30 px-4 py-3">
            <p className="font-medium text-zinc-200">No account needed</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              There is no sign-up, no upload endpoint, and no cloud storage.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-900 bg-zinc-900/30 px-4 py-3">
            <p className="font-medium text-zinc-200">Built to grow</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Video trimming, cropping, and merging are next.
            </p>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-zinc-900 px-5 py-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <span>Built with Next.js</span>
          <span>Media never leaves your device</span>
        </div>
      </footer>
    </div>
  );
}
