import { createCanvas, getContext } from "@/lib/image/canvas";
import { clamp } from "@/lib/utils";

export type CleanupOptions = {
  /** Alpha cutoff, 0-255. Pixels below this become fully transparent. */
  threshold: number;
  removeFragments: boolean;
  /** Minimum detached fragment area as a percentage of the largest area. */
  minFragmentPercent: number;
  /** Number of pixels to erode from the edge, 0-4. */
  edgeTighten: number;
  /** Alpha blur radius in pixels, 0-4. */
  feather: number;
};

export const DEFAULT_CLEANUP: CleanupOptions = {
  threshold: 15,
  removeFragments: true,
  minFragmentPercent: 10,
  edgeTighten: 1,
  feather: 1,
};

const MAX_FRAGMENT_MASK_SIZE = 768;

function removeFragments(
  alpha: Uint8Array,
  width: number,
  height: number,
  minFragmentPercent: number,
): void {
  const scale = Math.min(1, MAX_FRAGMENT_MASK_SIZE / Math.max(width, height));
  const smallWidth = Math.max(1, Math.round(width * scale));
  const smallHeight = Math.max(1, Math.round(height * scale));
  const small = new Uint8Array(smallWidth * smallHeight);

  for (let y = 0; y < smallHeight; y += 1) {
    const sourceY = Math.min(height - 1, Math.floor((y + 0.5) / scale));
    for (let x = 0; x < smallWidth; x += 1) {
      const sourceX = Math.min(width - 1, Math.floor((x + 0.5) / scale));
      small[y * smallWidth + x] = alpha[sourceY * width + sourceX] > 0 ? 1 : 0;
    }
  }

  const labels = new Int32Array(small.length);
  const queue = new Int32Array(small.length);
  const areas: number[] = [0];
  let nextLabel = 1;
  let largestArea = 0;

  for (let start = 0; start < small.length; start += 1) {
    if (small[start] === 0 || labels[start] !== 0) {
      continue;
    }

    const label = nextLabel;
    nextLabel += 1;
    let head = 0;
    let tail = 0;
    let area = 0;

    queue[tail] = start;
    tail += 1;
    labels[start] = label;

    while (head < tail) {
      const index = queue[head];
      head += 1;
      area += 1;

      const x = index % smallWidth;
      const y = (index / smallWidth) | 0;

      if (x > 0) {
        const next = index - 1;
        if (small[next] !== 0 && labels[next] === 0) {
          labels[next] = label;
          queue[tail] = next;
          tail += 1;
        }
      }
      if (x < smallWidth - 1) {
        const next = index + 1;
        if (small[next] !== 0 && labels[next] === 0) {
          labels[next] = label;
          queue[tail] = next;
          tail += 1;
        }
      }
      if (y > 0) {
        const next = index - smallWidth;
        if (small[next] !== 0 && labels[next] === 0) {
          labels[next] = label;
          queue[tail] = next;
          tail += 1;
        }
      }
      if (y < smallHeight - 1) {
        const next = index + smallWidth;
        if (small[next] !== 0 && labels[next] === 0) {
          labels[next] = label;
          queue[tail] = next;
          tail += 1;
        }
      }
    }

    areas[label] = area;
    if (area > largestArea) {
      largestArea = area;
    }
  }

  if (largestArea === 0) {
    return;
  }

  const minimumArea = Math.max(
    1,
    Math.ceil(largestArea * (clamp(minFragmentPercent, 1, 100) / 100)),
  );

  const maskData = new Uint8ClampedArray(smallWidth * smallHeight * 4);
  for (let index = 0; index < small.length; index += 1) {
    const label = labels[index];
    if (label === 0 || (areas[label] ?? 0) < minimumArea) {
      continue;
    }
    const offset = index * 4;
    maskData[offset] = 255;
    maskData[offset + 1] = 255;
    maskData[offset + 2] = 255;
    maskData[offset + 3] = 255;
  }

  const smallMask = createCanvas(smallWidth, smallHeight);
  getContext(smallMask).putImageData(
    new ImageData(maskData, smallWidth, smallHeight),
    0,
    0,
  );

  const fullMask = createCanvas(width, height);
  const fullContext = getContext(fullMask);
  fullContext.imageSmoothingEnabled = true;
  fullContext.imageSmoothingQuality = "high";
  fullContext.drawImage(smallMask, 0, 0, width, height);

  const maskPixels = fullContext.getImageData(0, 0, width, height).data;

  for (let index = 0; index < alpha.length; index += 1) {
    if (maskPixels[index * 4 + 3] < 16) {
      alpha[index] = 0;
    }
  }
}

function tightenEdge(
  alpha: Uint8Array,
  width: number,
  height: number,
  radius: number,
): void {
  const passes = clamp(Math.round(radius), 0, 4);
  if (passes === 0) {
    return;
  }

  let current: Uint8Array = alpha;
  let scratch: Uint8Array = new Uint8Array(alpha.length);

  for (let pass = 0; pass < passes; pass += 1) {
    for (let y = 0; y < height; y += 1) {
      const row = y * width;
      for (let x = 0; x < width; x += 1) {
        const index = row + x;
        if (current[index] === 0) {
          scratch[index] = 0;
          continue;
        }

        const left = x === 0 || current[index - 1] !== 0;
        const right = x === width - 1 || current[index + 1] !== 0;
        const up = y === 0 || current[index - width] !== 0;
        const down = y === height - 1 || current[index + width] !== 0;

        scratch[index] = left && right && up && down ? current[index] : 0;
      }
    }

    const swap = current;
    current = scratch;
    scratch = swap;
  }

  if (current !== alpha) {
    alpha.set(current);
  }
}

function featherAlpha(
  alpha: Uint8Array,
  width: number,
  height: number,
  radius: number,
): void {
  const r = clamp(Math.round(radius), 0, 4);
  if (r === 0) {
    return;
  }

  const windowSize = r * 2 + 1;
  const horizontal = new Uint16Array(alpha.length);
  const total = windowSize * windowSize;

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    let sum = 0;

    for (let k = -r; k <= r; k += 1) {
      const x = clamp(k, 0, width - 1);
      sum += alpha[row + x];
    }

    for (let x = 0; x < width; x += 1) {
      horizontal[row + x] = sum;
      const removeX = clamp(x - r, 0, width - 1);
      const addX = clamp(x + r + 1, 0, width - 1);
      sum += alpha[row + addX] - alpha[row + removeX];
    }
  }

  for (let x = 0; x < width; x += 1) {
    let sum = 0;

    for (let k = -r; k <= r; k += 1) {
      const y = clamp(k, 0, height - 1);
      sum += horizontal[y * width + x];
    }

    for (let y = 0; y < height; y += 1) {
      alpha[y * width + x] = Math.round(sum / total);
      const removeY = clamp(y - r, 0, height - 1);
      const addY = clamp(y + r + 1, 0, height - 1);
      sum += horizontal[addY * width + x] - horizontal[removeY * width + x];
    }
  }
}

/**
 * Cleans up a cutout matte: drops faint pixels, removes detached fragments,
 * tightens the edge, and optionally feathers the alpha channel.
 */
export function cleanupCutout(
  source: HTMLCanvasElement,
  options: CleanupOptions,
): HTMLCanvasElement {
  const width = source.width;
  const height = source.height;
  const canvas = createCanvas(width, height);
  const context = getContext(canvas);
  context.drawImage(source, 0, 0);

  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;
  const alpha = new Uint8Array(width * height);
  const threshold = clamp(Math.round(options.threshold), 0, 255);

  for (let index = 0; index < alpha.length; index += 1) {
    const value = data[index * 4 + 3];
    alpha[index] = value < threshold ? 0 : value;
  }

  if (options.removeFragments) {
    removeFragments(alpha, width, height, options.minFragmentPercent);
  }

  tightenEdge(alpha, width, height, options.edgeTighten);
  featherAlpha(alpha, width, height, options.feather);

  for (let index = 0; index < alpha.length; index += 1) {
    data[index * 4 + 3] = alpha[index];
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}
