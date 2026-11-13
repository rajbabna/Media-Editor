export type RotateDegrees = 90 | 180 | 270;

export type RotateOp = {
  type: "rotate";
  degrees: RotateDegrees;
};

export type FlipOp = {
  type: "flip";
  axis: "horizontal" | "vertical";
};

export type CropOp = {
  type: "crop";
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ResizeOp = {
  type: "resize";
  width: number;
  height: number;
};

export type AdjustPreset = "none" | "grayscale" | "sepia" | "warm" | "cool";

export type AdjustOp = {
  type: "adjust";
  brightness: number;
  contrast: number;
  saturation: number;
  preset: AdjustPreset;
};

export type SnapshotOp = {
  type: "snapshot";
  image: HTMLImageElement;
  blob: Blob;
  label?: string;
};

export type ImageOp =
  RotateOp | FlipOp | CropOp | ResizeOp | AdjustOp | SnapshotOp;

export type PixelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MergeLayout = "side-by-side" | "stacked" | "overlay";

export type ExportFormat = "png" | "jpeg" | "webp";

export const MAX_CANVAS_DIMENSION = 16384;
export const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
