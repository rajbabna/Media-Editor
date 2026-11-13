"use client";

import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

import { CHECKERBOARD } from "@/components/image/checkerboard";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { createSnapshotOpFromCanvas } from "@/lib/image/asset";
import { getContext } from "@/lib/image/canvas";
import { isImageFile, loadImageFile, stripExtension } from "@/lib/image/file";
import { buildMerge } from "@/lib/image/merge";
import type { MergeLayout, SnapshotOp } from "@/lib/image/types";

const LAYOUTS: Array<{
  value: MergeLayout;
  label: string;
  description: string;
}> = [
  {
    value: "side-by-side",
    label: "Side by side",
    description: "Left to right, scaled to the tallest image",
  },
  {
    value: "stacked",
    label: "Stacked",
    description: "Top to bottom, scaled to the widest image",
  },
  {
    value: "overlay",
    label: "Overlay",
    description: "Layered on top, centered",
  },
];

const MAX_EXTRA_IMAGES = 8;

type ExtraImage = {
  id: string;
  name: string;
  image: HTMLImageElement;
  thumbnail: string;
};

function createThumbnail(image: HTMLImageElement): string {
  const scale = Math.min(
    1,
    96 / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = getContext(canvas);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

type MergeDialogProps = {
  canvas: HTMLCanvasElement;
  onClose: () => void;
  onApply: (snapshot: SnapshotOp) => void;
};

export function MergeDialog({ canvas, onClose, onApply }: MergeDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [extras, setExtras] = useState<ExtraImage[]>([]);
  const [layout, setLayout] = useState<MergeLayout>("side-by-side");
  const [opacity, setOpacity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const merged = useMemo(
    () =>
      buildMerge(
        canvas,
        extras.map((extra) => extra.image),
        layout,
        opacity,
      ),
    [canvas, extras, layout, opacity],
  );

  useEffect(() => {
    const display = previewRef.current;
    if (!display) {
      return;
    }

    const scale = Math.min(1, 920 / merged.width, 520 / merged.height);
    display.width = Math.max(1, Math.round(merged.width * scale));
    display.height = Math.max(1, Math.round(merged.height * scale));

    const context = getContext(display);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(merged, 0, 0, display.width, display.height);
  }, [merged]);

  const handleFiles = async (files: File[]) => {
    const available = MAX_EXTRA_IMAGES - extras.length;
    if (available <= 0) {
      setError(`You can combine up to ${MAX_EXTRA_IMAGES} images.`);
      return;
    }

    const selected = files.slice(0, available);
    if (files.length > available) {
      setError(`Only the first ${available} images were added.`);
    } else {
      setError(null);
    }

    setLoading(true);
    const loaded: ExtraImage[] = [];

    for (const file of selected) {
      if (!isImageFile(file)) {
        setError(`${file.name} isn't an image and was skipped.`);
        continue;
      }
      try {
        const image = await loadImageFile(file);
        loaded.push({
          id: crypto.randomUUID(),
          name: stripExtension(file.name || "image"),
          image,
          thumbnail: createThumbnail(image),
        });
      } catch {
        setError(`${file.name} could not be opened.`);
      }
    }

    setExtras((current) => [...current, ...loaded]);
    setLoading(false);
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length > 0) {
      void handleFiles(files);
    }
  };

  const move = (index: number, direction: -1 | 1) => {
    setExtras((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) {
        return current;
      }
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleApply = async () => {
    setApplying(true);
    setError(null);

    try {
      const snapshot = await createSnapshotOpFromCanvas(merged, "Merged image");
      onApply(snapshot);
    } catch {
      setError("The merged image could not be created.");
      setApplying(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Merge images"
      description="The current image is always included first."
      className="max-w-3xl"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleApply}
            disabled={extras.length === 0 || loading || applying}
          >
            {applying ? "Merging…" : "Apply merge"}
          </Button>
        </>
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileInput}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || extras.length >= MAX_EXTRA_IMAGES}
          >
            <ImagePlus className="h-3.5 w-3.5" />
            {loading ? "Adding…" : "Add images"}
          </Button>
          <span className="text-xs text-zinc-500">
            {extras.length}/{MAX_EXTRA_IMAGES} added
          </span>
        </div>
        <span className="text-xs text-zinc-400 tabular-nums">
          Result: {merged.width} × {merged.height} px
        </span>
      </div>

      <div className="mt-3 grid gap-1.5 sm:grid-cols-3">
        {LAYOUTS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setLayout(option.value)}
            aria-pressed={layout === option.value}
            className={
              layout === option.value
                ? "rounded-lg border border-blue-500 bg-blue-500/10 px-3 py-2 text-left"
                : "rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-900"
            }
          >
            <span className="block text-sm font-semibold text-zinc-100">
              {option.label}
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-zinc-400">
              {option.description}
            </span>
          </button>
        ))}
      </div>

      {layout === "overlay" ? (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="merge-opacity"
              className="text-xs font-medium text-zinc-400"
            >
              Overlay opacity
            </label>
            <span className="text-xs text-zinc-400 tabular-nums">
              {Math.round(opacity * 100)}%
            </span>
          </div>
          <input
            id="merge-opacity"
            type="range"
            min={0.1}
            max={1}
            step={0.01}
            value={opacity}
            onChange={(event) => setOpacity(Number(event.target.value))}
            className="w-full accent-blue-500"
          />
        </div>
      ) : null}

      {extras.length > 0 ? (
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {extras.map((extra, index) => (
            <li
              key={extra.id}
              className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-1.5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={extra.thumbnail}
                alt=""
                className="h-9 w-9 rounded border border-zinc-700 bg-zinc-800 object-cover"
              />
              <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">
                {index + 2}. {extra.name}
              </span>
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                title="Move earlier"
                aria-label={`Move ${extra.name} earlier`}
                className="inline-flex h-7 w-7 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:pointer-events-none disabled:opacity-30"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === extras.length - 1}
                title="Move later"
                aria-label={`Move ${extra.name} later`}
                className="inline-flex h-7 w-7 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:pointer-events-none disabled:opacity-30"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setExtras((current) =>
                    current.filter((item) => item.id !== extra.id),
                  )
                }
                title={`Remove ${extra.name}`}
                aria-label={`Remove ${extra.name}`}
                className="inline-flex h-7 w-7 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-red-950/60 hover:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-lg border border-dashed border-zinc-800 px-3 py-4 text-center text-xs text-zinc-500">
          Add at least one more image to merge with the current one.
        </p>
      )}

      <div
        className="mt-3 flex max-h-[46vh] min-h-40 items-center justify-center overflow-auto rounded-lg border border-zinc-800 p-2"
        style={CHECKERBOARD}
      >
        <canvas
          ref={previewRef}
          aria-label="Merge preview"
          className="h-auto max-h-[44vh] w-auto max-w-full"
        />
      </div>

      {error ? (
        <p className="mt-3 rounded-md border border-amber-900/50 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
