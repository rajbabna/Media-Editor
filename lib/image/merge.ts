import { createCanvas, getContext } from "./canvas";
import type { MergeLayout } from "./types";
import { MAX_CANVAS_DIMENSION } from "./types";

function fitWithin(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Combines the current image with additional images. The current image always
 * comes first. Side-by-side and stacked layouts scale everything to a common
 * edge; overlay scales each image to fit inside the base image.
 */
export function buildMerge(
  base: HTMLCanvasElement,
  extras: HTMLImageElement[],
  layout: MergeLayout,
  overlayOpacity = 1,
): HTMLCanvasElement {
  if (layout === "overlay") {
    const canvas = createCanvas(base.width, base.height);
    const context = getContext(canvas);
    context.drawImage(base, 0, 0);
    context.globalAlpha = overlayOpacity;

    for (const image of extras) {
      const size = fitWithin(
        image.naturalWidth,
        image.naturalHeight,
        canvas.width,
        canvas.height,
      );
      context.drawImage(
        image,
        Math.round((canvas.width - size.width) / 2),
        Math.round((canvas.height - size.height) / 2),
        size.width,
        size.height,
      );
    }

    return canvas;
  }

  const items = [
    { width: base.width, height: base.height, image: base },
    ...extras.map((image) => ({
      width: image.naturalWidth,
      height: image.naturalHeight,
      image,
    })),
  ];

  if (layout === "side-by-side") {
    const targetHeight = Math.max(...items.map((item) => item.height));
    let totalWidth = 0;
    const scaled = items.map((item) => {
      const width = Math.max(
        1,
        Math.round((item.width * targetHeight) / item.height),
      );
      totalWidth += width;
      return { ...item, width, height: targetHeight };
    });

    const factor = Math.min(
      1,
      MAX_CANVAS_DIMENSION / totalWidth,
      MAX_CANVAS_DIMENSION / targetHeight,
    );
    const canvas = createCanvas(totalWidth * factor, targetHeight * factor);
    const context = getContext(canvas);
    let offsetX = 0;

    for (const item of scaled) {
      const width = item.width * factor;
      const height = item.height * factor;
      context.drawImage(item.image, offsetX, 0, width, height);
      offsetX += width;
    }

    return canvas;
  }

  const targetWidth = Math.max(...items.map((item) => item.width));
  let totalHeight = 0;
  const scaled = items.map((item) => {
    const height = Math.max(
      1,
      Math.round((item.height * targetWidth) / item.width),
    );
    totalHeight += height;
    return { ...item, width: targetWidth, height };
  });

  const factor = Math.min(
    1,
    MAX_CANVAS_DIMENSION / targetWidth,
    MAX_CANVAS_DIMENSION / totalHeight,
  );
  const canvas = createCanvas(targetWidth * factor, totalHeight * factor);
  const context = getContext(canvas);
  let offsetY = 0;

  for (const item of scaled) {
    const width = item.width * factor;
    const height = item.height * factor;
    context.drawImage(item.image, 0, offsetY, width, height);
    offsetY += height;
  }

  return canvas;
}
