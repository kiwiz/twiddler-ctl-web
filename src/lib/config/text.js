/**
 * Text ("ini-style") Twiddler config codec, ported from
 * twiddler_ctl.config.text.Text. Uses a tiny hand-rolled INI parser/writer
 * (section headers, `key = value` lines, `#`/`;` comments) rather than
 * pulling in a full configparser port - matches Python's default
 * `optionxform` behavior of lowercasing option names.
 */
import { Serdes } from "./index.js";
import { normalizeStr, getBackwardMapping, getForwardMapping } from "../util.js";
import { CommandType, makeChord, makeCommand, makeConfig, makeMapping } from "../models.js";

/** @param {string} text */
function parseIni(text) {
  /** @type {Map<string, Map<string, string>>} */
  const sections = new Map();
  let current = null;

  for (const rawLine of text.split(/\r\n|\r|\n/)) {
    const line = rawLine;
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith(";")) continue;

    const sectionMatch = trimmed.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      current = sectionMatch[1].trim();
      if (!sections.has(current)) sections.set(current, new Map());
      continue;
    }

    const eq = line.indexOf("=");
    if (eq === -1 || current === null) continue;

    const key = line.slice(0, eq).trim().toLowerCase();
    const value = line.slice(eq + 1).trim();
    sections.get(current).set(key, value);
  }

  return sections;
}

/** @param {Map<string, string> | undefined} section
 * @param {string} key
 * @param {boolean} fallback */
function getBool(section, key, fallback) {
  const v = section?.get(key);
  if (v === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

/** @param {Map<string, string> | undefined} section
 * @param {string} key
 * @param {number} fallback */
function getInt(section, key, fallback) {
  const v = section?.get(key);
  if (v === undefined) return fallback;
  return parseInt(v, 10);
}

export const KEY_MACROS = {
  tilde: "rshift+backtick",
  exclamation: "rshift+1",
  at: "rshift+2",
  hash: "rshift+3",
  dollar: "rshift+4",
  percent: "rshift+5",
  caret: "rshift+6",
  ampersand: "rshift+7",
  asterisk: "rshift+8",
  left_parenthesis: "rshift+9",
  right_parenthesis: "rshift+0",
  left_curly_bracket: "rshift+left_bracket",
  right_curly_bracket: "rshift+right_bracket",
  question: "rshift+backslash",
  plus: "rshift+equal",
  pipe: "rshift+slash",
  underscore: "rshift+minus",
  colon: "rshift+semicolon",
  double_quote: "rshift+quote",
  less_than: "rshift+comma",
  greater_than: "rshift+period",
};
for (let i = 0x61; i < 0x7b; i++) {
  KEY_MACROS[String.fromCharCode(i - 0x20)] = `rshift+${String.fromCharCode(i)}`;
}
const MACRO_CODES = Object.fromEntries(Object.entries(KEY_MACROS).map(([k, v]) => [v, k]));

export const DEDICATED_ORDER = [
  "t1", "f1r", "f1m", "f1l",
  "t2", "f2r", "f2m", "f2l",
  "t3", "f3r", "f3m", "f3l",
  "t4", "f4r", "f4m", "f4l",
  "f0r", "f0m", "f0l", "t0",
];
const DEDICATED_OFFSETS = Object.fromEntries(DEDICATED_ORDER.map((v, i) => [v, i]));

export const DEDICATED_KEYS = {
  lctrl: 0x01, lshift: 0x02, lalt: 0x03, lmeta: 0x04,
  rctrl: 0x05, rshift: 0x06, ralt: 0x07, rmeta: 0x08,
  mouse_left: 0x09, mouse_right: 0x0a, mouse_middle: 0x0b,
  sticky: 0x0c, hyper: 0x0d,
};
const DEDICATED_CODES = Object.fromEntries(Object.entries(DEDICATED_KEYS).map(([k, v]) => [v, k]));

export const NAV_DIRECTIONS = { north: 0, east: 1, south: 2, west: 3 };
const NAV_CODES = Object.fromEntries(Object.entries(NAV_DIRECTIONS).map(([k, v]) => [v, k]));

export const MODE_NAMES = { chord: 0, keyboard: 1 };
const MODE_CODES = Object.fromEntries(Object.entries(MODE_NAMES).map(([k, v]) => [v, k]));

const MODIFIER_KEYS = {
  lctrl: 0x01, lshift: 0x02, lalt: 0x04, lmeta: 0x08,
  rctrl: 0x10, rshift: 0x20, ralt: 0x40, rmeta: 0x80,
};
const MODIFIER_CODES = Object.fromEntries(Object.entries(MODIFIER_KEYS).map(([k, v]) => [v, k]));

export const SYSTEM_COMMANDS = {
  sleep: 0x01, print_system_info: 0x02, toggle_test_mode: 0x03, show_cycle_config: 0x04,
  show_cycle_bluetooth_host: 0x05, clear_bluetooth_hosts: 0x06, toggle_untethered_mode: 0x07,
  clear_untethered_mode: 0x08, play_untethered_mode: 0x09, show_battery_level: 0x0a,
  show_cycle_nav_mode: 0x0b, show_keyboard_leds: 0x0c, print_system_stats: 0x0d,
  cycle_config: 0x0e, cycle_bluetooth_host: 0x0f, cycle_nav_mode: 0x10,
  select_config_0: 0x11, select_bluetooth_host: 0x12, select_nav_mode: 0x13,
  select_config_1: 0x111, select_config_2: 0x211, select_config_3: 0x311,
};
const SYSTEM_CODES = Object.fromEntries(Object.entries(SYSTEM_COMMANDS).map(([k, v]) => [v, k]));

export const MOUSE_COMMANDS = { release: 0x00, right: 0x01, left: 0x02, middle: 0x04 };
const MOUSE_CODES = Object.fromEntries(Object.entries(MOUSE_COMMANDS).map(([k, v]) => [v, k]));

/**
 * @param {string} cmdTxt
 * @param {string} layout
 */
function keycodeFromText(cmdTxt, layout) {
  const mapping = getBackwardMapping(layout);
  if (mapping === undefined) return null;

  let mod = 0;
  const parts = cmdTxt.split("+");
  const key = parts.pop();
  for (const part of parts) {
    mod |= MODIFIER_KEYS[normalizeStr(part)] ?? 0;
  }

  const code = mapping.get(normalizeStr(key));
  if (code === undefined) return null;

  return (code << 8) | mod;
}

/**
 * @param {number} val
 * @param {string} layout
 */
function keycodeToText(val, layout) {
  const mod = val & 0xff;
  const key = val >> 8;
  const mapping = getForwardMapping(layout);

  const parts = [];
  for (const [bStr, name] of Object.entries(MODIFIER_CODES)) {
    if (Number(bStr) & mod) parts.push(name);
  }

  parts.push(mapping.get(key));
  let text = parts.join("+");

  if (text in MACRO_CODES) text = MACRO_CODES[text];

  return text;
}

const COL_CODES = ["R", "M", "L"];
const COL_OFFSETS = Object.fromEntries(COL_CODES.map((v, i) => [v, i]));

/**
 * @param {boolean[][]} fingers
 * @param {string} row
 * @param {string} cols
 */
function setRow(fingers, row, cols) {
  const idx = parseInt(row, 10);
  for (const col of cols) {
    const idxx = COL_OFFSETS[col];
    if (idxx === undefined) continue;
    fingers[idx][idxx] = true;
  }
}

/** @param {string} notation */
function chordFromText(notation) {
  const s = notation.trim().toUpperCase();
  let i = 0;
  const n = s.length;
  let seenFirstFinger = false;
  const thumbs = [false, false, false, false, false];
  const fingers = [
    [false, false, false],
    [false, false, false],
    [false, false, false],
    [false, false, false],
    [false, false, false],
  ];

  while (i < n) {
    const ch = s[i];

    if (ch === "T") {
      i += 1;
      while (i < n && "01234".includes(s[i])) {
        thumbs[parseInt(s[i], 10)] = true;
        i += 1;
      }
      continue;
    }

    if (ch === "F" && !seenFirstFinger) {
      i += 1;
      if (i < n && "01234".includes(s[i])) {
        const row = s[i];
        i += 1;
        const start = i;
        while (i < n && "LMR".includes(s[i])) i += 1;
        setRow(fingers, row, s.slice(start, i));
        seenFirstFinger = true;
      }
      continue;
    }

    if (seenFirstFinger && "01234".includes(ch)) {
      const row = ch;
      i += 1;
      const start = i;
      while (i < n && "LMR".includes(s[i])) i += 1;
      setRow(fingers, row, s.slice(start, i));
      continue;
    }

    i += 1;
  }

  const chord = makeChord();
  chord.thumbs = /** @type {any} */ (thumbs);
  chord.fingers = /** @type {any} */ (fingers);
  return chord;
}

/** @param {import("../models.js").Chord} c */
function chordToText(c) {
  const parts = [];

  const thumb = "01234"
    .split("")
    .filter((_, i) => c.thumbs[i])
    .join("");
  if (thumb) parts.push(`T${thumb}`);

  /** @param {[boolean, boolean, boolean]} rowVals */
  const rowStr = (rowVals) => {
    let s = "";
    if (rowVals[2]) s += "L";
    if (rowVals[1]) s += "M";
    if (rowVals[0]) s += "R";
    return s;
  };

  const rows = c.fingers.map(rowStr);
  let firstFingerAdded = false;
  for (let i = 0; i < rows.length; i++) {
    const s = rows[i];
    if (!s) continue;
    if (!firstFingerAdded) {
      parts.push(`F${i}${s}`);
      firstFingerAdded = true;
    } else {
      parts.push(`${i}${s}`);
    }
  }

  return parts.length ? parts.join("") : "_";
}

/**
 * Sort and format chord entries consistently for the text config sections.
 * @param {{ notation: string, line: string }[]} entries
 * @returns {string[]}
 */
function sortChordEntries(entries) {
  const groupOf = (notation) => notation.startsWith("T") ? 0 : 1;
  const sorted = [...entries].sort((a, b) => {
    const groupDifference = groupOf(a.notation) - groupOf(b.notation);
    if (groupDifference !== 0) return groupDifference;

    const lengthDifference = a.notation.length - b.notation.length;
    if (lengthDifference !== 0) return lengthDifference;

    if (a.notation < b.notation) return -1;
    if (a.notation > b.notation) return 1;
    return 0;
  });

  const lines = [];
  let previous = null;
  for (const entry of sorted) {
    if (
      previous &&
      (groupOf(previous.notation) !== groupOf(entry.notation) ||
        previous.notation.length !== entry.notation.length)
    ) {
      lines.push("");
    }
    lines.push(entry.line);
    previous = entry;
  }
  return lines;
}

/**
 * @param {string} val
 * @param {string} layout
 * @returns {import("../models.js").Command}
 */
function commandFromText(val, layout) {
  const colonIdx = val.indexOf(":");
  let typ = val;
  if (colonIdx !== -1) {
    typ = val.slice(0, colonIdx);
    val = val.slice(colonIdx + 1);
  } else {
    typ = "keyboard";
  }

  if (["system", "sys"].includes(typ)) {
    const name = normalizeStr(val);
    if (!(name in SYSTEM_COMMANDS)) throw new Error(`Unknown system command: ${name}`);
    return makeCommand(CommandType.SYSTEM, SYSTEM_COMMANDS[name], 0);
  }

  if (["keyboard", "kb"].includes(typ)) {
    if (val in KEY_MACROS) val = KEY_MACROS[val];
    const code = keycodeFromText(val, layout);
    if (code === null) throw new Error(`Invalid key: ${val}`);
    return makeCommand(CommandType.KEYBOARD, code, 0);
  }

  if (["mouse", "ms"].includes(typ)) {
    const name = normalizeStr(val);
    if (!(name in MOUSE_COMMANDS)) throw new Error(`Unknown mouse command: ${name}`);
    return makeCommand(CommandType.MOUSE, MOUSE_COMMANDS[name], 0);
  }

  if (["application", "con"].includes(typ)) {
    const name = normalizeStr(val);
    const code = getBackwardMapping("default", true)?.get(name);
    return makeCommand(CommandType.APPLICATION, code, 0);
  }

  if (["delay", "dly"].includes(typ)) {
    return makeCommand(CommandType.DELAY, Math.floor(parseInt(val, 10) / 10), 0);
  }

  if (["haptic", "hap"].includes(typ)) {
    return makeCommand(CommandType.HAPTIC, parseInt(val, 16), 0);
  }

  throw new Error(`Unknown command type: ${typ}`);
}

/**
 * @param {import("../models.js").Command} command
 * @param {string} layout
 */
function commandToText(command, layout) {
  if (command.b !== 0) throw new Error("Assertion failed: command.b must be 0");

  switch (command.commandType) {
    case CommandType.SYSTEM:
      return `system:${SYSTEM_CODES[command.a]}`;
    case CommandType.KEYBOARD:
      return keycodeToText(command.a, layout);
    case CommandType.MOUSE:
      return `mouse:${MOUSE_CODES[command.a]}`;
    case CommandType.APPLICATION: {
      const name = getForwardMapping("default", true)?.get(command.a);
      return `application:${name}`;
    }
    case CommandType.DELAY:
      return `delay:${command.a * 10}`;
    case CommandType.HAPTIC:
      // FIXME: NOT IMPLEMENTED (ported as-is from twiddler_ctl.config.text)
      return `haptic:${command.a.toString(16).padStart(2, "0")}`;
    default:
      throw new Error(`Unknown command type: ${command.commandType}`);
  }
}

export class Text extends Serdes {
  /**
   * @param {string} text
   * @param {string} layout
   * @returns {import("../models.js").Config}
   */
  static read(text, layout) {
    const parser = parseIni(text);
    const cfg = makeConfig();

    const configSection = parser.get("config");
    if (configSection) {
      cfg.repeat = getBool(configSection, "repeat", cfg.repeat);
      cfg.mode = MODE_NAMES[configSection.get("mode")] ?? cfg.mode;
      cfg.direct = getBool(configSection, "direct", cfg.direct);
      cfg.haptic = getBool(configSection, "haptic", cfg.haptic);
      cfg.stickyNum = getBool(configSection, "sticky_num", cfg.stickyNum);
      cfg.stickyAlt = getBool(configSection, "sticky_alt", cfg.stickyAlt);
      cfg.stickyCtrl = getBool(configSection, "sticky_ctrl", cfg.stickyCtrl);
      cfg.stickyShift = getBool(configSection, "sticky_shift", cfg.stickyShift);
      cfg.navUpDirection = NAV_DIRECTIONS[configSection.get("nav_up_direction")] ?? cfg.navUpDirection;
      cfg.navInvertX = getBool(configSection, "nav_invert_x", cfg.navInvertX);
      cfg.navSensitivity = getInt(configSection, "nav_sensitivity", cfg.navSensitivity);
      cfg.idleTime = getInt(configSection, "idle_time", cfg.idleTime);
      cfg.repeatDelay = Math.floor(getInt(configSection, "repeat_delay", cfg.repeatDelay * 10) / 10);
    }

    const dedicatedSection = parser.get("dedicated");
    if (dedicatedSection) {
      for (const [rawKey, rawVal] of dedicatedSection) {
        const key = normalizeStr(rawKey);
        if (!(key in DEDICATED_OFFSETS)) throw new Error(`Unknown key: ${key}`);

        const val = normalizeStr(rawVal);
        if (!(val in DEDICATED_KEYS)) throw new Error(`Unknown action: ${val}`);

        cfg.dedicated[DEDICATED_OFFSETS[key]] = DEDICATED_KEYS[val];
      }
    }

    const mappingsSection = parser.get("mappings");
    if (mappingsSection) {
      cfg.mappings = [];
      for (const [key, val] of mappingsSection) {
        const chord = chordFromText(key);
        const cmds = val.split(/\s+/).filter(Boolean).map((cmdTxt) => commandFromText(cmdTxt, layout));
        cfg.mappings.push(makeMapping(chord, cmds));
      }
    }

    return cfg;
  }

  /**
   * @param {import("../models.js").Config} cfg
   * @param {string} layout
   * @returns {string}
   */
  static write(cfg, layout) {
    const lines = [];
    lines.push("[config]");
    lines.push(`repeat = ${cfg.repeat}`);
    lines.push(`mode = ${MODE_CODES[cfg.mode]}`);
    lines.push(`direct = ${cfg.direct}`);
    lines.push(`haptic = ${cfg.haptic}`);
    lines.push(`sticky_num = ${cfg.stickyNum}`);
    lines.push(`sticky_alt = ${cfg.stickyAlt}`);
    lines.push(`sticky_ctrl = ${cfg.stickyCtrl}`);
    lines.push(`sticky_shift = ${cfg.stickyShift}`);
    lines.push(`nav_up_direction = ${NAV_CODES[cfg.navUpDirection]}`);
    lines.push(`nav_invert_x = ${cfg.navInvertX}`);
    lines.push(`nav_sensitivity = ${cfg.navSensitivity}`);
    lines.push(`idle_time = ${cfg.idleTime}`);
    lines.push(`repeat_delay = ${cfg.repeatDelay * 10}`);

    lines.push("");
    lines.push("[dedicated]");
    const dedicatedEntries = [];
    for (let off = 0; off < cfg.dedicated.length; off++) {
      const val = cfg.dedicated[off];
      if (val === 0) continue;
      const notation = DEDICATED_ORDER[off].toUpperCase();
      dedicatedEntries.push({
        notation,
        line: `${notation} = ${DEDICATED_CODES[val]}`,
      });
    }
    lines.push(...sortChordEntries(dedicatedEntries));

    lines.push("");
    lines.push("[mappings]");
    const mappingEntries = [];
    for (const mapping of cfg.mappings) {
      const notation = chordToText(mapping.chord);
      const cmdTxts = mapping.commands.map((cmd) => commandToText(cmd, layout));
      mappingEntries.push({
        notation,
        line: `${notation} = ${cmdTxts.join(" ")}`,
      });
    }
    lines.push(...sortChordEntries(mappingEntries));

    return lines.join("\n");
  }
}
