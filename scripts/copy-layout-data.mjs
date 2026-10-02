import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const publicDirectory = fileURLToPath(new URL("../public/", import.meta.url));
const destination = join(publicDirectory, "layouts");
const sampleSource = new URL("../src/samples/", import.meta.url);
const sampleDestination = new URL("../public/samples/", import.meta.url);
const layoutsApiUrl = "https://api.github.com/repos/hid-io/layouts/git/trees/master?recursive=1";
const vendoredLayouts = [
  { source: new URL("../vendor/dvorak.json", import.meta.url), path: "keyboards/dvorak.json" },
];

async function fetchOk(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "twiddler-ctl",
    },
  });
  if (!response.ok) throw new Error(`Could not fetch ${url}: ${response.status} ${response.statusText}`);
  return response;
}

async function fetchLayouts() {
  const tree = await (await fetchOk(layoutsApiUrl)).json();
  if (!tree.sha || tree.truncated || !Array.isArray(tree.tree)) {
    throw new Error("GitHub returned an incomplete layouts repository tree");
  }

  const files = tree.tree
    .filter((entry) => entry.type === "blob"
      && typeof entry.path === "string"
      && /^(base|keyboards)\/.+\.json$/i.test(entry.path)
      && !entry.path.split("/").some((part) => !part || part === "." || part === ".."))
    .map((entry) => entry.path)
    .sort((a, b) => a.localeCompare(b));
  if (!files.length) throw new Error("No layout JSON files were found in hid-io/layouts");

  const stageDirectory = await mkdtemp(join(publicDirectory, ".layouts-"));
  try {
    for (const path of files) {
      const url = `https://raw.githubusercontent.com/hid-io/layouts/${tree.sha}/${path}`;
      const contents = await (await fetchOk(url)).text();
      JSON.parse(contents);
      const destinationPath = join(stageDirectory, path);
      await mkdir(dirname(destinationPath), { recursive: true });
      await writeFile(destinationPath, contents);
    }

    const manifestFiles = new Set(files);
    for (const { source, path } of vendoredLayouts) {
      const contents = await readFile(source, "utf8");
      JSON.parse(contents);
      const destinationPath = join(stageDirectory, path);
      await mkdir(dirname(destinationPath), { recursive: true });
      await writeFile(destinationPath, contents);
      manifestFiles.add(path);
    }

    await writeFile(
      join(stageDirectory, "manifest.json"),
      `${JSON.stringify({ repository: "hid-io/layouts", commit: tree.sha, files: [...manifestFiles].sort((a, b) => a.localeCompare(b)) }, null, 2)}\n`,
    );
    await rm(destination, { recursive: true, force: true });
    await rename(stageDirectory, destination);
  } catch (error) {
    await rm(stageDirectory, { recursive: true, force: true });
    throw error;
  }
}

await mkdir(publicDirectory, { recursive: true });
await fetchLayouts();
const sampleDirectory = fileURLToPath(sampleDestination);
const sampleFiles = (await readdir(fileURLToPath(sampleSource)))
  .filter((filename) => filename === "twiddler-config.txt" || filename.endsWith(".tctl.txt"))
  .sort((a, b) => a.localeCompare(b));
const bundledFiles = Object.fromEntries(await Promise.all(
  sampleFiles.map(async (filename) => [filename, await readFile(new URL(filename, sampleSource), "utf8")]),
));
await rm(sampleDirectory, { recursive: true, force: true });
await mkdir(sampleDirectory, { recursive: true });
await writeFile(
  join(sampleDirectory, "bundle.json"),
  `${JSON.stringify({ version: 1, files: bundledFiles }, null, 2)}\n`,
);
