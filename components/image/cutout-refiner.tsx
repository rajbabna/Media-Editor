"use client";

import {
  Brush,
  Eraser,
  Hand,
  Maximize2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  forwardRef,
  useDeferredValue,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { CHECKERBOARD } from "@/components/image/checkerboard";
import { Button } from "@/components/ui/button";
import { cleanupCutout, type CleanupOptions } from "@/lib/bgremoval/cleanup";
import { clamp } from "@/lib/utils";

type Tool = "erase" | "restore" | "pan";

type Point = {
  x: number;
  y: number;
};

type BrushStroke = {
  mode: "erase" | "restore";
  radius: number;
  points: Point[];
};

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

type Cursor = {
  x: number;
  y: number;
  visible: boolean;
};

export type CutoutRefinerHandle = {
  getResult: () => HTMLCanvasElement | null;
};

type CutoutRefinerProps = {
  source: HTMLCanvasElement;
  result: HTMLCanvasElement;
};

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;
const VIEWPORT_PADDING = 24;
const TAU = Math.PI * 2;

function stamp(
  context: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  x: number,
  y: number,
  radius: number,
  mode: BrushStroke["mode"],
): void {
  if (mode === "erase") {
    context.globalCompositeOperation = "destination-out";
    context.beginPath();
    context.arc(x, y, radius, 0, TAU);
    context.fill();
    return;
  }

  context.globalCompositeOperation = "source-over";
  context.save();
  context.beginPath();
  context.arc(x, y, radius, 0, TAU);
  context.clip();
  context.drawImage(source, 0, 0);
  context.restore();
}

function stampSegment(
  context: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  from: Point,
  to: Point,
  radius: number,
  mode: BrushStroke["mode"],
): void {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const distance = Math.hypot(deltaX, deltaY);
  const spacing = Math.max(1, radius * 0.35);
  const steps = Math.max(1, Math.ceil(distance / spacing));

  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    stamp(
      context,
      source,
      from.x + deltaX * t,
      from.y + deltaY * t,
      radius,
      mode,
    );
  }
}

function drawStroke(
  context: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  stroke: BrushStroke,
): void {
  const points = stroke.points;
  if (points.length === 0) {
    return;
  }

  stamp(context, source, points[0].x, points[0].y, stroke.radius, stroke.mode);

  for (let index = 1; index < points.length; index += 1) {
    stampSegment(
      context,
      source,
      points[index - 1],
      points[index],
      stroke.radius,
      stroke.mode,
    );
  }
}

function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const id = `cutout-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className={disabled ? "opacity-50" : undefined}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-[11px] font-medium text-zinc-400">
          {label}
        </label>
        <span className="text-[11px] text-zinc-400 tabular-nums">
          {value}
          {suffix ?? ""}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-blue-500 disabled:cursor-not-allowed"
      />
    </div>
  );
}

export const CutoutRefiner = forwardRef<
  CutoutRefinerHandle,
  CutoutRefinerProps
>(function CutoutRefiner({ source, result }, ref) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const activeStrokeRef = useRef<BrushStroke | null>(null);

  const [tool, setTool] = useState<Tool>("erase");
  const [brushSize, setBrushSize] = useState(40);
  const [strokes, setStrokes] = useState<BrushStroke[]>([]);
  const [thresholdPercent, setThresholdPercent] = useState(6);
  const [removeFragments, setRemoveFragments] = useState(true);
  const [minimumFragment, setMinimumFragment] = useState(10);
  const [edgeTighten, setEdgeTighten] = useState(1);
  const [feather, setFeather] = useState(1);
  const [view, setView] = useState<View | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [cursor, setCursor] = useState<Cursor>({
    x: 0,
    y: 0,
    visible: false,
  });

  const options = useMemo<CleanupOptions>(
    () => ({
      threshold: Math.round(thresholdPercent * 2.55),
      removeFragments,
      minFragmentPercent: minimumFragment,
      edgeTighten,
      feather,
    }),
    [thresholdPercent, removeFragments, minimumFragment, edgeTighten, feather],
  );
  const deferredOptions = useDeferredValue(options);
  const base = useMemo(
    () => cleanupCutout(result, deferredOptions),
    [result, deferredOptions],
  );

  const fittedView = useMemo<View | null>(() => {
    if (!size.width || !size.height) {
      return null;
    }
    const scale = clamp(
      Math.min(
        (size.width - VIEWPORT_PADDING * 2) / base.width,
        (size.height - VIEWPORT_PADDING * 2) / base.height,
      ),
      MIN_ZOOM,
      1,
    );
    return {
      scale,
      x: (size.width - base.width * scale) / 2,
      y: (size.height - base.height * scale) / 2,
    };
  }, [base.height, base.width, size.height, size.width]);

  const activeView = view ?? fittedView;

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
    if (!element || !activeView) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const cursorX = event.clientX - rect.left;
      const cursorY = event.clientY - rect.top;
      const factor = Math.exp(-event.deltaY * 0.0015);
      const scale = clamp(activeView.scale * factor, MIN_ZOOM, MAX_ZOOM);
      const ratio = scale / activeView.scale;
      setView({
        scale,
        x: cursorX - (cursorX - activeView.x) * ratio,
        y: cursorY - (cursorY - activeView.y) * ratio,
      });
    };

    element.addEventListener("wheel", handleWheel, {
      passive: false,
    });
    return () => element.removeEventListener("wheel", handleWheel);
  }, [activeView]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.globalCompositeOperation = "source-over";
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(base, 0, 0);

    for (const stroke of strokes) {
      drawStroke(context, source, stroke);
    }
  }, [base, source, strokes]);

  useImperativeHandle(
    ref,
    () => ({
      getResult: () => {
        const canvas = canvasRef.current;
        if (!canvas) {
          return null;
        }
        const context = canvas.getContext("2d");
        if (!context) {
          return canvas;
        }

        const latest = cleanupCutout(result, options);
        context.globalCompositeOperation = "source-over";
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(latest, 0, 0);
        for (const stroke of strokes) {
          drawStroke(context, source, stroke);
        }
        return canvas;
      },
    }),
    [options, result, source, strokes],
  );

  const toImagePoint = (
    event: ReactPointerEvent<HTMLDivElement>,
  ): Point | null => {
    const element = viewportRef.current;
    if (!element || !activeView) {
      return null;
    }
    const rect = element.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - activeView.x) / activeView.scale,
      y: (event.clientY - rect.top - activeView.y) / activeView.scale,
    };
  };

  const zoomBy = (factor: number) => {
    if (!activeView) {
      return;
    }
    const scale = clamp(activeView.scale * factor, MIN_ZOOM, MAX_ZOOM);
    const ratio = scale / activeView.scale;
    const centerX = size.width / 2;
    const centerY = size.height / 2;
    setView({
      scale,
      x: centerX - (centerX - activeView.x) * ratio,
      y: centerY - (centerY - activeView.y) * ratio,
    });
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!activeView) {
      return;
    }

    const wantsPan = tool === "pan" || event.button === 1;
    if (wantsPan) {
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: activeView.x,
        originY: activeView.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsPanning(true);
      return;
    }

    if (event.button !== 0) {
      return;
    }

    const point = toImagePoint(event);
    const canvas = canvasRef.current;
    if (!point || !canvas) {
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const radius = Math.max(1, brushSize / 2 / activeView.scale);
    const stroke: BrushStroke = {
      mode: tool === "restore" ? "restore" : "erase",
      radius,
      points: [point],
    };
    activeStrokeRef.current = stroke;
    stamp(context, source, point.x, point.y, radius, stroke.mode);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const element = viewportRef.current;
    if (element) {
      const rect = element.getBoundingClientRect();
      setCursor({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        visible: tool !== "pan" && !isPanning,
      });
    }

    const drag = dragRef.current;
    if (drag && drag.pointerId === event.pointerId) {
      if (!activeView) {
        return;
      }
      setView({
        scale: activeView.scale,
        x: drag.originX + (event.clientX - drag.startX),
        y: drag.originY + (event.clientY - drag.startY),
      });
      return;
    }

    const stroke = activeStrokeRef.current;
    if (!stroke) {
      return;
    }

    const point = toImagePoint(event);
    const canvas = canvasRef.current;
    if (!point || !canvas) {
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const previous = stroke.points[stroke.points.length - 1];
    stampSegment(context, source, previous, point, stroke.radius, stroke.mode);
    stroke.points.push(point);
  };

  const endPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      setIsPanning(false);
      return;
    }

    const stroke = activeStrokeRef.current;
    if (stroke) {
      activeStrokeRef.current = null;
      setStrokes((current) => [...current, stroke]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant={tool === "erase" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setTool("erase")}
          aria-pressed={tool === "erase"}
          title="Erase leftover background"
        >
          <Eraser className="h-3.5 w-3.5" />
          Erase
        </Button>
        <Button
          variant={tool === "restore" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setTool("restore")}
          aria-pressed={tool === "restore"}
          title="Restore the original pixels"
        >
          <Brush className="h-3.5 w-3.5" />
          Restore
        </Button>
        <Button
          variant={tool === "pan" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setTool("pan")}
          aria-pressed={tool === "pan"}
          title="Pan and zoom"
        >
          <Hand className="h-3.5 w-3.5" />
          Pan
        </Button>

        <span className="mx-1 h-5 w-px bg-zinc-800" aria-hidden />

        <label className="flex items-center gap-2 text-[11px] text-zinc-400">
          Brush
          <input
            type="range"
            min={8}
            max={160}
            step={2}
            value={brushSize}
            onChange={(event) => setBrushSize(Number(event.target.value))}
            className="w-24 accent-blue-500"
          />
          <span className="w-7 text-right tabular-nums">{brushSize}</span>
        </label>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStrokes((current) => current.slice(0, -1))}
          disabled={strokes.length === 0}
          title="Undo the last brush stroke"
        >
          <Undo2 className="h-3.5 w-3.5" />
          Undo stroke
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStrokes([])}
          disabled={strokes.length === 0}
          title="Clear all brush edits"
        >
          Clear edits
        </Button>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wide text-zinc-300 uppercase">
            Auto-clean
          </span>
          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-zinc-400">
            <input
              type="checkbox"
              checked={removeFragments}
              onChange={(event) => setRemoveFragments(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900 accent-blue-600"
            />
            Remove detached fragments
          </label>
        </div>
        <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
          <RangeField
            label="Threshold"
            value={thresholdPercent}
            min={0}
            max={50}
            suffix="%"
            onChange={setThresholdPercent}
          />
          <RangeField
            label="Min fragment"
            value={minimumFragment}
            min={1}
            max={30}
            suffix="%"
            disabled={!removeFragments}
            onChange={setMinimumFragment}
          />
          <RangeField
            label="Edge tighten"
            value={edgeTighten}
            min={0}
            max={4}
            suffix=" px"
            onChange={setEdgeTighten}
          />
          <RangeField
            label="Feather"
            value={feather}
            min={0}
            max={4}
            suffix=" px"
            onChange={setFeather}
          />
        </div>
      </div>

      <div
        ref={viewportRef}
        className="relative h-[52vh] min-h-72 w-full touch-none overflow-hidden rounded-lg border border-zinc-800"
        style={{
          ...CHECKERBOARD,
          cursor:
            tool === "pan" ? (isPanning ? "grabbing" : "grab") : "crosshair",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={() =>
          setCursor((current) => ({
            ...current,
            visible: false,
          }))
        }
      >
        <canvas
          ref={canvasRef}
          width={base.width}
          height={base.height}
          aria-label="Refined cutout preview"
          className="pointer-events-none absolute top-0 left-0 block origin-top-left shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
          style={
            activeView
              ? {
                  width: base.width,
                  height: base.height,
                  transform: `translate(${activeView.x}px, ${activeView.y}px) scale(${activeView.scale})`,
                }
              : { visibility: "hidden" }
          }
        />

        {cursor.visible && tool !== "pan" ? (
          <div
            className="pointer-events-none absolute rounded-full border border-white/80 shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
            style={{
              left: cursor.x - brushSize / 2,
              top: cursor.y - brushSize / 2,
              width: brushSize,
              height: brushSize,
            }}
          />
        ) : null}

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
            onClick={() => setView(null)}
            title="Fit to screen"
            aria-label="Fit to screen"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-50"
          >
            <Maximize2 className="h-4 w-4" />
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
        </div>

        <p className="pointer-events-none absolute bottom-3 left-3 hidden text-[11px] text-zinc-500 sm:block">
          {tool === "pan"
            ? "Drag to pan · Scroll to zoom"
            : "Drag to edit · Scroll to zoom"}
        </p>
      </div>
    </div>
  );
});
