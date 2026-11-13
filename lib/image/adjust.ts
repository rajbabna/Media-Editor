import { getContext } from "./canvas";
import type { AdjustOp, AdjustPreset } from "./types";

export type Adjustments = {
  brightness: number;
  contrast: number;
  saturation: number;
  preset: AdjustPreset;
};

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  preset: "none",
};

export function isNeutralAdjustment({
  brightness,
  contrast,
  saturation,
  preset,
}: Adjustments): boolean {
  return (
    brightness === 0 && contrast === 0 && saturation === 0 && preset === "none"
  );
}

/**
 * Applies brightness, contrast, saturation, and a color preset in place on
 * an RGBA buffer. Uint8ClampedArray handles rounding and clamping.
 */
export function processAdjustments(
  data: Uint8ClampedArray,
  adjustments: Adjustments,
): void {
  const brightnessOffset = (adjustments.brightness / 100) * 128;
  const contrastFactor = 1 + adjustments.contrast / 100;
  const saturationFactor = 1 + adjustments.saturation / 100;

  for (let index = 0; index < data.length; index += 4) {
    let red = data[index] + brightnessOffset;
    let green = data[index + 1] + brightnessOffset;
    let blue = data[index + 2] + brightnessOffset;

    red = (red - 128) * contrastFactor + 128;
    green = (green - 128) * contrastFactor + 128;
    blue = (blue - 128) * contrastFactor + 128;

    if (saturationFactor !== 1) {
      const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      red = luminance + (red - luminance) * saturationFactor;
      green = luminance + (green - luminance) * saturationFactor;
      blue = luminance + (blue - luminance) * saturationFactor;
    }

    switch (adjustments.preset) {
      case "grayscale": {
        const gray = 0.299 * red + 0.587 * green + 0.114 * blue;
        red = gray;
        green = gray;
        blue = gray;
        break;
      }
      case "sepia": {
        const sepiaRed = 0.393 * red + 0.769 * green + 0.189 * blue;
        const sepiaGreen = 0.349 * red + 0.686 * green + 0.168 * blue;
        const sepiaBlue = 0.272 * red + 0.534 * green + 0.131 * blue;
        red = sepiaRed;
        green = sepiaGreen;
        blue = sepiaBlue;
        break;
      }
      case "warm": {
        red = red * 1.08 + 12;
        green = green * 1.02 + 4;
        blue = blue * 0.9;
        break;
      }
      case "cool": {
        red = red * 0.92;
        green = green * 1.01;
        blue = blue * 1.08 + 8;
        break;
      }
      case "none":
        break;
    }

    data[index] = red;
    data[index + 1] = green;
    data[index + 2] = blue;
  }
}

export function applyAdjustmentToCanvas(
  source: HTMLCanvasElement,
  adjustment: Adjustments,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = getContext(canvas);
  context.drawImage(source, 0, 0);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  processAdjustments(imageData.data, adjustment);
  context.putImageData(imageData, 0, 0);

  return canvas;
}

export function adjustOpToAdjustments(op: AdjustOp): Adjustments {
  return {
    brightness: op.brightness,
    contrast: op.contrast,
    saturation: op.saturation,
    preset: op.preset,
  };
}
