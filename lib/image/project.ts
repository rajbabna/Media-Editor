import { createCanvas, getContext } from "./canvas";
import { canvasToBlob, loadImageFromBlob } from "./file";
import type { AdjustPreset, ImageOp, RotateDegrees } from "./types";

export type StoredOp =
  | { type: "rotate"; degrees: RotateDegrees }
  | { type: "flip"; axis: "horizontal" | "vertical" }
  | { type: "crop"; x: number; y: number; width: number; height: number }
  | { type: "resize"; width: number; height: number }
  | {
      type: "adjust";
      brightness: number;
      contrast: number;
      saturation: number;
      preset: AdjustPreset;
    }
  | { type: "snapshot"; blob: Blob; label?: string };

export type ProjectRecord = {
  id: string;
  name: string;
  updatedAt: number;
  originalBlob: Blob;
  ops: StoredOp[];
  opIndex: number;
  width: number;
  height: number;
  thumbnail: Blob;
};

export type ProjectSummary = Pick<
  ProjectRecord,
  "id" | "name" | "updatedAt" | "width" | "height" | "thumbnail"
>;

export function serializeOps(ops: ImageOp[]): StoredOp[] {
  return ops.map((op) => {
    if (op.type === "snapshot") {
      return { type: "snapshot", blob: op.blob, label: op.label };
    }
    return { ...op };
  });
}

export async function deserializeOps(ops: StoredOp[]): Promise<ImageOp[]> {
  return Promise.all(
    ops.map(async (op): Promise<ImageOp> => {
      if (op.type === "snapshot") {
        const image = await loadImageFromBlob(op.blob);
        return {
          type: "snapshot",
          blob: op.blob,
          image,
          label: op.label,
        };
      }
      return op;
    }),
  );
}

export async function createProjectThumbnail(
  canvas: HTMLCanvasElement,
): Promise<Blob> {
  const scale = Math.min(1, 480 / Math.max(canvas.width, canvas.height));
  const thumbnail = createCanvas(canvas.width * scale, canvas.height * scale);
  const context = getContext(thumbnail);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(canvas, 0, 0, thumbnail.width, thumbnail.height);

  return canvasToBlob(thumbnail, "image/png");
}
