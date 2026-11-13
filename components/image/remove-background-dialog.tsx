"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CHECKERBOARD } from "@/components/image/checkerboard";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  isRemovalModelCached,
  removeBackground,
  type RemovalProgress,
} from "@/lib/bgremoval/remover";
import { createSnapshotOpFromBlob } from "@/lib/image/asset";
import type { SnapshotOp } from "@/lib/image/types";

type Phase = "idle" | "loading" | "inference" | "done" | "error";

type RemoveBackgroundDialogProps = {
  canvas: HTMLCanvasElement;
  onClose: () => void;
  onApply: (snapshot: SnapshotOp) => void;
};

export function RemoveBackgroundDialog({
  canvas,
  onClose,
  onApply,
}: RemoveBackgroundDialogProps) {
  const cancelledRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<RemovalProgress | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (!previewUrl) {
      return;
    }
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleClose = () => {
    cancelledRef.current = true;
    onClose();
  };

  const handleStart = async () => {
    cancelledRef.current = false;
    setPhase("loading");
    setError(null);
    setProgress(
      isRemovalModelCached()
        ? {
            phase: "loading",
            percent: 100,
            message: "Loading the cached model…",
          }
        : {
            phase: "loading",
            percent: null,
            message: "Loading the background-removal model…",
          },
    );

    try {
      const blob = await removeBackground(canvas, (update) => {
        if (cancelledRef.current) {
          return;
        }
        setProgress(update);
        setPhase(update.phase);
      });

      if (cancelledRef.current) {
        return;
      }

      setResultBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
      setPhase("done");
    } catch (removalError) {
      if (cancelledRef.current) {
        return;
      }
      setPhase("error");
      setError(
        removalError instanceof Error
          ? removalError.message
          : "Background removal failed.",
      );
    }
  };

  const handleApply = async () => {
    if (!resultBlob) {
      return;
    }
    setApplying(true);
    try {
      const snapshot = await createSnapshotOpFromBlob(
        resultBlob,
        "Background removed",
      );
      onApply(snapshot);
    } catch {
      setApplying(false);
      setPhase("error");
      setError("The result could not be loaded.");
    }
  };

  const busy = phase === "loading" || phase === "inference";

  const footer =
    phase === "done" ? (
      <>
        <Button variant="ghost" size="sm" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleApply}
          disabled={applying}
        >
          {applying ? "Applying…" : "Apply result"}
        </Button>
      </>
    ) : phase === "error" ? (
      <>
        <Button variant="ghost" size="sm" onClick={handleClose}>
          Close
        </Button>
        <Button variant="secondary" size="sm" onClick={handleStart}>
          Try again
        </Button>
      </>
    ) : busy ? (
      <Button variant="ghost" size="sm" onClick={handleClose}>
        Run in background
      </Button>
    ) : (
      <>
        <Button variant="ghost" size="sm" onClick={handleClose}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={handleStart}>
          <Sparkles className="h-3.5 w-3.5" />
          Remove background
        </Button>
      </>
    );

  return (
    <Modal
      open
      onClose={handleClose}
      title="Remove background"
      description="ORMBg runs entirely in your browser."
      className="max-w-lg"
      footer={footer}
    >
      {phase === "done" && previewUrl ? (
        <div
          className="flex min-h-48 items-center justify-center overflow-auto rounded-lg border border-zinc-800 p-2"
          style={CHECKERBOARD}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Background removed preview"
            className="max-h-[46vh] w-auto max-w-full"
          />
        </div>
      ) : busy ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/40 px-6 py-12 text-center">
          <Loader2 className="h-7 w-7 animate-spin text-blue-400" />
          <div className="w-full max-w-sm">
            <p className="text-sm text-zinc-200">
              {progress?.message ?? "Working…"}
            </p>
            {progress?.percent !== null && progress?.percent !== undefined ? (
              <div className="mt-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-[width]"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-zinc-500 tabular-nums">
                  {Math.round(progress.percent)}%
                </p>
              </div>
            ) : (
              <div className="mt-3 h-1.5 animate-pulse rounded-full bg-zinc-800" />
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
              The first run downloads the model once. It is cached by your
              browser for later use.
            </p>
          </div>
        </div>
      ) : phase === "error" ? (
        <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3">
          <p className="text-sm font-medium text-red-200">
            Couldn&apos;t remove the background
          </p>
          <p className="mt-1 text-xs leading-relaxed text-red-200/80">
            {error ?? "Something went wrong."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm leading-relaxed text-zinc-300">
            A one-click, AI-powered cutout. It is matting-trained, so it works
            best on photos of people and portraits.
          </div>
          <ul className="space-y-2 text-xs text-zinc-400">
            <li className="flex gap-2">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-blue-400" />
              Model: ORMBg (Apache-2.0 license)
            </li>
            <li className="flex gap-2">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-blue-400" />
              One-time download: about 44 MB, cached by your browser
            </li>
            <li className="flex gap-2">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-blue-400" />
              Nothing is uploaded; inference happens on your device
            </li>
          </ul>
        </div>
      )}
    </Modal>
  );
}
