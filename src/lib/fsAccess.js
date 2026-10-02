/**
 * File System Access API glue: pick a mounted Twiddler drive and a source
 * config directory, compile each slot's config, and write only the .cfg
 * files whose compiled bytes actually changed. This is the direct JS
 * analogue of twiddler_ctl.commands.sync.sync_command, minus the
 * sync metadata-file indirection - callers pass the slot -> filename mapping
 * directly (e.g. from their own UI state) instead of an ini file.
 *
 * Requires a Chromium-based browser (File System Access API is not
 * implemented in Firefox/Safari as of this writing).
 */
import { Text } from "./config/text.js";
import { Config7 } from "./config/config7.js";

/**
 * @param {{ id?: string }} [options]
 * @returns {Promise<FileSystemDirectoryHandle>}
 */
export async function pickTwiddlerDrive(options = {}) {
  return window.showDirectoryPicker({ id: "twiddler-drive", mode: "readwrite", ...options });
}

/**
 * @param {{ id?: string }} [options]
 * @returns {Promise<FileSystemDirectoryHandle>}
 */
export async function pickConfigSourceDirectory(options = {}) {
  return window.showDirectoryPicker({ id: "twiddler-configs", mode: "read", ...options });
}

/** @param {string} filename */
export function detectFormat(filename) {
  return filename.toLowerCase().endsWith(".cfg") ? "binary" : "text";
}

/**
 * @param {FileSystemDirectoryHandle} dirHandle
 * @param {string} name
 * @returns {Promise<FileSystemFileHandle | null>}
 */
async function tryGetFileHandle(dirHandle, name) {
  try {
    return await dirHandle.getFileHandle(name);
  } catch (err) {
    if (err instanceof DOMException && err.name === "NotFoundError") return null;
    throw err;
  }
}

/** @param {FileSystemFileHandle} handle */
async function readBytes(handle) {
  const file = await handle.getFile();
  return new Uint8Array(await file.arrayBuffer());
}

/** @param {FileSystemFileHandle} handle */
async function readText(handle) {
  const file = await handle.getFile();
  return file.text();
}

/**
 * @param {Uint8Array | null} a
 * @param {Uint8Array | null} b
 */
function bytesEqual(a, b) {
  if (a === null || b === null) return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Compiles a single source file (text or binary) down to the raw bytes that
 * should end up in `<slot>.cfg`.
 *
 * @param {FileSystemFileHandle} sourceHandle
 * @param {string} layout
 * @returns {Promise<Uint8Array>}
 */
export async function compileConfigFile(sourceHandle, layout) {
  const format = detectFormat(sourceHandle.name);
  if (format === "binary") {
    return readBytes(sourceHandle);
  }
  const text = await readText(sourceHandle);
  const config = Text.read(text, layout);
  return Config7.write(config, layout);
}

/**
 * @typedef {object} SyncEntry
 * @property {1 | 2 | 3} slot
 * @property {FileSystemFileHandle} source - a `.tctl.txt`/`.txt` (text) or `.cfg` (binary) source file
 *
 * @typedef {object} SyncResult
 * @property {1 | 2 | 3} slot
 * @property {boolean} updated
 */

/**
 * Writes `<slot>.cfg` on the Twiddler drive for each entry whose compiled
 * bytes differ from what's currently there, leaving unchanged slots alone.
 *
 * @param {FileSystemDirectoryHandle} driveHandle
 * @param {SyncEntry[]} entries
 * @param {string} layout
 * @returns {Promise<SyncResult[]>}
 */
export async function syncConfigs(driveHandle, entries, layout) {
  /** @type {SyncResult[]} */
  const results = [];

  for (const { slot, source } of entries) {
    const targetName = `${slot}.cfg`;
    const newBytes = await compileConfigFile(source, layout);

    const existingHandle = await tryGetFileHandle(driveHandle, targetName);
    const currentBytes = existingHandle ? await readBytes(existingHandle) : null;

    if (bytesEqual(currentBytes, newBytes)) {
      results.push({ slot, updated: false });
      continue;
    }

    const writeHandle = await driveHandle.getFileHandle(targetName, { create: true });
    const writable = await writeHandle.createWritable();
    await writable.write(newBytes);
    await writable.close();

    results.push({ slot, updated: true });
  }

  return results;
}

/**
 * Convenience wrapper matching the original CLI's `[configs]` section: given
 * a source directory and a `{slot: filename}` map, resolves each filename to
 * a FileSystemFileHandle and runs `syncConfigs`.
 *
 * @param {FileSystemDirectoryHandle} driveHandle
 * @param {FileSystemDirectoryHandle} sourcesHandle
 * @param {Record<1 | 2 | 3, string>} slotFilenames
 * @param {string} layout
 * @returns {Promise<SyncResult[]>}
 */
export async function syncConfigsFromDirectory(driveHandle, sourcesHandle, slotFilenames, layout) {
  const entries = await Promise.all(
    Object.entries(slotFilenames).map(async ([slotStr, filename]) => ({
      slot: /** @type {1 | 2 | 3} */ (Number(slotStr)),
      source: await sourcesHandle.getFileHandle(filename),
    })),
  );
  return syncConfigs(driveHandle, entries, layout);
}
