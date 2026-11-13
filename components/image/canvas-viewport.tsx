"use client";

import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { CHECKERBOARD } from "@/components/image/checkerboard";
import { clamp } from "@/lib/utils";

const MIN_ZOOM = 0.02;
const MAX_ZOOM = 8;
const VIEWPORT_PADDING = 32;

type View = {
  scale: number;
  x: number;
  y: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

export function CanvasViewport({ canvas }: { canvas: HTMLCanvasElement }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [customView, setCustomView] = useState<View | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  const fittedView = useMemo<View | null>(() => {
    if (!size.width || !size.height) {
      return null;
    }

    const scale = clamp(
      Math.min(
        (size.width - VIEWPORT_PADDING * 2) / canvas.width,
        (size.height - VIEWPORT_PADDING * 2) / canvas.height,
      ),
      MIN_ZOOM,
      1,
    );

    return {
      scale,
      x: (size.width - canvas.width * scale) / 2,
      y: (size.height - canvas.height * scale) / 2,
    };
  }, [canvas, size.width, size.height]);

  const view = customView ?? fittedView;

  useEffect(() => {
    const display = displayRef.current;
    if (!display) {
      return;
    }

    if (display.width !== canvas.width) {
      display.width = canvas.width;
    }
    if (display.height !== canvas.height) {
      display.height = canvas.height;
    }

    const context = display.getContext("2d");
    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(canvas, 0, 0);
  }, [canvas]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element || !view) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const cursorX = event.clientX - rect.left;
      const cursorY = event.clientY - rect.top;
      const factor = Math.exp(-event.deltaY * 0.0015);
      const scale = clamp(view.scale * factor, MIN_ZOOM, MAX_ZOOM);
      const ratio = scale / view.scale;

      setCustomView({
        scale,
        x: cursorX - (cursorX - view.x) * ratio,
        y: cursorY - (cursorY - view.y) * ratio,
      });
    };

    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, [view]);

  const zoomBy = (factor: number) => {
    if (!view) {
      return;
    }
    const scale = clamp(view.scale * factor, MIN_ZOOM, MAX_ZOOM);
    const ratio = scale / view.scale;
    const centerX = size.width / 2;
    const centerY = size.height / 2;
    setCustomView({
      scale,
      x: centerX - (centerX - view.x) * ratio,
      y: centerY - (centerY - view.y) * ratio,
    });
  };

  const actualSize = () => {
    if (!size.width || !size.height) {
      return;
    }
    setCustomView({
      scale: 1,
      x: (size.width - canvas.width) / 2,
      y: (size.height - canvas.height) / 2,
    });
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.button !== 0 && event.button !== 1) || !view) {
      return;
    }
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: view.x,
      originY: view.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanning(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !view) {
      return;
    }
    setCustomView({
      scale: view.scale,
      x: drag.originX + (event.clientX - drag.startX),
      y: drag.originY + (event.clientY - drag.startY),
    });
  };

  const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      setIsPanning(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  };

  return (
    <div
      ref={viewportRef}
      className="relative h-full w-full touch-none overflow-hidden select-none"
      style={{
        ...CHECKERBOARD,
        cursor: isPanning ? "grabbing" : "grab",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
    >
      <canvas
        ref={displayRef}
        aria-label="Image preview"
        className="pointer-events-none absolute top-0 left-0 block origin-top-left rounded-[2px] shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
        style={
          view
            ? {
                width: canvas.width,
                height: canvas.height,
                transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
              }
            : { visibility: "hidden" }
        }
      />

      <p className="pointer-events-none absolute bottom-3 left-4 hidden text-[11px] text-zinc-500 sm:block">
        Scroll to zoom · Drag to pan
      </p>

      <div
        className="absolute right-3 bottom-3 flex items-center gap-0.5 rounded-lg border border-zinc-700/80 bg-zinc-950/90 p-1 shadow-lg backdrop-blur"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => zoomBy(1 / 1.25)}
          title="Zoom out"
          aria-label="Zoom out"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-50"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={actualSize}
          title="Actual size (100%)"
          className="h-7 min-w-14 rounded-md px-1.5 text-center text-[11px] font-medium text-zinc-300 tabular-nums transition-colors hover:bg-zinc-800 hover:text-zinc-50"
        >
          {view ? `${Math.round(view.scale * 100)}%` : "—"}
        </button>
        <button
          type="button"
          onClick={() => zoomBy(1.25)}
          title="Zoom in"
          aria-label="Zoom in"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-50"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <span className="mx-0.5 h-4 w-px bg-zinc-700" aria-hidden="true" />
        <button
          type="button"
          onClick={() => setCustomView(null)}
          title="Fit to screen"
          aria-label="Fit to screen"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-50"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
