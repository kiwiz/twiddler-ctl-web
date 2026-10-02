/**
 * CodeMirror 6 language support for the twiddler-ctl text ("ini-style")
 * config format handled by ./config/text.js: `[config]`/`[dedicated]`/
 * `[mappings]` sections, `key = value` lines, `#`/`;` full-line comments,
 * chord notation (T/F prefixes + digits + LMR) as mapping keys, and
 * whitespace-separated `type:value` command tokens as mapping values.
 *
 * Also registers a structural + known-value completion source (section
 * names, [config]/[dedicated] keys and values, [mappings] command-type
 * prefixes and their fixed vocabularies) via CodeMirror's standard
 * `languageData.autocomplete` hook. It's picked up automatically by any
 * `autocompletion()` extension already in your setup (e.g. via `basicSetup`
 * from the "codemirror" package) - no separate autocomplete wiring needed.
 * Chord notation and layout-dependent values (keyboard: key names beyond the
 * fixed macros, application: names) aren't completed, since those require
 * the active layout (see ../util.js's getForwardMapping/getBackwardMapping).
 *
 * This is a separate entry point (not re-exported from ./index.js) because
 * CodeMirror is a peer dependency - only import this module if you're
 * actually building an editor UI. Resolve `@codemirror/language` and
 * `@lezer/highlight` yourself (bundler, or an import map pointing at a CDN
 * build, e.g. https://esm.sh/@codemirror/language@6).
 *
 * Usage:
 *   import { EditorState } from "@codemirror/state";
 *   import { EditorView } from "@codemirror/view";
 *   import { twiddlerConfig } from "./codemirror-lang.js";
 *
 *   new EditorView({
 *     parent: document.body,
 *     state: EditorState.create({ doc: text, extensions: [twiddlerConfig()] }),
 *   });
 */
import { StreamLanguage, HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import {
  DEDICATED_ORDER,
  DEDICATED_KEYS,
  SYSTEM_COMMANDS,
  MOUSE_COMMANDS,
  KEY_MACROS,
  MODE_NAMES,
  NAV_DIRECTIONS,
} from "../lib/config/text.js";

const SECTIONS = new Set(["config", "dedicated", "mappings"]);

/**
 * @typedef {{
 *   section: "config" | "dedicated" | "mappings" | null,
 *   part: "key" | "eq" | "value" | "skip",
 *   bracketStage: 0 | 1 | 2,
 * }} State
 */

/** @returns {State} */
function startState() {
  return { section: null, part: "key", bracketStage: 0 };
}

/**
 * Custom style names for our token() function, mapped to real highlight
 * tags below via StreamLanguage's `tokenTable` option (rather than relying
 * on guessing the legacy CodeMirror-5 token name table).
 */
const tokenTable = {
  "tw-comment": t.comment,
  "tw-bracket": t.squareBracket,
  "tw-section": t.keyword,
  "tw-key": t.propertyName,
  "tw-chord": t.variableName,
  "tw-eq": t.operator,
  "tw-cmdtype": t.keyword,
  "tw-colon": t.punctuation,
  "tw-value": t.string,
  "tw-number": t.number,
  "tw-atom": t.atom,
};

/**
 * @param {import("@codemirror/language").StringStream} stream
 * @param {State} state
 * @returns {string | null}
 */
function token(stream, state) {
  if (stream.sol()) {
    state.part = "key";
    state.bracketStage = 0;
  }

  if (stream.eatSpace()) return null;

  // Full-line comments (only recognized before any other content on the line,
  // matching parseIni's `trimmed.startsWith("#" | ";")`).
  if (state.part === "key" && state.bracketStage === 0 && (stream.peek() === "#" || stream.peek() === ";")) {
    stream.skipToEnd();
    return "tw-comment";
  }

  // Section headers: [config] / [dedicated] / [mappings] / anything else.
  if (state.part === "key" && state.bracketStage === 0 && stream.peek() === "[") {
    stream.next();
    state.bracketStage = 1;
    return "tw-bracket";
  }
  if (state.bracketStage === 1) {
    const m = stream.match(/^[^\]]+/);
    if (m) {
      const name = m[0].trim().toLowerCase();
      state.section = SECTIONS.has(name) ? /** @type {any} */ (name) : null;
      state.bracketStage = 2;
      return "tw-section";
    }
  }
  if (state.bracketStage === 2 && stream.peek() === "]") {
    stream.next();
    state.bracketStage = 0;
    state.part = "skip";
    return "tw-bracket";
  }

  if (state.part === "skip") {
    stream.skipToEnd();
    return null;
  }

  // Key part of a `key = value` line (chord notation in [mappings], plain
  // option/slot names elsewhere).
  if (state.part === "key") {
    const m = stream.match(/^[^=]*(?==)/);
    if (m && m[0].length > 0) {
      state.part = "eq";
      if (state.section === "mappings") return "tw-chord";
      if (state.section === "dedicated" || state.section === "config") return "tw-key";
      return null;
    }
    // No key text before '=' (empty key), or no '=' at all on this line.
    if (stream.match("=")) {
      state.part = "value";
      return "tw-eq";
    }
    stream.skipToEnd();
    state.part = "skip";
    return null;
  }

  if (state.part === "eq") {
    if (stream.match("=")) {
      state.part = "value";
      return "tw-eq";
    }
    stream.next();
    return null;
  }

  // Value part of a `key = value` line.
  if (state.part === "value") {
    if (state.section === "mappings") {
      // Whitespace-separated commands, each optionally `type:value`.
      if (stream.match(/^[A-Za-z_]+(?=:)/)) return "tw-cmdtype";
      if (stream.match(":")) return "tw-colon";
      if (stream.match(/^\S+/)) return "tw-value";
      stream.next();
      return null;
    }

    const m = stream.match(/^\S+/);
    if (!m) {
      stream.next();
      return null;
    }
    if (state.section === "dedicated") return "tw-atom";
    if (/^-?\d+$/.test(m[0])) return "tw-number";
    return "tw-atom";
  }

  stream.next();
  return null;
}

const CONFIG_KEYS = [
  "repeat", "mode", "direct", "haptic",
  "sticky_num", "sticky_alt", "sticky_ctrl", "sticky_shift",
  "nav_up_direction", "nav_invert_x", "nav_sensitivity",
  "idle_time", "repeat_delay",
];
const CONFIG_BOOLEAN_KEYS = new Set([
  "repeat", "direct", "haptic",
  "sticky_num", "sticky_alt", "sticky_ctrl", "sticky_shift",
  "nav_invert_x",
]);
/** @type {Record<string, string[]>} */
const CONFIG_ENUM_VALUES = {
  mode: Object.keys(MODE_NAMES),
  nav_up_direction: Object.keys(NAV_DIRECTIONS),
};
const COMMAND_TYPES = ["system", "keyboard", "mouse", "application", "delay", "haptic"];

/**
 * Walks backward from `pos` to find the nearest preceding `[section]`
 * header, mirroring the tokenizer's own section tracking.
 * @param {import("@codemirror/state").EditorState} state
 * @param {number} pos
 * @returns {"config" | "dedicated" | "mappings" | null}
 */
function sectionAtPos(state, pos) {
  const startLine = state.doc.lineAt(pos).number;
  for (let n = startLine; n >= 1; n--) {
    const text = state.doc.line(n).text.trim();
    const m = text.match(/^\[([^\]]*)\]$/);
    if (m) {
      const name = m[1].trim().toLowerCase();
      return /** @type {any} */ (SECTIONS.has(name) ? name : null);
    }
  }
  return null;
}

/**
 * Structural + known-value completion source: section names, `[config]`
 * option keys, `[dedicated]` slot names/key names, and `[mappings]`
 * command-type prefixes plus their known value vocabularies (system/mouse
 * command names, keyboard macro names). Does not complete chord notation or
 * layout-dependent keyboard key names/application names.
 * @param {import("@codemirror/autocomplete").CompletionContext} context
 * @returns {import("@codemirror/autocomplete").CompletionResult | null}
 */
function twiddlerConfigCompletions(context) {
  const bracketMatch = context.matchBefore(/\[\w*$/);
  if (bracketMatch) {
    return {
      from: bracketMatch.from + 1,
      options: ["config", "dedicated", "mappings"].map((s) => ({ label: s, type: "keyword" })),
    };
  }

  const line = context.state.doc.lineAt(context.pos);
  const beforeCursor = line.text.slice(0, context.pos - line.from);
  const section = sectionAtPos(context.state, context.pos);
  if (section === null) return null;

  const eqIdx = beforeCursor.indexOf("=");

  if (eqIdx === -1) {
    const word = context.matchBefore(/\S*$/);
    if (!word) return null;
    if (section === "config") {
      return { from: word.from, options: CONFIG_KEYS.map((k) => ({ label: k, type: "property" })) };
    }
    if (section === "dedicated") {
      return {
        from: word.from,
        options: DEDICATED_ORDER.map((k) => ({ label: k.toUpperCase(), type: "property" })),
      };
    }
    return null; // chord notation has no fixed vocabulary
  }

  const word = context.matchBefore(/\S*$/);
  if (!word) return null;

  if (section === "config") {
    const keyName = beforeCursor.slice(0, eqIdx).trim().toLowerCase();
    if (CONFIG_BOOLEAN_KEYS.has(keyName)) {
      return { from: word.from, options: [{ label: "true" }, { label: "false" }] };
    }
    if (keyName in CONFIG_ENUM_VALUES) {
      return { from: word.from, options: CONFIG_ENUM_VALUES[keyName].map((v) => ({ label: v })) };
    }
    return null;
  }

  if (section === "dedicated") {
    return { from: word.from, options: Object.keys(DEDICATED_KEYS).map((v) => ({ label: v })) };
  }

  // section === "mappings": complete the command token under the cursor.
  const typed = word.text;
  const colonIdx = typed.indexOf(":");
  if (colonIdx === -1) {
    return {
      from: word.from,
      options: COMMAND_TYPES.map((c) => ({ label: `${c}:`, type: "keyword" })),
    };
  }

  const typePrefix = typed.slice(0, colonIdx).toLowerCase();
  const valueFrom = word.from + colonIdx + 1;
  if (typePrefix === "system" || typePrefix === "sys") {
    return { from: valueFrom, options: Object.keys(SYSTEM_COMMANDS).map((v) => ({ label: v })) };
  }
  if (typePrefix === "mouse" || typePrefix === "ms") {
    return { from: valueFrom, options: Object.keys(MOUSE_COMMANDS).map((v) => ({ label: v })) };
  }
  if (typePrefix === "keyboard" || typePrefix === "kb") {
    return { from: valueFrom, options: Object.keys(KEY_MACROS).map((v) => ({ label: v })) };
  }
  return null; // application/delay/haptic values aren't a fixed vocabulary
}

/** The bare language (parser + tokenizer), with no styling attached yet. */
export const twiddlerConfigLanguage = StreamLanguage.define({
  name: "twiddler-config",
  startState,
  token,
  tokenTable,
  languageData: {
    commentTokens: { line: "#" },
    autocomplete: twiddlerConfigCompletions,
  },
});

/** Default color scheme for the tags produced above; swap out as desired. */
export const twiddlerConfigHighlight = HighlightStyle.define([
  { tag: t.comment, color: "#8b949e", fontStyle: "italic" },
  { tag: t.squareBracket, color: "#c9a0ff" },
  { tag: t.keyword, color: "#ff9d5c" },
  { tag: t.propertyName, color: "#79c0ff" },
  { tag: t.variableName, color: "#7ee787" },
  { tag: t.operator, color: "#e6edf3" },
  { tag: t.punctuation, color: "#e6edf3" },
  { tag: t.number, color: "#ffa657" },
  { tag: t.atom, color: "#d2a8ff" },
  { tag: t.string, color: "#a5d6ff" },
]);

/**
 * Convenience extension bundle: language + default highlighting.
 * @returns {import("@codemirror/state").Extension[]}
 */
export function twiddlerConfig() {
  return [twiddlerConfigLanguage, syntaxHighlighting(twiddlerConfigHighlight)];
}
