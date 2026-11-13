"use client";

import {
  ArrowLeft,
  Download,
  FolderOpen,
  ImageOff,
  ImagePlus,
  Loader2,
  RefreshCcw,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

import { AdjustDialog } from "@/components/image/adjust-dialog";
import { CanvasViewport } from "@/components/image/canvas-viewport";
import { CropDialog } from "@/components/image/crop-dialog";
import { ExportDialog } from "@/components/image/export-dialog";
import { MergeDialog } from "@/components/image/merge-dialog";
import { ProjectsDialog } from "@/components/image/projects-dialog";
import { RemoveBackgroundDialog } from "@/components/image/remove-background-dialog";
import { ResizeDialog } from "@/components/image/resize-dialog";
import { Toolbar } from "@/components/image/toolbar";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/image/file";
import { renderImage } from "@/lib/image/render";
import {
  MAX_IMAGE_BYTES,
  type AdjustOp,
  type PixelRect,
  type RotateDegrees,
  type SnapshotOp,
} from "@/lib/image/types";
import { useEditorStore } from "@/store/editor-store";

type Dialog =
  | "crop"
  | "resize"
  | "export"
  | "merge"
  | "adjust"
  | "background"
  | "projects"
  | null;

function hasFiles(event: DragEvent<HTMLDivElement>): boolean {
  return Array.from(event.dataTransfer.types).includes("Files");
}

export function ImageEditor() {
  const source = useEditorStore((state) => state.source);
  const fileName = useEditorStore((state) => state.fileName);
  const ops = useEditorStore((state) => state.ops);
  const opIndex = useEditorStore((state) => state.opIndex);
  const revision = useEditorStore((state) => state.revision);
  const isLoading = useEditorStore((state) => state.isLoading);
  const error = useEditorStore((state) => state.error);
  const loadFile = useEditorStore((state) => state.loadFile);
  const addOp = useEditorStore((state) => state.addOp);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const reset = useEditorStore((state) => state.reset);
  const clear = useEditorStore((state) => state.clear);
  const clearError = useEditorStore((state) => state.clearError);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [isDragging, setIsDragging] = useState(false);

  const canvas = useMemo(() => {
    if (!source) {
      return null;
    }
    return renderImage(source, ops.slice(0, opIndex));
  }, [source, ops, opIndex]);

  const hasImage = Boolean(canvas);
  const canUndo = opIndex > 0;
  const canRedo = opIndex < ops.length;
  const hasEdits = ops.length > 0;

  const openPicker = () => {
    fileInputRef.current?.click();
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      void loadFile(file);
    }
  };

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items || dialog) {
        return;
      }
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            void loadFile(file);
            return;
          }
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [dialog, loadFile]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }

      const modifier = event.metaKey || event.ctrlKey;
      if (!modifier || dialog) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if (key === "y") {
        event.preventDefault();
        redo();
      } else if (key === "o") {
        event.preventDefault();
        openPicker();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dialog, undo, redo]);

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(event)) {
      return;
    }
    event.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(event)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(event)) {
      return;
    }
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    if (dialog) {
      return;
    }
    const [file] = Array.from(event.dataTransfer.files);
    if (file) {
      void loadFile(file);
    }
  };

  const handleRotate = (degrees: RotateDegrees) => {
    addOp({ type: "rotate", degrees });
  };

  const handleReset = () => {
    if (!hasEdits) {
      return;
    }
    if (window.confirm("Discard all edits and restore the original image?")) {
      reset();
    }
  };

  const handleRemoveImage = () => {
    if (
      hasEdits &&
      !window.confirm(
        "Remove this image and discard all edits? This cannot be undone.",
      )
    ) {
      return;
    }
    clear();
  };

  const handleApplyCrop = (rect: PixelRect) => {
    addOp({ type: "crop", ...rect });
    setDialog(null);
  };

  const handleApplyResize = (size: { width: number; height: number }) => {
    addOp({ type: "resize", ...size });
    setDialog(null);
  };

  const handleApplyAdjust = (op: AdjustOp) => {
    addOp(op);
    setDialog(null);
  };

  const handleApplySnapshot = (snapshot: SnapshotOp) => {
    addOp(snapshot);
    setDialog(null);
  };

  return (
    <div
      className="relative flex h-dvh flex-col bg-zinc-950 text-zinc-100"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInput}
      />

      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-800 px-3 sm:px-4">
        <Link
          href="/"
          aria-label="Back to home"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold tracking-tight">
            {fileName || "Image editor"}
          </h1>
          <p className="truncate text-[11px] text-zinc-500">
            {canvas
              ? `${canvas.width} × ${canvas.height} px`
              : "Open an image to start"}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDialog("projects")}
            title="Save or open a project"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Projects</span>
          </Button>
          {hasEdits ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              title="Revert all edits"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Revert</span>
            </Button>
          ) : null}
          {source ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveImage}
              title="Remove the current image"
              aria-label="Remove image"
            >
              <ImageOff className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Remove</span>
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            onClick={openPicker}
            title="Open an image (Ctrl+O)"
          >
            <ImagePlus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Open</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setDialog("export")}
            disabled={!hasImage}
            title="Export image"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </header>

      {source ? (
        <Toolbar
          hasImage={hasImage}
          canUndo={canUndo}
          canRedo={canRedo}
          hasEdits={hasEdits}
          onOpen={openPicker}
          onUndo={undo}
          onRedo={redo}
          onRotate={handleRotate}
          onFlip={(axis) => addOp({ type: "flip", axis })}
          onCrop={() => setDialog("crop")}
          onResize={() => setDialog("resize")}
          onMerge={() => setDialog("merge")}
          onAdjust={() => setDialog("adjust")}
          onRemoveBackground={() => setDialog("background")}
          onReset={handleReset}
        />
      ) : null}

      {error ? (
        <div className="flex shrink-0 items-center gap-3 border-b border-amber-900/50 bg-amber-950/40 px-4 py-2 text-xs text-amber-200">
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={clearError}
            aria-label="Dismiss error"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-amber-300 transition-colors hover:bg-amber-900/50 hover:text-amber-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <main className="relative min-h-0 flex-1">
        {canvas ? (
          <CanvasViewport key={revision} canvas={canvas} />
        ) : (
          <EmptyState onOpen={openPicker} />
        )}

        {isLoading ? (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-zinc-950/70 backdrop-blur-sm">
            <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-200 shadow-xl">
              <Loader2 className="h-4 w-4 animate-spin" />
              Opening image…
            </div>
          </div>
        ) : null}

        {isDragging && !dialog ? (
          <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center border-2 border-dashed border-blue-500 bg-blue-500/10">
            <div className="rounded-xl border border-blue-500/40 bg-zinc-950/90 px-6 py-3 text-sm font-medium text-blue-200 shadow-xl">
              Drop image to open
            </div>
          </div>
        ) : null}
      </main>

      <footer className="flex h-8 shrink-0 items-center justify-between gap-4 border-t border-zinc-800 bg-zinc-950 px-4 text-[11px] text-zinc-500">
        <span>
          {ops.length > 0
            ? `Step ${opIndex} of ${ops.length}`
            : "Original image"}
        </span>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline">
            Everything stays on your device
          </span>
          <span className="hidden md:inline">
            Ctrl+Z undo · Ctrl+Shift+Z redo
          </span>
        </div>
      </footer>

      {dialog === "crop" && canvas ? (
        <CropDialog
          canvas={canvas}
          onClose={() => setDialog(null)}
          onApply={handleApplyCrop}
        />
      ) : null}
      {dialog === "resize" && canvas ? (
        <ResizeDialog
          baseWidth={canvas.width}
          baseHeight={canvas.height}
          onClose={() => setDialog(null)}
          onApply={handleApplyResize}
        />
      ) : null}
      {dialog === "export" && canvas ? (
        <ExportDialog
          canvas={canvas}
          fileName={fileName}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "merge" && canvas ? (
        <MergeDialog
          canvas={canvas}
          onClose={() => setDialog(null)}
          onApply={handleApplySnapshot}
        />
      ) : null}
      {dialog === "adjust" && canvas ? (
        <AdjustDialog
          canvas={canvas}
          onClose={() => setDialog(null)}
          onApply={handleApplyAdjust}
        />
      ) : null}
      {dialog === "background" && canvas ? (
        <RemoveBackgroundDialog
          canvas={canvas}
          onClose={() => setDialog(null)}
          onApply={handleApplySnapshot}
        />
      ) : null}
      {dialog === "projects" ? (
        <ProjectsDialog canvas={canvas} onClose={() => setDialog(null)} />
      ) : null}
    </div>
  );
}

function EmptyState({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full max-w-xl flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-zinc-700 bg-zinc-900/40 px-8 py-14 text-center transition-colors hover:border-blue-500/70 hover:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
      >
        <span className="rounded-full bg-zinc-800 p-4 text-zinc-300 transition-colors group-hover:bg-blue-500/15 group-hover:text-blue-400">
          <ImagePlus className="h-8 w-8" />
        </span>
        <span className="text-lg font-semibold text-zinc-100">
          Drop an image here
        </span>
        <span className="text-sm text-zinc-400">
          or click to browse, or paste from your clipboard
        </span>
        <span className="text-xs text-zinc-500">
          PNG, JPG, WebP, GIF, AVIF, SVG · up to {formatBytes(MAX_IMAGE_BYTES)}
        </span>
      </button>
    </div>
  );
}
