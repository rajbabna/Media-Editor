"use client";

import { useEffect, useMemo, useState } from "react";
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type PercentCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { PixelRect } from "@/lib/image/types";
import { clamp } from "@/lib/utils";

type AspectValue = "free" | "original" | "1:1" | "4:3" | "16:9";

const ASPECTS: Array<{ value: AspectValue; label: string }> = [
  { value: "free", label: "Free" },
  { value: "original", label: "Original" },
  { value: "1:1", label: "Square" },
  { value: "4:3", label: "4:3" },
  { value: "16:9", label: "16:9" },
];

function aspectRatio(
  value: AspectValue,
  canvas: HTMLCanvasElement,
): number | undefined {
  switch (value) {
    case "free":
      return undefined;
    case "original":
      return canvas.width / canvas.height;
    case "1:1":
      return 1;
    case "4:3":
      return 4 / 3;
    case "16:9":
      return 16 / 9;
  }
}

function initialCrop(
  canvas: HTMLCanvasElement,
  ratio: number | undefined,
): PercentCrop {
  if (!ratio) {
    return { unit: "%", x: 0, y: 0, width: 100, height: 100 };
  }

  return centerCrop(
    makeAspectCrop(
      { unit: "%", width: 80 },
      ratio,
      canvas.width,
      canvas.height,
    ),
    canvas.width,
    canvas.height,
  );
}

function cropToPixels(crop: PercentCrop, canvas: HTMLCanvasElement): PixelRect {
  const x = clamp(
    Math.round((crop.x / 100) * canvas.width),
    0,
    canvas.width - 1,
  );
  const y = clamp(
    Math.round((crop.y / 100) * canvas.height),
    0,
    canvas.height - 1,
  );
  const width = clamp(
    Math.round((crop.width / 100) * canvas.width),
    1,
    canvas.width - x,
  );
  const height = clamp(
    Math.round((crop.height / 100) * canvas.height),
    1,
    canvas.height - y,
  );

  return { x, y, width, height };
}

type CropDialogProps = {
  canvas: HTMLCanvasElement;
  onClose: () => void;
  onApply: (rect: PixelRect) => void;
};

export function CropDialog({ canvas, onClose, onApply }: CropDialogProps) {
  const [crop, setCrop] = useState<PercentCrop>(() =>
    initialCrop(canvas, undefined),
  );
  const [aspect, setAspect] = useState<AspectValue>("free");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    canvas.toBlob((blob) => {
      if (cancelled || !blob) {
        return;
      }
      objectUrl = URL.createObjectURL(blob);
      setPreviewUrl(objectUrl);
    }, "image/png");

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [canvas]);

  const pixelCrop = useMemo(() => cropToPixels(crop, canvas), [crop, canvas]);

  const handleAspectChange = (value: AspectValue) => {
    setAspect(value);
    setCrop(initialCrop(canvas, aspectRatio(value, canvas)));
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Crop image"
      description="Drag the handles to choose the part you want to keep."
      className="max-w-3xl"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onApply(pixelCrop)}
          >
            Apply crop
          </Button>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-zinc-400">Aspect ratio</span>
        <div className="flex flex-wrap gap-1">
          {ASPECTS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleAspectChange(option.value)}
              aria-pressed={aspect === option.value}
              className={
                aspect === option.value
                  ? "rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white"
                  : "rounded-md border border-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800"
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex max-h-[55vh] min-h-48 items-center justify-center overflow-auto rounded-lg border border-zinc-800 bg-zinc-900/60 p-2">
        {previewUrl ? (
          <ReactCrop
            crop={crop}
            aspect={aspectRatio(aspect, canvas)}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            keepSelection
            ruleOfThirds
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Image to crop"
              draggable={false}
              className="max-h-[52vh] w-auto max-w-full select-none"
            />
          </ReactCrop>
        ) : (
          <p className="py-12 text-sm text-zinc-500">Preparing crop preview…</p>
        )}
      </div>

      <p className="mt-2 text-xs text-zinc-400">
        Output: {pixelCrop.width} × {pixelCrop.height} px
      </p>
    </Modal>
  );
}
