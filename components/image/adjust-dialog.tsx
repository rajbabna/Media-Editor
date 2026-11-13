"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { CHECKERBOARD } from "@/components/image/checkerboard";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  applyAdjustmentToCanvas,
  DEFAULT_ADJUSTMENTS,
  isNeutralAdjustment,
  type Adjustments,
} from "@/lib/image/adjust";
import { getContext, scaleCanvas } from "@/lib/image/canvas";
import type { AdjustOp, AdjustPreset } from "@/lib/image/types";

const PRESETS: Array<{ value: AdjustPreset; label: string }> = [
  { value: "none", label: "None" },
  { value: "grayscale", label: "Mono" },
  { value: "sepia", label: "Sepia" },
  { value: "warm", label: "Warm" },
  { value: "cool", label: "Cool" },
];

const SLIDERS: Array<{
  key: "brightness" | "contrast" | "saturation";
  label: string;
}> = [
  { key: "brightness", label: "Brightness" },
  { key: "contrast", label: "Contrast" },
  { key: "saturation", label: "Saturation" },
];

type AdjustDialogProps = {
  canvas: HTMLCanvasElement;
  onClose: () => void;
  onApply: (op: AdjustOp) => void;
};

export function AdjustDialog({ canvas, onClose, onApply }: AdjustDialogProps) {
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [values, setValues] = useState<Adjustments>(DEFAULT_ADJUSTMENTS);

  const previewBase = useMemo(() => scaleCanvas(canvas, 1400), [canvas]);
  const preview = useMemo(
    () => applyAdjustmentToCanvas(previewBase, values),
    [previewBase, values],
  );

  useEffect(() => {
    const display = previewRef.current;
    if (!display) {
      return;
    }
    display.width = preview.width;
    display.height = preview.height;
    getContext(display).drawImage(preview, 0, 0);
  }, [preview]);

  const update = (patch: Partial<Adjustments>) => {
    setValues((current) => ({ ...current, ...patch }));
  };

  const neutral = isNeutralAdjustment(values);

  return (
    <Modal
      open
      onClose={onClose}
      title="Adjust image"
      description="Preview is downscaled; full resolution is applied on export."
      className="max-w-3xl"
      footer={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setValues(DEFAULT_ADJUSTMENTS)}
            disabled={neutral}
          >
            Reset
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onApply({ type: "adjust", ...values })}
            disabled={neutral}
          >
            Apply adjustments
          </Button>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium text-zinc-400">Preset</span>
        {PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => update({ preset: preset.value })}
            aria-pressed={values.preset === preset.value}
            className={
              values.preset === preset.value
                ? "rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white"
                : "rounded-md border border-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800"
            }
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div
        className="flex max-h-[40vh] min-h-40 items-center justify-center overflow-auto rounded-lg border border-zinc-800 p-2"
        style={CHECKERBOARD}
      >
        <canvas
          ref={previewRef}
          aria-label="Adjustment preview"
          className="h-auto max-h-[38vh] w-auto max-w-full"
        />
      </div>

      <div className="mt-4 space-y-3">
        {SLIDERS.map((slider) => (
          <div key={slider.key}>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor={`adjust-${slider.key}`}
                className="text-xs font-medium text-zinc-400"
              >
                {slider.label}
              </label>
              <span className="text-xs text-zinc-400 tabular-nums">
                {values[slider.key] > 0 ? "+" : ""}
                {values[slider.key]}
              </span>
            </div>
            <input
              id={`adjust-${slider.key}`}
              type="range"
              min={-100}
              max={100}
              step={1}
              value={values[slider.key]}
              onChange={(event) =>
                update({
                  [slider.key]: Number(event.target.value),
                } as Partial<Adjustments>)
              }
              className="w-full accent-blue-500"
            />
          </div>
        ))}
      </div>
    </Modal>
  );
}
