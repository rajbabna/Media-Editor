import { canvasToBlob } from "@/lib/image/file";

export type RemovalProgress = {
  phase: "loading" | "inference";
  percent: number | null;
  message: string;
};

const MODEL_ID = "Xenova/modnet";

type ProgressInfoLike = {
  status?: string;
  progress?: number;
};

type Segmenter = {
  // The background-removal pipeline returns a RawImage for a single input.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (image: any): Promise<any>;
};

type RemovalAssets = {
  segmenter: Segmenter;
};

let assetsPromise: Promise<RemovalAssets> | null = null;

export function isRemovalModelCached(): boolean {
  return assetsPromise !== null;
}

async function loadAssets(
  onProgress: (progress: RemovalProgress) => void,
): Promise<RemovalAssets> {
  if (assetsPromise) {
    return assetsPromise;
  }

  const promise = (async () => {
    const { pipeline, env } = await import("@huggingface/transformers");

    // The model is bundled with the app under public/models so it works
    // offline and avoids cross-origin requests to Hugging Face.
    env.allowLocalModels = true;
    env.allowRemoteModels = false;
    env.localModelPath = "/models/";

    const progressCallback = (info: ProgressInfoLike) => {
      if (info.status === "progress_total" || info.status === "progress") {
        onProgress({
          phase: "loading",
          percent:
            typeof info.progress === "number"
              ? Math.min(100, Math.max(0, info.progress))
              : null,
          message: "Loading the background-removal model…",
        });
      } else if (info.status === "done") {
        onProgress({
          phase: "loading",
          percent: 100,
          message: "Preparing the model…",
        });
      }
    };

    const segmenter = (await pipeline("background-removal", MODEL_ID, {
      device: "wasm",
      dtype: "q8",
      progress_callback: progressCallback,
    })) as unknown as Segmenter;

    return { segmenter };
  })();

  assetsPromise = promise;
  promise.catch(() => {
    if (assetsPromise === promise) {
      assetsPromise = null;
    }
  });

  return promise;
}

/**
 * Removes the background from the current canvas using MODNet (Apache-2.0).
 * The model is shipped with the app and runs locally through Transformers.js.
 */
export async function removeBackground(
  canvas: HTMLCanvasElement,
  onProgress: (progress: RemovalProgress) => void,
): Promise<Blob> {
  const { segmenter } = await loadAssets(onProgress);

  onProgress({
    phase: "inference",
    percent: null,
    message: "Removing the background…",
  });

  const { RawImage } = await import("@huggingface/transformers");

  const sourceBlob = await canvasToBlob(canvas, "image/png");
  const image = await RawImage.fromBlob(sourceBlob);
  const output = await segmenter(image);

  const result = Array.isArray(output) ? output[0] : output;
  if (!result) {
    throw new Error("The model did not return a result.");
  }

  const blob = await result.toBlob("image/png");
  if (!(blob instanceof Blob)) {
    throw new Error("Could not encode the result.");
  }

  return blob;
}
