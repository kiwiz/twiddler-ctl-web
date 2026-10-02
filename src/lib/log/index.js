/**
 * Codec base "interface" for untethered-mode recording logs, mirroring
 * twiddler_ctl.log.Serdes. Both Binary and Text implement:
 *
 *   write(text: string, layout: string): Uint8Array | string
 *   read(data: Uint8Array | string, layout: string): string
 */
export class Serdes {
  /**
   * @param {string} _text
   * @param {string} _layout
   * @returns {Uint8Array | string}
   */
  static write(_text, _layout) {
    throw new Error("Not implemented");
  }

  /**
   * @param {Uint8Array | string} _data
   * @param {string} _layout
   * @returns {string}
   */
  static read(_data, _layout) {
    throw new Error("Not implemented");
  }
}
