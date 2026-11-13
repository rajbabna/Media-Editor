"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  downloadBlob,
  exportCanvas,
  extensionForFormat,
  stripExtension,
} from "@/lib/image/file";
import type { ExportFormat } from "@/lib/image/types";
import { cn } from "@/lib/utils";

const FORMAT_OPTIONS: Array<{
  value: ExportFormat;
  label: string;
  description: string;
}> = [
  {
    value: "png",
    label: "PNG",
    description: "Lossless, keeps transparency",
  },
  {
    value: "jpeg",
    label: "JPG",
    description: "Smallest file, no transparency",
  },
  {
    value: "webp",
    label: "WebP",
    description: "Small files with transparency",
  },
];

const FORMAT_STORAGE_KEY = "image-editor.export-format";
const QUALITY_STORAGE_KEY = "image-editor.export-quality";

function readSavedFormat(): ExportFormat {
  if (typeof window === "undefined") {
    return "png";
  }
  try {
    const saved = window.localStorage.getItem(FORMAT_STORAGE_KEY);
    if (saved === "png" || saved === "jpeg" || saved === "webp") {
      return saved;
    }
  } catch {
    // Storage may be unavailable (private mode); use the default.
  }
  return "png";
}

function readSavedQuality(): number {
  if (typeof window === "undefined") {
    return 0.92;
  }
  try {
    const saved = Number(window.localStorage.getItem(QUALITY_STORAGE_KEY));
    if (Number.isFinite(saved) && saved > 0) {
      return Math.min(1, Math.max(0.3, saved));
    }
  } catch {
    // Storage may be unavailable (private mode); use the default.
  }
  return 0.92;
}

type ExportDialogProps = {
  canvas: HTMLCanvasElement;
  fileName: string;
  onClose: () => void;
};

export function ExportDialog({ canvas, fileName, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>(readSavedFormat);
  const [quality, setQuality] = useState<number>(readSavedQuality);
  const [name, setName] = useState(() => stripExtension(fileName || "image"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extension = extensionForFormat(format);
  const cleanName = name.trim().replace(/\.(png|jpe?g|webp)$/i, "") || "image";

  const handleExport = async () => {
    setBusy(true);
    setError(null);

    try {
      const blob = await exportCanvas(canvas, format, quality);
      downloadBlob(blob, `${cleanName}.${extension}`);

      try {
        window.localStorage.setItem(FORMAT_STORAGE_KEY, format);
        window.localStorage.setItem(QUALITY_STORAGE_KEY, String(quality));
      } catch {
        // Ignore storage failures.
      }

      onClose();
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "The image could not be exported.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Export image"
      description={`${canvas.width} × ${canvas.height} px`}
      className="max-w-md"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleExport}
            disabled={busy}
          >
            {busy ? "Exporting…" : `Download ${extension.toUpperCase()}`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-zinc-400">File format</span>
        <div className="grid gap-1.5 sm:grid-cols-3">
          {FORMAT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFormat(option.value)}
              aria-pressed={format === option.value}
              className={cn(
                "rounded-lg border px-3 py-2 text-left transition-colors",
                format === option.value
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900",
              )}
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
      </div>

      <label className="mt-4 flex flex-col gap-1.5">
        <span className="text-xs font-medium text-zinc-400">File name</span>
        <div className="flex items-center rounded-md border border-zinc-700 bg-zinc-900 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/30">
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-9 min-w-0 flex-1 bg-transparent px-2.5 text-sm text-zinc-100 outline-none"
            placeholder="image"
          />
          <span className="pr-2.5 text-xs text-zinc-500">.{extension}</span>
        </div>
      </label>

      {format !== "png" ? (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="export-quality"
              className="text-xs font-medium text-zinc-400"
            >
              Quality
            </label>
            <span className="text-xs text-zinc-400 tabular-nums">
              {Math.round(quality * 100)}%
            </span>
          </div>
          <input
            id="export-quality"
            type="range"
            min={0.3}
            max={1}
            step={0.01}
            value={quality}
            onChange={(event) => setQuality(Number(event.target.value))}
            className="w-full accent-blue-500"
          />
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
