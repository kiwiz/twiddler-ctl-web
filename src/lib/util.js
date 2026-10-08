import { Layouts } from "./layouts.js";

/** @type {Layouts | null} */
let _layouts = null;

/** @type {Map<string, string>} normalized name -> canonical layout name */
let _layoutMap = new Map();

/**
 * Must be called once (and awaited) before using any other function in this
 * module. Mirrors the module-level `layouts.Layouts(...)` instantiation in
 * the Python version, but deferred since loading layout JSON in a browser is
 * necessarily async.
 *
 * @param {string | URL} baseUrl - public asset root containing `layouts/`.
 */
export async function initLayouts(baseUrl) {
  _layouts = await Layouts.load(baseUrl);
  _layoutMap = new Map(_layouts.listLayouts().map((v) => [normalizeStr(v), v]));
}

/** @param {string} val */
export function normalizeStr(val) {
  return val.trim().replaceAll(" ", "_").toLowerCase();
}

/** @param {number} i */
function shouldIgnore(i) {
  return i >= 0xf0 && i <= 0x121;
}

function requireLayouts() {
  if (_layouts === null) {
    throw new Error("initLayouts() must be called (and awaited) first");
  }
  return _layouts;
}

const _forwardCache = new Map();
const _backwardCache = new Map();

/**
 * @param {string} name - normalized layout name
 * @param {boolean} [consumer]
 * @returns {Map<number, string> | undefined} HID code -> key name
 */
export function getForwardMapping(name, consumer = false) {
  const cacheKey = `${name}:${consumer}`;
  if (_forwardCache.has(cacheKey)) return _forwardCache.get(cacheKey);

  const key = _layoutMap.get(name);
  if (key === undefined) return undefined;

  const table = consumer ? "to_hid_consumer" : "to_hid_keyboard";
  const layout = requireLayouts().getLayout(key);

  /** @type {Map<number, string>} */
  const mapping = new Map();
  for (const [k, v] of Object.entries(layout.dict(table))) {
    const code = parseInt(k, 16);
    if (shouldIgnore(code)) continue;
    mapping.set(code, normalizeStr(v));
  }

  _forwardCache.set(cacheKey, mapping);
  return mapping;
}

/**
 * @param {string} name - normalized layout name
 * @param {boolean} [consumer]
 * @returns {Map<string, number> | undefined} key name -> HID code
 */
export function getBackwardMapping(name, consumer = false) {
  const cacheKey = `${name}:${consumer}`;
  if (_backwardCache.has(cacheKey)) return _backwardCache.get(cacheKey);

  const key = _layoutMap.get(name);
  if (key === undefined) return undefined;

  const table = consumer ? "from_hid_consumer" : "from_hid_keyboard";
  const layout = requireLayouts().getLayout(key);

  /** @type {Map<string, number>} */
  const mapping = new Map();
  for (const [k, v] of Object.entries(layout.dict(table))) {
    const code = parseInt(v, 16);
    if (shouldIgnore(code)) continue;
    mapping.set(normalizeStr(k), code);
  }

  _backwardCache.set(cacheKey, mapping);
  return mapping;
}

/** @param {string} name - normalized layout name */
export function layoutExists(name) {
  return _layoutMap.get(name) !== undefined;
}

/** @returns {string[]} canonical (non-normalized) layout names */
export function listLayouts() {
  return requireLayouts().listLayouts();
}
