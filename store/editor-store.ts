import { create } from "zustand";

import {
  formatBytes,
  isImageFile,
  loadImageFile,
  stripExtension,
} from "@/lib/image/file";
import {
  MAX_CANVAS_DIMENSION,
  MAX_IMAGE_BYTES,
  type ImageOp,
} from "@/lib/image/types";

type LoadProjectInput = {
  source: HTMLImageElement;
  sourceBlob: Blob;
  ops: ImageOp[];
  opIndex: number;
  projectId: string;
  projectName: string;
};

type EditorState = {
  source: HTMLImageElement | null;
  sourceBlob: Blob | null;
  fileName: string;
  projectId: string | null;
  projectName: string;
  ops: ImageOp[];
  opIndex: number;
  revision: number;
  isLoading: boolean;
  error: string | null;
  loadFile: (file: File) => Promise<void>;
  loadProject: (project: LoadProjectInput) => void;
  markProjectSaved: (projectId: string, projectName: string) => void;
  addOp: (op: ImageOp) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  clear: () => void;
  clearError: () => void;
};

let loadRequestId = 0;

export const useEditorStore = create<EditorState>((set) => ({
  source: null,
  sourceBlob: null,
  fileName: "",
  projectId: null,
  projectName: "",
  ops: [],
  opIndex: 0,
  revision: 0,
  isLoading: false,
  error: null,

  loadFile: async (file) => {
    if (!isImageFile(file)) {
      set({
        error:
          "That file isn't an image. Try a PNG, JPG, WebP, GIF, AVIF, or SVG.",
      });
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      set({
        error: `That image is ${formatBytes(
          file.size,
        )}. The limit is ${formatBytes(MAX_IMAGE_BYTES)}.`,
      });
      return;
    }

    const requestId = ++loadRequestId;
    set({ isLoading: true, error: null });

    try {
      const image = await loadImageFile(file);
      if (requestId !== loadRequestId) {
        return;
      }

      if (
        image.naturalWidth > MAX_CANVAS_DIMENSION ||
        image.naturalHeight > MAX_CANVAS_DIMENSION
      ) {
        set({
          isLoading: false,
          error: `That image is ${image.naturalWidth} × ${image.naturalHeight} px. The maximum supported size is ${MAX_CANVAS_DIMENSION} px per side.`,
        });
        return;
      }

      const fileName = file.name || "image";
      set((state) => ({
        source: image,
        sourceBlob: file,
        fileName,
        projectId: null,
        projectName: stripExtension(fileName),
        ops: [],
        opIndex: 0,
        revision: state.revision + 1,
        isLoading: false,
      }));
    } catch {
      if (requestId !== loadRequestId) {
        return;
      }
      set({
        isLoading: false,
        error:
          "Couldn't open that image. It may be corrupt or in an unsupported format.",
      });
    }
  },

  loadProject: ({
    source,
    sourceBlob,
    ops,
    opIndex,
    projectId,
    projectName,
  }) => {
    set((state) => ({
      source,
      sourceBlob,
      fileName: projectName,
      projectId,
      projectName,
      ops,
      opIndex,
      revision: state.revision + 1,
      isLoading: false,
      error: null,
    }));
  },

  markProjectSaved: (projectId, projectName) => {
    set({ projectId, projectName });
  },

  addOp: (op) => {
    set((state) => {
      const ops = [...state.ops.slice(0, state.opIndex), op];
      return {
        ops,
        opIndex: ops.length,
        revision: state.revision + 1,
      };
    });
  },

  undo: () => {
    set((state) => {
      if (state.opIndex === 0) {
        return state;
      }
      return {
        opIndex: state.opIndex - 1,
        revision: state.revision + 1,
      };
    });
  },

  redo: () => {
    set((state) => {
      if (state.opIndex >= state.ops.length) {
        return state;
      }
      return {
        opIndex: state.opIndex + 1,
        revision: state.revision + 1,
      };
    });
  },

  reset: () => {
    set((state) =>
      state.ops.length === 0
        ? state
        : {
            ops: [],
            opIndex: 0,
            revision: state.revision + 1,
          },
    );
  },

  clear: () => {
    set((state) => ({
      source: null,
      sourceBlob: null,
      fileName: "",
      projectId: null,
      projectName: "",
      ops: [],
      opIndex: 0,
      revision: state.revision + 1,
      isLoading: false,
      error: null,
    }));
  },

  clearError: () => {
    set({ error: null });
  },
}));
