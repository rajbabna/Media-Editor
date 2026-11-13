import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { ProjectRecord, ProjectSummary } from "@/lib/image/project";

interface MediaEditorDB extends DBSchema {
  projects: {
    key: string;
    value: ProjectRecord;
  };
}

let databasePromise: Promise<IDBPDatabase<MediaEditorDB>> | null = null;

function getDatabase(): Promise<IDBPDatabase<MediaEditorDB>> {
  if (!databasePromise) {
    databasePromise = openDB<MediaEditorDB>("media-editor", 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains("projects")) {
          database.createObjectStore("projects", { keyPath: "id" });
        }
      },
    });
  }
  return databasePromise;
}

export async function saveProject(record: ProjectRecord): Promise<void> {
  const database = await getDatabase();
  await database.put("projects", record);
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const database = await getDatabase();
  const records = await database.getAll("projects");

  return records
    .map(({ id, name, updatedAt, width, height, thumbnail }) => ({
      id,
      name,
      updatedAt,
      width,
      height,
      thumbnail,
    }))
    .sort((first, second) => second.updatedAt - first.updatedAt);
}

export async function getProject(id: string): Promise<ProjectRecord | null> {
  const database = await getDatabase();
  return (await database.get("projects", id)) ?? null;
}

export async function deleteProject(id: string): Promise<void> {
  const database = await getDatabase();
  await database.delete("projects", id);
}
