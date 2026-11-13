import { canvasToBlob, loadImageFromBlob } from "./file";
import type { SnapshotOp } from "./types";

export async function createSnapshotOpFromBlob(
  blob: Blob,
  label?: string,
): Promise<SnapshotOp> {
  const image = await loadImageFromBlob(blob);
  return { type: "snapshot", image, blob, label };
}

export async function createSnapshotOpFromCanvas(
  canvas: HTMLCanvasElement,
  label?: string,
): Promise<SnapshotOp> {
  const blob = await canvasToBlob(canvas, "image/png");
  return createSnapshotOpFromBlob(blob, label);
}
