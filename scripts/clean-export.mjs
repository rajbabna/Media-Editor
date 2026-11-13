import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";

const LIMIT_BYTES = 25 * 1024 * 1024;
const MEDIA_DIR = path.join(process.cwd(), "out", "_next", "static", "media");

try {
  const files = await readdir(MEDIA_DIR);

  for (const file of files) {
    if (!file.startsWith("ort-wasm") || !file.endsWith(".wasm")) {
      continue;
    }

    const filePath = path.join(MEDIA_DIR, file);
    const info = await stat(filePath);

    if (info.size > LIMIT_BYTES) {
      await unlink(filePath);
      console.log(
        `Removed ${file} (${(info.size / (1024 * 1024)).toFixed(1)} MB). ` +
          "Transformers.js loads ONNX Runtime's WASM from jsDelivr at runtime.",
      );
    }
  }
} catch (error) {
  if (error && error.code === "ENOENT") {
    console.log("No export media directory found; skipping cleanup.");
  } else {
    throw error;
  }
}
