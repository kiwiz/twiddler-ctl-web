export const SAMPLE_DIRECTORY_NAME = "samples";

export const sampleConfigFiles = [
  "default.tctl.txt",
  "empty.tctl.txt",
  "system.tctl.txt",
  "backspice.tctl.txt",
  "coolhand.tctl.txt",
  "delent.tctl.txt",
  "geekhand.tctl.txt",
  "linewriter_left.tctl.txt",
  "linewriter_right.tctl.txt",
  "mirrorwalk.tctl.txt",
  "ninethreesix.tctl.txt",
  "oran.tctl.txt",
  "slickr_left.tctl.txt",
  "slickr_right.tctl.txt",
  "tabspace.tctl.txt",
  "teasan.tctl.txt",
  "thumbless.tctl.txt",
  "typemax.tctl.txt",
];
const SAMPLE_SOURCE_FILES = new Set([...sampleConfigFiles, "twiddler-config.txt"]);
const sampleFileCache = new Map();
let sampleBundlePromise;

async function loadSampleBundle() {
  if (!sampleBundlePromise) {
    const baseUrl = new URL(import.meta.env.BASE_URL, window.location.href);
    const url = new URL("samples/bundle.json", baseUrl);
    sampleBundlePromise = fetch(url, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Could not load sample bundle: ${response.status}`);
        const bundle = await response.json();
        if (bundle.version !== 1 || typeof bundle.files !== "object" || bundle.files === null) {
          throw new Error("Invalid sample bundle format");
        }
        return bundle.files;
      })
      .catch((error) => {
        sampleBundlePromise = null;
        throw error;
      });
  }
  return sampleBundlePromise;
}

/** @param {string} filename */
export async function createSampleConfigFile(filename) {
  if (!SAMPLE_SOURCE_FILES.has(filename)) throw new Error(`Unknown sample config: ${filename}`);
  const cachedFile = sampleFileCache.get(filename);
  if (cachedFile) return cachedFile;

  const files = await loadSampleBundle();
  const contents = files[filename];
  if (typeof contents !== "string") throw new Error(`Sample bundle is missing ${filename}`);
  const file = new File([contents], filename, { type: "text/plain" });
  sampleFileCache.set(filename, file);
  return file;
}

export async function preloadSampleBundle() {
  await loadSampleBundle();
  await Promise.all([...SAMPLE_SOURCE_FILES].map((filename) => createSampleConfigFile(filename)));
}

/** @param {string} filename */
export function createSampleConfigHandle(filename) {
  if (!SAMPLE_SOURCE_FILES.has(filename)) throw new Error(`Unknown sample config: ${filename}`);
  return {
    kind: "file",
    name: filename,
    readOnly: true,
    getFile: () => createSampleConfigFile(filename),
  };
}

export function createSampleConfigDirectoryHandle() {
  return {
    name: SAMPLE_DIRECTORY_NAME,
    readOnly: true,
    getFileHandle: async (filename) => {
      if (!SAMPLE_SOURCE_FILES.has(filename)) throw new DOMException(`File not found: ${filename}`, "NotFoundError");
      return createSampleConfigHandle(filename);
    },
    async *entries() {
      for (const filename of SAMPLE_SOURCE_FILES) {
        yield [filename, createSampleConfigHandle(filename)];
      }
    },
  };
}
