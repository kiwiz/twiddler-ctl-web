/** Passthrough text log codec, ported from twiddler_ctl.log.text.Text. */
import { Serdes } from "./index.js";

export class Text extends Serdes {
  /**
   * @param {string} text
   * @param {string} _layout
   * @returns {string}
   */
  static write(text, _layout) {
    return text;
  }

  /**
   * @param {string} data
   * @param {string} _layout
   * @returns {string}
   */
  static read(data, _layout) {
    return data;
  }
}
