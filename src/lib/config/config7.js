/**
 * Binary "version 7" Twiddler config codec, byte-for-byte compatible with
 * twiddler_ctl.config.config7.Config7. Operates on whole buffers (Uint8Array)
 * rather than streaming file handles, since configs are tiny (a few KB) and
 * browser file APIs hand back whole ArrayBuffers anyway.
 */
import { Serdes } from "./index.js";
import { CommandType, makeChord, makeCommand, makeConfig, makeMapping } from "../models.js";

const HEADER_LENGTH = 0x80;
const MAPPING_LENGTH = 8;

/** @param {Uint8Array} data - 4 bytes, little-endian uint32 */
function chordFromBytes(data) {
  const value = new DataView(data.buffer, data.byteOffset, 4).getUint32(0, true);
  const chord = makeChord();
  chord.thumbs = [
    Boolean(value & (1 << 0x13)),
    Boolean(value & (1 << 0x00)),
    Boolean(value & (1 << 0x04)),
    Boolean(value & (1 << 0x08)),
    Boolean(value & (1 << 0x0c)),
  ];
  chord.fingers = [
    [Boolean(value & (1 << 0x10)), Boolean(value & (1 << 0x11)), Boolean(value & (1 << 0x12))],
    [Boolean(value & (1 << 0x01)), Boolean(value & (1 << 0x02)), Boolean(value & (1 << 0x03))],
    [Boolean(value & (1 << 0x05)), Boolean(value & (1 << 0x06)), Boolean(value & (1 << 0x07))],
    [Boolean(value & (1 << 0x09)), Boolean(value & (1 << 0x0a)), Boolean(value & (1 << 0x0b))],
    [Boolean(value & (1 << 0x0d)), Boolean(value & (1 << 0x0e)), Boolean(value & (1 << 0x0f))],
  ];
  return chord;
}

/** @param {import("../models.js").Chord} c */
function chordToInt(c) {
  let value = 0;
  value |= Number(c.thumbs[0]) << 0x13;
  value |= Number(c.thumbs[1]) << 0x00;
  value |= Number(c.thumbs[2]) << 0x04;
  value |= Number(c.thumbs[3]) << 0x08;
  value |= Number(c.thumbs[4]) << 0x0c;

  value |= Number(c.fingers[0][0]) << 0x10;
  value |= Number(c.fingers[0][1]) << 0x11;
  value |= Number(c.fingers[0][2]) << 0x12;

  value |= Number(c.fingers[1][0]) << 0x01;
  value |= Number(c.fingers[1][1]) << 0x02;
  value |= Number(c.fingers[1][2]) << 0x03;

  value |= Number(c.fingers[2][0]) << 0x05;
  value |= Number(c.fingers[2][1]) << 0x06;
  value |= Number(c.fingers[2][2]) << 0x07;

  value |= Number(c.fingers[3][0]) << 0x09;
  value |= Number(c.fingers[3][1]) << 0x0a;
  value |= Number(c.fingers[3][2]) << 0x0b;

  value |= Number(c.fingers[4][0]) << 0x0d;
  value |= Number(c.fingers[4][1]) << 0x0e;
  value |= Number(c.fingers[4][2]) << 0x0f;

  return value >>> 0;
}

/** @param {import("../models.js").Chord} c */
function chordToBytes(c) {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, chordToInt(c), true);
  return out;
}

/** @param {Uint8Array} data - 4 bytes: uint8 type, uint16 LE a, uint8 b */
function commandFromBytes(data) {
  const view = new DataView(data.buffer, data.byteOffset, 4);
  const cmdType = view.getUint8(0);
  const a = view.getUint16(1, true);
  const b = view.getUint8(3);
  return makeCommand(cmdType, a, b);
}

/** @param {import("../models.js").Command} cmd */
function commandToBytes(cmd) {
  const out = new Uint8Array(4);
  const view = new DataView(out.buffer);
  view.setUint8(0, cmd.commandType);
  view.setUint16(1, cmd.a, true);
  view.setUint8(3, cmd.b);
  return out;
}

const NONE_COMMAND = [0, 0, 0, 0];

/**
 * @param {Uint8Array} buf
 * @param {number} start
 * @returns {import("../models.js").Command[]}
 */
function commandListFromBuffer(buf, start) {
  /** @type {import("../models.js").Command[]} */
  const commands = [];
  let pos = start;

  while (true) {
    const chunk = buf.subarray(pos, pos + 4);
    if (chunk.length < 4) {
      throw new Error("Unexpected end of buffer while reading commands");
    }
    if (chunk.every((b, i) => b === NONE_COMMAND[i])) break;

    commands.push(commandFromBytes(chunk));
    pos += 4;
  }

  return commands;
}

/** @param {import("../models.js").Command[]} commands */
function commandListToBytes(commands) {
  const parts = commands.map(commandToBytes);
  parts.push(new Uint8Array(NONE_COMMAND));
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/** @param {Uint8Array} bytes */
function bytesKey(bytes) {
  return Array.from(bytes).join(",");
}

export class Config7 extends Serdes {
  /**
   * @param {Uint8Array | ArrayBuffer} data
   * @param {string} _layout - unused, present for Serdes symmetry
   * @returns {import("../models.js").Config}
   */
  static read(data, _layout) {
    const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

    const cfg = makeConfig();

    cfg.version = view.getUint8(4);
    if (cfg.version !== 7) {
      throw new Error(`Unsupported version: ${cfg.version}, expected 7`);
    }

    const a = view.getUint8(5);
    cfg.repeat = Boolean(a & (1 << 0));
    cfg.mode = (a & (1 << 1)) >> 1;
    cfg.direct = Boolean(a & (1 << 2));
    cfg.haptic = Boolean(a & (1 << 3));
    cfg.stickyNum = Boolean(a & (1 << 4));
    cfg.stickyAlt = Boolean(a & (1 << 5));
    cfg.stickyCtrl = Boolean(a & (1 << 6));
    cfg.stickyShift = Boolean(a & (1 << 7));

    const b = view.getUint8(6);
    cfg.navUpDirection = b & 0x3;
    cfg.navInvertX = Boolean(b & (1 << 2));
    cfg.navSensitivity = (b >> 3) & 0x7;

    const mappingCount = view.getUint16(8, true);
    cfg.idleTime = view.getUint16(10, true);
    cfg.repeatDelay = view.getUint8(12);

    cfg.dedicated = Array.from(buf.subarray(0x40, 0x40 + 20));

    cfg.mappings = [];
    let pos = HEADER_LENGTH;
    for (let i = 0; i < mappingCount; i++) {
      const chunk = buf.subarray(pos, pos + MAPPING_LENGTH);
      if (chunk.length < MAPPING_LENGTH) {
        throw new Error("Unexpected end of buffer while reading mappings");
      }
      pos += MAPPING_LENGTH;

      const chord = chordFromBytes(chunk.subarray(0, 4));
      const command = commandFromBytes(chunk.subarray(4, 8));

      let commands = [command];
      if (command.commandType === CommandType.COMMAND_LIST) {
        const listStart = HEADER_LENGTH + mappingCount * MAPPING_LENGTH + command.a;
        commands = commandListFromBuffer(buf, listStart);
      }

      cfg.mappings.push(makeMapping(chord, commands));
    }

    return cfg;
  }

  /**
   * @param {import("../models.js").Config} cfg
   * @param {string} _layout - unused, present for Serdes symmetry
   * @returns {Uint8Array}
   */
  static write(cfg, _layout) {
    const mappings = [...cfg.mappings].sort((m1, m2) => chordToInt(m1.chord) - chordToInt(m2.chord));
    const dataOffset = HEADER_LENGTH + mappings.length * MAPPING_LENGTH;
    const records = new Uint8Array(mappings.length * MAPPING_LENGTH);
    const commandLists = [];
    /** @type {Map<string, number>} */
    const commandListOffsets = new Map();
    let commandDataLength = 0;

    mappings.forEach((mapping, index) => {
      const recordOffset = index * MAPPING_LENGTH;
      records.set(chordToBytes(mapping.chord), recordOffset);

      let command = mapping.commands[0];
      if (mapping.commands.length !== 1) {
        const listBytes = commandListToBytes(mapping.commands);
        const key = bytesKey(listBytes);
        let listOffset = commandListOffsets.get(key);
        if (listOffset === undefined) {
          listOffset = commandDataLength;
          commandListOffsets.set(key, listOffset);
          commandLists.push(listBytes);
          commandDataLength += listBytes.length;
        }
        command = makeCommand(CommandType.COMMAND_LIST, listOffset, 0);
      }
      records.set(commandToBytes(command), recordOffset + 4);
    });

    const header = new Uint8Array(HEADER_LENGTH);
    const headerView = new DataView(header.buffer);
    header[4] = cfg.version;
    header[5] =
      (Number(cfg.repeat) << 0) |
      (cfg.mode << 1) |
      (Number(cfg.direct) << 2) |
      (Number(cfg.haptic) << 3) |
      (Number(cfg.stickyNum) << 4) |
      (Number(cfg.stickyAlt) << 5) |
      (Number(cfg.stickyCtrl) << 6) |
      (Number(cfg.stickyShift) << 7);
    header[6] =
      ((cfg.navUpDirection & 0x3) << 0) | (Number(cfg.navInvertX) << 2) | ((cfg.navSensitivity & 0x7) << 3);

    headerView.setUint16(8, mappings.length, true);
    headerView.setUint16(10, cfg.idleTime, true);
    header[12] = cfg.repeatDelay;

    header.set(cfg.dedicated.slice(0, 20), 0x40);
    header.set([
      0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
      0x08, 0x09, 0x0a, 0x0c, 0x0d, 0x0f, 0x11, 0x14,
      0x16, 0x18, 0x1a, 0x1d, 0x80, 0x80, 0x80, 0x80,
      0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80,
    ], 0x60);

    // Previous chord-specific index generation; kept temporarily for easy restore.
    // header.fill(0x80, 0x60, 0x80);
    // mappings.forEach((mapping, index) => {
    //   const prefix = chordToInt(mapping.chord) & 0x1f;
    //   if (header[0x60 + prefix] === 0x80) header[0x60 + prefix] = index;
    // });

    const result = new Uint8Array(dataOffset + commandDataLength);
    result.set(header);
    result.set(records, HEADER_LENGTH);
    let position = dataOffset;
    for (const commandList of commandLists) {
      result.set(commandList, position);
      position += commandList.length;
    }
    return result;
  }
}
