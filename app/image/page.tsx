import type { Metadata } from "next";

import { ImageEditor } from "@/components/image/image-editor";

export const metadata: Metadata = {
  title: "Image editor",
  description:
    "Crop, rotate, flip, resize, and export images — entirely in your browser.",
};

export default function ImageEditorPage() {
  return <ImageEditor />;
}
