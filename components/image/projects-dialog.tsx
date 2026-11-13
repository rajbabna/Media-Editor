"use client";

import { FolderOpen, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { CHECKERBOARD } from "@/components/image/checkerboard";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { loadImageFromBlob, stripExtension } from "@/lib/image/file";
import {
  createProjectThumbnail,
  deserializeOps,
  serializeOps,
  type ProjectRecord,
  type ProjectSummary,
} from "@/lib/image/project";
import {
  deleteProject,
  getProject,
  listProjects,
  saveProject,
} from "@/lib/storage/projects";
import { useEditorStore } from "@/store/editor-store";

type ProjectRow = ProjectSummary & { thumbnailUrl: string };

type Status = {
  type: "success" | "error";
  message: string;
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

type ProjectsDialogProps = {
  canvas: HTMLCanvasElement | null;
  onClose: () => void;
};

export function ProjectsDialog({ canvas, onClose }: ProjectsDialogProps) {
  const sourceBlob = useEditorStore((state) => state.sourceBlob);
  const fileName = useEditorStore((state) => state.fileName);
  const projectId = useEditorStore((state) => state.projectId);
  const projectName = useEditorStore((state) => state.projectName);
  const ops = useEditorStore((state) => state.ops);
  const opIndex = useEditorStore((state) => state.opIndex);
  const loadProject = useEditorStore((state) => state.loadProject);
  const markProjectSaved = useEditorStore((state) => state.markProjectSaved);

  const [name, setName] = useState(
    () => projectName || stripExtension(fileName) || "Untitled project",
  );
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];

    const load = async () => {
      try {
        const rows = await listProjects();
        if (cancelled) {
          return;
        }
        setProjects(
          rows.map((row) => {
            const thumbnailUrl = URL.createObjectURL(row.thumbnail);
            urls.push(thumbnailUrl);
            return { ...row, thumbnailUrl };
          }),
        );
      } catch {
        if (!cancelled) {
          setStatus({
            type: "error",
            message: "Saved projects could not be read from this browser.",
          });
        }
      } finally {
        if (!cancelled) {
          setLoadingList(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
    };
  }, [refreshKey]);

  const handleSave = async () => {
    if (!canvas || !sourceBlob) {
      setStatus({
        type: "error",
        message: "Open an image before saving a project.",
      });
      return;
    }

    setBusy("saving");
    setStatus(null);

    try {
      const id = projectId ?? crypto.randomUUID();
      const trimmedName = name.trim() || "Untitled project";
      const record: ProjectRecord = {
        id,
        name: trimmedName,
        updatedAt: Date.now(),
        originalBlob: sourceBlob,
        ops: serializeOps(ops),
        opIndex,
        width: canvas.width,
        height: canvas.height,
        thumbnail: await createProjectThumbnail(canvas),
      };

      await saveProject(record);
      markProjectSaved(id, trimmedName);
      setName(trimmedName);
      setStatus({
        type: "success",
        message: "Project saved in this browser.",
      });
      setRefreshKey((key) => key + 1);

      try {
        if (navigator.storage?.persist) {
          void navigator.storage.persist();
        }
      } catch {
        // Persistence requests are optional.
      }
    } catch {
      setStatus({
        type: "error",
        message: "The project could not be saved. Browser storage may be full.",
      });
    } finally {
      setBusy(null);
    }
  };

  const handleOpen = async (id: string) => {
    if (
      ops.length > 0 &&
      !window.confirm(
        "Open this project? Unsaved edits to the current image will be lost.",
      )
    ) {
      return;
    }

    setBusy(id);
    setStatus(null);

    try {
      const record = await getProject(id);
      if (!record) {
        throw new Error("Project not found.");
      }

      const [source, projectOps] = await Promise.all([
        loadImageFromBlob(record.originalBlob),
        deserializeOps(record.ops),
      ]);

      loadProject({
        source,
        sourceBlob: record.originalBlob,
        ops: projectOps,
        opIndex: record.opIndex,
        projectId: record.id,
        projectName: record.name,
      });
      onClose();
    } catch {
      setStatus({
        type: "error",
        message: "The project could not be opened.",
      });
      setBusy(null);
    }
  };

  const handleDelete = async (project: ProjectRow) => {
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) {
      return;
    }

    setBusy(project.id);
    setStatus(null);

    try {
      await deleteProject(project.id);
      setRefreshKey((key) => key + 1);
      setStatus({
        type: "success",
        message: `Deleted "${project.name}".`,
      });
    } catch {
      setStatus({
        type: "error",
        message: "The project could not be deleted.",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Projects"
      description="Saved locally in this browser with IndexedDB."
      className="max-w-2xl"
      footer={
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      }
    >
      <section>
        <label
          htmlFor="project-name"
          className="text-xs font-medium text-zinc-400"
        >
          Project name
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            id="project-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-9 min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 text-sm text-zinc-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            placeholder="Untitled project"
          />
          <Button
            variant="primary"
            size="md"
            onClick={handleSave}
            disabled={!canvas || !sourceBlob || busy !== null}
          >
            {busy === "saving"
              ? "Saving…"
              : projectId
                ? "Update project"
                : "Save project"}
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-zinc-500">
          Stores the original image, edits, and a thumbnail on this device.
        </p>
      </section>

      {status ? (
        <p
          role="status"
          className={
            status.type === "success"
              ? "mt-3 rounded-md border border-emerald-900/50 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200"
              : "mt-3 rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-200"
          }
        >
          {status.message}
        </p>
      ) : null}

      <section className="mt-5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-zinc-400">Saved projects</h3>
          {loadingList ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />
          ) : (
            <span className="text-[11px] text-zinc-500">
              {projects.length} {projects.length === 1 ? "project" : "projects"}
            </span>
          )}
        </div>

        <div className="mt-2 space-y-1.5">
          {!loadingList && projects.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-8 text-center">
              <FolderOpen className="mx-auto h-6 w-6 text-zinc-600" />
              <p className="mt-2 text-xs text-zinc-500">
                No saved projects yet. Save the current image to start.
              </p>
            </div>
          ) : null}

          {projects.map((project) => (
            <div
              key={project.id}
              className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={project.thumbnailUrl}
                alt=""
                className="h-12 w-12 shrink-0 rounded border border-zinc-700 object-cover"
                style={CHECKERBOARD}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-100">
                  {project.name}
                </p>
                <p className="text-[11px] text-zinc-500">
                  {project.width} × {project.height} px ·{" "}
                  {dateFormatter.format(project.updatedAt)}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleOpen(project.id)}
                disabled={busy !== null}
              >
                {busy === project.id ? "Opening…" : "Open"}
              </Button>
              <button
                type="button"
                onClick={() => handleDelete(project)}
                disabled={busy !== null}
                aria-label={`Delete ${project.name}`}
                title={`Delete ${project.name}`}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-red-950/60 hover:text-red-300 disabled:pointer-events-none disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </Modal>
  );
}
