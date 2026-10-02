/**
 * Port of the hid-io `layouts` Python package's merge/squash logic, scoped to
 * exactly what twiddler-ctl needs: load upstream layout JSON files from the
 * generated public assets, resolve each layout's parent chain, and squash-merge
 * them so a child's fields win but nested dicts (to_hid_keyboard,
 * from_hid_keyboard, etc.) are merged rather than replaced wholesale.
 */

/** @param {unknown} v */
function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Recursively merges `mergeIn` into `mergeTo` (mutating `mergeTo`), matching
 * `Layouts.dict_merge`: non-dict values are overwritten, dict values are
 * merged key-by-key.
 *
 * @param {Record<string, unknown>} mergeTo
 * @param {Record<string, unknown>} mergeIn
 */
function dictMerge(mergeTo, mergeIn) {
  for (const [key, value] of Object.entries(mergeIn)) {
    const existing = mergeTo[key];
    if (!(key in mergeTo) || existing === null || existing === undefined) {
      mergeTo[key] = isPlainObject(value) ? structuredClone(value) : value;
      continue;
    }
    if (isPlainObject(value) && isPlainObject(existing)) {
      dictMerge(/** @type {Record<string, unknown>} */ (existing), value);
      continue;
    }
    mergeTo[key] = isPlainObject(value) ? structuredClone(value) : value;
  }
}

export class Layout {
  /**
   * @param {string} name
   * @param {Record<string, any>} json
   */
  constructor(name, json) {
    this.layoutName = name;
    this.jsonData = json;
  }

  /** @param {string} name */
  dict(name) {
    const value = this.jsonData[name];
    if (!isPlainObject(value)) {
      throw new Error(`Not a dictionary field: ${name}`);
    }
    return /** @type {Record<string, string>} */ (value);
  }
}

export class Layouts {
  /** @param {Map<string, Record<string, any>>} jsonFiles keyed by path (e.g. "base/default.json") */
  constructor(jsonFiles) {
    this.jsonFiles = jsonFiles;
    /** @type {Map<string, string>} */
    this.layoutNames = new Map();
    for (const [path, data] of jsonFiles) {
      for (const name of data.name ?? []) {
        this.layoutNames.set(name, path);
      }
    }
  }

  /**
   * Loads the layout manifest and every JSON file it lists.
   *
   * @param {string | URL} baseUrl - Public asset root containing `layouts/manifest.json`.
   */
  static async load(baseUrl) {
    if (baseUrl === undefined) {
      throw new Error("Layouts.load() requires the public asset root containing layouts/manifest.json");
    }
    const layoutsUrl = new URL("layouts/", baseUrl);
    const manifestUrl = new URL("manifest.json", layoutsUrl);
    const manifestResponse = await fetch(manifestUrl);
    if (!manifestResponse.ok) {
      throw new Error(`Failed to load layout manifest: ${manifestResponse.status}`);
    }
    const manifest = await manifestResponse.json();
    if (!Array.isArray(manifest.files) || !manifest.files.length) {
      throw new Error("Invalid layout manifest: expected a non-empty files array");
    }

    const entries = await Promise.all(manifest.files.map(async (path) => {
      if (typeof path !== "string" || path.startsWith("/") || path.split("/").some((part) => !part || part === "." || part === "..")) {
        throw new Error(`Invalid layout file path in manifest: ${path}`);
      }
      const url = new URL(path, layoutsUrl);
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to load layout file ${path}: ${res.status}`);
      }
      return /** @type {const} */ ([path, await res.json()]);
    }));
    return new Layouts(new Map(entries));
  }

  /** @returns {string[]} */
  listLayouts() {
    return [...this.layoutNames.keys()].sort();
  }

  /** @param {string} name */
  getLayout(name) {
    const startPath = this.layoutNames.get(name);
    if (startPath === undefined) {
      throw new Error(`Could not find layout: ${name}`);
    }

    /** @type {Record<string, any>[]} */
    const chain = [];
    let path = startPath;
    while (path !== null && path !== undefined) {
      const data = this.jsonFiles.get(path);
      if (data === undefined) {
        throw new Error(`Could not find layout file: ${path}`);
      }
      chain.push(data);
      path = data.parent ?? null;
    }

    /** @type {Record<string, any>} */
    const squashed = {};
    for (const data of [...chain].reverse()) {
      dictMerge(squashed, data);
    }

    return new Layout(name, squashed);
  }
}
