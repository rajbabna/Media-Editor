"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { MAX_CANVAS_DIMENSION } from "@/lib/image/types";
import { clamp } from "@/lib/utils";

type ResizeDialogProps = {
  baseWidth: number;
  baseHeight: number;
  onClose: () => void;
  onApply: (size: { width: number; height: number }) => void;
};

const PRESETS = [
  { label: "25%", factor: 0.25 },
  { label: "50%", factor: 0.5 },
  { label: "75%", factor: 0.75 },
  { label: "100%", factor: 1 },
];

export function ResizeDialog({
  baseWidth,
  baseHeight,
  onClose,
  onApply,
}: ResizeDialogProps) {
  const [width, setWidth] = useState(String(baseWidth));
  const [height, setHeight] = useState(String(baseHeight));
  const [locked, setLocked] = useState(true);

  const ratio = baseWidth / baseHeight;
  const parsedWidth = Number(width);
  const parsedHeight = Number(height);
  const isValid =
    Number.isInteger(parsedWidth) &&
    Number.isInteger(parsedHeight) &&
    parsedWidth >= 1 &&
    parsedHeight >= 1 &&
    parsedWidth <= MAX_CANVAS_DIMENSION &&
    parsedHeight <= MAX_CANVAS_DIMENSION;
  const unchanged = parsedWidth === baseWidth && parsedHeight === baseHeight;
  const isUpscaling = parsedWidth > baseWidth || parsedHeight > baseHeight;

  const handleWidthChange = (value: string) => {
    setWidth(value);
    if (locked) {
      const next = Number(value);
      if (Number.isFinite(next) && next > 0) {
        setHeight(String(Math.max(1, Math.round(next / ratio))));
      }
    }
  };

  const handleHeightChange = (value: string) => {
    setHeight(value);
    if (locked) {
      const next = Number(value);
      if (Number.isFinite(next) && next > 0) {
        setWidth(String(Math.max(1, Math.round(next * ratio))));
      }
    }
  };

  const applyPreset = (factor: number) => {
    setWidth(String(Math.max(1, Math.round(baseWidth * factor))));
    setHeight(String(Math.max(1, Math.round(baseHeight * factor))));
  };

  const handleApply = () => {
    if (!isValid) {
      return;
    }
    onApply({
      width: clamp(parsedWidth, 1, MAX_CANVAS_DIMENSION),
      height: clamp(parsedHeight, 1, MAX_CANVAS_DIMENSION),
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Resize image"
      description={`Current size: ${baseWidth} × ${baseHeight} px`}
      className="max-w-md"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleApply}
            disabled={!isValid || unchanged}
          >
            Apply resize
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => applyPreset(preset.factor)}
            className="rounded-md border border-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-400">Width (px)</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_CANVAS_DIMENSION}
            step={1}
            value={width}
            onChange={(event) => handleWidthChange(event.target.value)}
            className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2.5 text-sm text-zinc-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-400">Height (px)</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_CANVAS_DIMENSION}
            step={1}
            value={height}
            onChange={(event) => handleHeightChange(event.target.value)}
            className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2.5 text-sm text-zinc-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
          />
        </label>
      </div>

      <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
        <input
          type="checkbox"
          checked={locked}
          onChange={(event) => setLocked(event.target.checked)}
          className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 accent-blue-600"
        />
        Lock aspect ratio
      </label>

      <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
        {isValid
          ? isUpscaling
            ? "Upscaling can look blurry. The maximum output size is 16384 px per side."
            : "The maximum output size is 16384 px per side."
          : `Enter whole numbers between 1 and ${MAX_CANVAS_DIMENSION}.`}
      </p>
    </Modal>
  );
}
