/**
 * Config codec base "interface" (JSDoc-typed duck type), mirroring
 * twiddler_ctl.config.Serdes. Both Config7 and TextConfig implement:
 *
 *   write(config: Config, layout: string): Uint8Array | string
 *   read(data: Uint8Array | string, layout: string): Config
 */
export class Serdes {
  /**
   * @param {import("../models.js").Config} _config
   * @param {string} _layout
   * @returns {Uint8Array | string}
   */
  static write(_config, _layout) {
    throw new Error("Not implemented");
  }

  /**
   * @param {Uint8Array | string} _data
   * @param {string} _layout
   * @returns {import("../models.js").Config}
   */
  static read(_data, _layout) {
    throw new Error("Not implemented");
  }
}
