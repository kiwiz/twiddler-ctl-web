import { compileConfigFile } from "../lib/index.js";

export const SYNC_CONFIG_FILENAME = "twiddler-config.txt";
const LEGACY_SYNC_CONFIG_FILENAME = "config.ini";

export function directoryPickerHelp() {
  return "The File System Access API is not supported or enabled. Device sync is unavailable.";
}

export async function isTwiddlerDrive(directoryHandle) {
  return (await missingTwiddlerDriveFiles(directoryHandle)).length === 0;
}

async function missingTwiddlerDriveFiles(directoryHandle) {
  const requiredFiles = ["INFO.TXT", "TWIDDLER.LOG"];
  const missingFiles = [];
  for (const filename of requiredFiles) {
    try {
      await directoryHandle.getFileHandle(filename);
    } catch (error) {
      if (error.name === "NotFoundError" || error.name === "TypeMismatchError") {
        missingFiles.push(filename);
      } else {
        throw error;
      }
    }
  }
  return missingFiles;
}

export async function validateTwiddlerDrive(directoryHandle) {
  const missingFiles = await missingTwiddlerDriveFiles(directoryHandle);
  if (missingFiles.length) {
    throw new Error("Selected folder is not a Twiddler drive.");
  }
}

export function isNameNotAllowedError(error) {
  return error?.name === "TypeError" && /name is not allowed/i.test(error.message ?? "");
}

export async function canAccessConfigSyncFiles(directoryHandle) {
  try {
    await directoryHandle.getFileHandle("0.CFG");
    return true;
  } catch (error) {
    if (error.name === "NotFoundError") return true;
    if (isNameNotAllowedError(error)) return false;
    throw error;
  }
}

export async function validateConfigsDirectory(configsHandle, driveHandle) {
  if (!configsHandle) return;
  if (await isTwiddlerDrive(configsHandle)) {
    throw new Error("Selected folder is a Twiddler drive.");
  }
  if (
    driveHandle &&
    typeof configsHandle.isSameEntry === "function" &&
    await configsHandle.isSameEntry(driveHandle)
  ) {
    throw new Error("The configs directory and Twiddler drive must be different folders.");
  }
}

export async function listConfigFiles(directoryHandle, prefix = "") {
  const filenames = [];
  for await (const [name, entry] of directoryHandle.entries()) {
    const path = prefix ? `${prefix}/${name}` : name;
    if (entry.kind === "file" && /\.(txt|cfg)$/i.test(name) && !isSyncConfigFilename(name)) {
      filenames.push(path);
    } else if (entry.kind === "directory") {
      filenames.push(...await listConfigFiles(entry, path));
    }
  }
  return filenames;
}

export async function getFileHandleByPath(directoryHandle, relativePath) {
  const normalizedPath = String(relativePath ?? "").trim().replaceAll("\\", "/");
  const parts = normalizedPath.split("/");
  if (!normalizedPath || normalizedPath.startsWith("/") || parts.some((part) => !part || part === "." || part === "..")) {
    throw new Error(`Invalid config path: ${relativePath}`);
  }

  let parent = directoryHandle;
  for (const directoryName of parts.slice(0, -1)) {
    parent = await parent.getDirectoryHandle(directoryName);
  }
  return parent.getFileHandle(parts.at(-1));
}

async function compileSourceConfig(directoryHandle, filename, layout) {
  try {
    const fileHandle = await getFileHandleByPath(directoryHandle, filename);
    return await compileConfigFile(fileHandle, layout);
  } catch (error) {
    if (error.name === "NotFoundError") {
      throw new Error("File not found");
    }
    throw error;
  }
}

export function parseSyncConfig(contents) {
  const result = { layout: "", configs: {} };
  let section = "";
  for (const rawLine of contents.split(/\r\n|\r|\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;
    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1].trim().toLowerCase();
      continue;
    }
    const equals = line.indexOf("=");
    if (equals < 0) continue;
    const key = line.slice(0, equals).trim().toLowerCase();
    const value = line.slice(equals + 1).trim();
    if (section === "twiddler" && key === "layout") result.layout = value;
    if (section === "configs" && ["1", "2", "3"].includes(key)) result.configs[key] = value;
  }
  return result;
}

function serializeSyncConfig(layout, filenames) {
  return [
    "[twiddler]",
    `layout=${layout}`,
    "",
    "[configs]",
    `1=${filenames[1]}`,
    `2=${filenames[2]}`,
    `3=${filenames[3]}`,
    "",
  ].join("\n");
}

export async function getSyncConfigFileHandle(directoryHandle) {
  for (const filename of [LEGACY_SYNC_CONFIG_FILENAME, SYNC_CONFIG_FILENAME]) {
    try {
      return await directoryHandle.getFileHandle(filename);
    } catch (error) {
      if (error.name !== "NotFoundError" && !isNameNotAllowedError(error)) throw error;
    }
  }
  return null;
}

export async function persistSyncConfig(directoryHandle, layout, filenames) {
  const existingHandle = await getSyncConfigFileHandle(directoryHandle);
  const configHandle = existingHandle ?? await directoryHandle.getFileHandle(SYNC_CONFIG_FILENAME, { create: true });
  const writable = await configHandle.createWritable();
  await writable.write(serializeSyncConfig(layout, filenames));
  await writable.close();
}

function isSyncConfigFilename(filename) {
  const basename = filename.split("/").at(-1).toLowerCase();
  return basename === SYNC_CONFIG_FILENAME || basename === LEGACY_SYNC_CONFIG_FILENAME;
}

export async function syncUppercaseSlotConfigs(driveHandle, configsHandle, slotFilenames, layout, onStatus) {
  const results = [];
  for (const slot of [1, 2, 3]) {
    const filename = `${slot}.CFG`;
    onStatus(slot, { state: "syncing", message: "Syncing…" });
    try {
      const newBytes = await compileSourceConfig(configsHandle, slotFilenames[slot], layout);
      let targetHandle = await getExactDriveFileHandle(driveHandle, filename);
      const currentBytes = targetHandle
        ? new Uint8Array(await (await targetHandle.getFile()).arrayBuffer())
        : null;

      if (currentBytes && byteArraysEqual(currentBytes, newBytes)) {
        onStatus(slot, { state: "success", message: "Synced" });
        results.push({ filename, updated: false });
        continue;
      }

      if (!targetHandle) targetHandle = await getExactDriveFileHandle(driveHandle, filename, true);
      const writable = await targetHandle.createWritable();
      await writable.write(newBytes);
      await writable.close();
      onStatus(slot, { state: "success", message: "Synced" });
      results.push({ filename, updated: true });
    } catch (error) {
      onStatus(slot, { state: "error", message: `Sync failed: ${error.message}` });
      throw error;
    }
  }
  return results;
}

export async function checkUppercaseSlotConfigs(driveHandle, configsHandle, slotFilenames, layout) {
  const statuses = {};
  for (const slot of [1, 2, 3]) {
    const filename = `${slot}.CFG`;
    try {
      const expectedBytes = await compileSourceConfig(configsHandle, slotFilenames[slot], layout);
      let targetHandle;
      try {
        targetHandle = await driveHandle.getFileHandle(filename);
      } catch (error) {
        if (error.name !== "NotFoundError") throw error;
      }

      const matches = targetHandle?.name === filename
        && byteArraysEqual(new Uint8Array(await (await targetHandle.getFile()).arrayBuffer()), expectedBytes);
      statuses[slot] = matches
        ? { state: "success", message: "Synced" }
        : { state: "idle", message: "Needs sync" };
    } catch (error) {
      statuses[slot] = { state: "error", message: error.message };
    }
  }
  return statuses;
}

async function getExactDriveFileHandle(directoryHandle, filename, create = false) {
  let handle;
  try {
    handle = await directoryHandle.getFileHandle(filename, create ? { create: true } : undefined);
  } catch (error) {
    if (error.name === "NotFoundError" && !create) return null;
    throw error;
  }

  if (handle.name !== filename) {
    if (typeof handle.move !== "function") {
      throw new Error(`The drive contains ${handle.name}, but this browser cannot rename it to the required ${filename}.`);
    }
    await handle.move(filename);
    handle = await directoryHandle.getFileHandle(filename);
  }
  if (handle.name !== filename) {
    throw new Error(`Could not ensure the exact required filename ${filename} on the selected drive.`);
  }
  return handle;
}

function byteArraysEqual(a, b) {
  return a.length === b.length && a.every((byte, index) => byte === b[index]);
}
