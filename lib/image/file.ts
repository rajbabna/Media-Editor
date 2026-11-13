import type { ExportFormat } from "./types";

const IMAGE_EXTENSION = /\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i;

const FORMAT_INFO: Record<
  ExportFormat,
  { mimeType: string; extension: string }
> = {
  png: { mimeType: "image/png", extension: "png" },
  jpeg: { mimeType: "image/jpeg", extension: "jpg" },
  webp: { mimeType: "image/webp", extension: "webp" },
};

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || IMAGE_EXTENSION.test(file.name);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function stripExtension(fileName: string): string {
  return fileName.replace(IMAGE_EXTENSION, "");
}

export function extensionForFormat(format: ExportFormat): string {
  return FORMAT_INFO[format].extension;
}

export async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);

  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error("The image could not be decoded."));
      image.src = url;
    });

    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error("The image has no usable dimensions.");
    }

    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function loadImageFile(file: File): Promise<HTMLImageElement> {
  return loadImageFromBlob(file);
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("This browser could not encode the image."));
        }
      },
      type,
      quality,
    );
  });
}

/**
 * Encodes the canvas in the requested format. JPEG has no alpha channel, so
 * transparent areas are composited onto white first.
 */
export async function exportCanvas(
  canvas: HTMLCanvasElement,
  format: ExportFormat,
  quality: number,
): Promise<Blob> {
  const { mimeType } = FORMAT_INFO[format];

  let output = canvas;

  if (format === "jpeg") {
    output = document.createElement("canvas");
    output.width = canvas.width;
    output.height = canvas.height;
    const context = output.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D is not available in this browser.");
    }
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, output.width, output.height);
    context.drawImage(canvas, 0, 0);
  }

  return canvasToBlob(output, mimeType, format === "png" ? undefined : quality);
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
