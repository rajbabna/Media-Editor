import { adjustOpToAdjustments, applyAdjustmentToCanvas } from "./adjust";
import { createCanvas, getContext } from "./canvas";
import {
  MAX_CANVAS_DIMENSION,
  type ImageOp,
  type RotateDegrees,
} from "./types";

function rotate(
  source: HTMLCanvasElement,
  degrees: RotateDegrees,
): HTMLCanvasElement {
  const width = source.width;
  const height = source.height;
  const swap = degrees !== 180;
  const canvas = createCanvas(swap ? height : width, swap ? width : height);
  const context = getContext(canvas);

  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((degrees * Math.PI) / 180);
  context.drawImage(source, -width / 2, -height / 2);

  return canvas;
}

function flip(
  source: HTMLCanvasElement,
  axis: "horizontal" | "vertical",
): HTMLCanvasElement {
  const canvas = createCanvas(source.width, source.height);
  const context = getContext(canvas);

  context.translate(
    axis === "horizontal" ? canvas.width : 0,
    axis === "vertical" ? canvas.height : 0,
  );
  context.scale(axis === "horizontal" ? -1 : 1, axis === "vertical" ? -1 : 1);
  context.drawImage(source, 0, 0);

  return canvas;
}

function crop(
  source: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
): HTMLCanvasElement {
  const sourceWidth = source.width;
  const sourceHeight = source.height;
  const cropX = Math.min(Math.max(Math.round(x), 0), sourceWidth - 1);
  const cropY = Math.min(Math.max(Math.round(y), 0), sourceHeight - 1);
  const cropWidth = Math.min(
    Math.max(Math.round(width), 1),
    sourceWidth - cropX,
  );
  const cropHeight = Math.min(
    Math.max(Math.round(height), 1),
    sourceHeight - cropY,
  );

  const canvas = createCanvas(cropWidth, cropHeight);
  const context = getContext(canvas);
  context.drawImage(
    source,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight,
  );

  return canvas;
}

function resize(
  source: HTMLCanvasElement,
  width: number,
  height: number,
): HTMLCanvasElement {
  const targetWidth = Math.min(
    Math.max(Math.round(width), 1),
    MAX_CANVAS_DIMENSION,
  );
  const targetHeight = Math.min(
    Math.max(Math.round(height), 1),
    MAX_CANVAS_DIMENSION,
  );

  const canvas = createCanvas(targetWidth, targetHeight);
  const context = getContext(canvas);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, targetWidth, targetHeight);

  return canvas;
}

function drawSnapshot(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = createCanvas(image.naturalWidth, image.naturalHeight);
  getContext(canvas).drawImage(image, 0, 0);
  return canvas;
}

function applyOp(source: HTMLCanvasElement, op: ImageOp): HTMLCanvasElement {
  switch (op.type) {
    case "rotate":
      return rotate(source, op.degrees);
    case "flip":
      return flip(source, op.axis);
    case "crop":
      return crop(source, op.x, op.y, op.width, op.height);
    case "resize":
      return resize(source, op.width, op.height);
    case "adjust":
      return applyAdjustmentToCanvas(source, adjustOpToAdjustments(op));
    case "snapshot":
      return drawSnapshot(op.image);
  }
}

/**
 * Renders the source image through every operation and returns the result.
 * Each operation works on the output of the previous one, so crops and
 * resizes always use the dimensions the user is currently looking at.
 */
export function renderImage(
  source: HTMLImageElement,
  ops: ImageOp[],
): HTMLCanvasElement {
  const width = source.naturalWidth;
  const height = source.naturalHeight;

  if (!width || !height) {
    throw new Error("The image has no usable dimensions.");
  }

  let canvas = createCanvas(width, height);
  const context = getContext(canvas);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0);

  for (const op of ops) {
    canvas = applyOp(canvas, op);
  }

  return canvas;
}
