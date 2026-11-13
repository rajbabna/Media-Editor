"use client";

import {
  Crop,
  FlipHorizontal2,
  FlipVertical2,
  ImagePlus,
  Layers,
  Redo2,
  RefreshCcw,
  RotateCcw,
  RotateCw,
  Scaling,
  SlidersHorizontal,
  Undo2,
  Wand2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { RotateDegrees } from "@/lib/image/types";

type ToolbarProps = {
  hasImage: boolean;
  canUndo: boolean;
  canRedo: boolean;
  hasEdits: boolean;
  onOpen: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onRotate: (degrees: RotateDegrees) => void;
  onFlip: (axis: "horizontal" | "vertical") => void;
  onCrop: () => void;
  onResize: () => void;
  onMerge: () => void;
  onAdjust: () => void;
  onRemoveBackground: () => void;
  onReset: () => void;
};

function Divider() {
  return <span className="mx-1 h-5 w-px bg-zinc-800" aria-hidden="true" />;
}

export function Toolbar({
  hasImage,
  canUndo,
  canRedo,
  hasEdits,
  onOpen,
  onUndo,
  onRedo,
  onRotate,
  onFlip,
  onCrop,
  onResize,
  onMerge,
  onAdjust,
  onRemoveBackground,
  onReset,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-zinc-800 bg-zinc-900/50 px-3 py-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={onOpen}
        title="Open an image (Ctrl+O)"
      >
        <ImagePlus className="h-3.5 w-3.5" />
        Open
      </Button>

      <Divider />

      <Button
        variant="ghost"
        size="icon"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo"
      >
        <Redo2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onReset}
        disabled={!hasEdits}
        title="Revert all edits"
        aria-label="Revert all edits"
      >
        <RefreshCcw className="h-4 w-4" />
      </Button>

      <Divider />

      <Button
        variant="ghost"
        size="icon"
        onClick={() => onRotate(270)}
        disabled={!hasImage}
        title="Rotate left 90°"
        aria-label="Rotate left 90 degrees"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onRotate(90)}
        disabled={!hasImage}
        title="Rotate right 90°"
        aria-label="Rotate right 90 degrees"
      >
        <RotateCw className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onFlip("horizontal")}
        disabled={!hasImage}
        title="Flip horizontally"
        aria-label="Flip horizontally"
      >
        <FlipHorizontal2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onFlip("vertical")}
        disabled={!hasImage}
        title="Flip vertically"
        aria-label="Flip vertically"
      >
        <FlipVertical2 className="h-4 w-4" />
      </Button>

      <Divider />

      <Button
        variant="secondary"
        size="sm"
        onClick={onCrop}
        disabled={!hasImage}
        title="Crop image"
      >
        <Crop className="h-3.5 w-3.5" />
        Crop
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={onResize}
        disabled={!hasImage}
        title="Resize image"
      >
        <Scaling className="h-3.5 w-3.5" />
        Resize
      </Button>

      <Divider />

      <Button
        variant="secondary"
        size="sm"
        onClick={onMerge}
        disabled={!hasImage}
        title="Merge another image"
      >
        <Layers className="h-3.5 w-3.5" />
        Merge
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={onAdjust}
        disabled={!hasImage}
        title="Adjust brightness, contrast, saturation, and filters"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Adjust
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={onRemoveBackground}
        disabled={!hasImage}
        title="Remove the background with AI"
      >
        <Wand2 className="h-3.5 w-3.5" />
        Remove background
      </Button>
    </div>
  );
}
