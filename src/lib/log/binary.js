/**
 * Binary untethered-recording log codec (4-byte little-endian HID keycode
 * per character), ported from twiddler_ctl.log.binary.Binary.
 */
import { Serdes } from "./index.js";
import { getForwardMapping, getBackwardMapping } from "../util.js";

const NAME_MAP = {
  space: " ", period: ".", comma: ",", tilde: "~", exclamation: "!",
  at: "@", hash: "#", dollar: "$", percent: "%", caret: "^",
  ampersand: "&", asterisk: "*", left_parenthesis: "(", right_parenthesis: ")",
  left_curly_bracket: "{", right_curly_bracket: "}", question: "?", plus: "+",
  pipe: "|", underscore: "_", colon: ":", double_quote: '"',
  less_than: "<", greater_than: ">",
};
const CHAR_MAP = Object.fromEntries(Object.entries(NAME_MAP).map(([k, v]) => [v, k]));

export class Binary extends Serdes {
  /**
   * @param {string} text
   * @param {string} layout
   * @returns {Uint8Array}
   */
  static write(text, layout) {
    const mapping = getBackwardMapping(layout);
    if (!mapping) throw new Error(`Unknown keyboard layout: ${layout}`);
    const characters = Array.from(text);
    const out = new Uint8Array(characters.length * 4);
    const view = new DataView(out.buffer);

    let i = 0;
    for (const c of characters) {
      const val = mapping.get(CHAR_MAP[c] ?? c);
      if (val === undefined) throw new Error(`Character cannot be encoded for ${layout}: ${c}`);
      view.setUint32(i, val, true);
      i += 4;
    }

    return out;
  }

  /**
   * @param {Uint8Array | ArrayBuffer} data
   * @param {string} layout
   * @returns {string}
   */
  static read(data, layout) {
    const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
    if (buf.length % 4 !== 0) {
      throw new Error("Binary log length must be a multiple of 4 bytes");
    }
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const mapping = getForwardMapping(layout);
    if (!mapping) throw new Error(`Unknown keyboard layout: ${layout}`);

    let out = "";
    for (let i = 0; i + 4 <= buf.length; i += 4) {
      const code = view.getUint32(i, true);
      const char = mapping.get(code) ?? "_";
      out += NAME_MAP[char] ?? char;
    }

    return out;
  }
}
