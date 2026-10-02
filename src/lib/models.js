/**
 * Plain-object data model for a Twiddler config, mirroring twiddler_ctl.models.
 *
 * @typedef {[boolean, boolean, boolean]} Row
 *
 * @typedef {object} Chord
 * @property {[boolean, boolean, boolean, boolean, boolean]} thumbs
 * @property {[Row, Row, Row, Row, Row]} fingers
 *
 * @typedef {object} Command
 * @property {CommandType} commandType
 * @property {number} a
 * @property {number} b
 *
 * @typedef {object} Mapping
 * @property {Chord} chord
 * @property {Command[]} commands
 *
 * @typedef {object} Config
 * @property {number} version
 * @property {boolean} repeat
 * @property {number} mode
 * @property {boolean} direct
 * @property {boolean} haptic
 * @property {boolean} stickyNum
 * @property {boolean} stickyAlt
 * @property {boolean} stickyCtrl
 * @property {boolean} stickyShift
 * @property {number} navUpDirection
 * @property {boolean} navInvertX
 * @property {number} navSensitivity
 * @property {number} idleTime
 * @property {number} repeatDelay
 * @property {number[]} dedicated - 20 entries
 * @property {Mapping[]} mappings
 */

/** @enum {number} */
export const CommandType = Object.freeze({
  NONE: 0,
  SYSTEM: 1,
  KEYBOARD: 2,
  MOUSE: 3,
  APPLICATION: 4,
  DELAY: 5,
  HAPTIC: 6,
  COMMAND_LIST: 7,
});

/** @returns {Chord} */
export function makeChord() {
  return {
    thumbs: [false, false, false, false, false],
    fingers: [
      [false, false, false],
      [false, false, false],
      [false, false, false],
      [false, false, false],
      [false, false, false],
    ],
  };
}

/**
 * @param {CommandType} commandType
 * @param {number} a
 * @param {number} b
 * @returns {Command}
 */
export function makeCommand(commandType, a, b) {
  return { commandType, a, b };
}

/**
 * @param {Chord} chord
 * @param {Command[]} [commands]
 * @returns {Mapping}
 */
export function makeMapping(chord, commands = []) {
  return { chord, commands };
}

/** @returns {Config} */
export function makeConfig() {
  return {
    version: 7,
    repeat: true,
    mode: 0,
    direct: false,
    haptic: true,
    stickyNum: false,
    stickyAlt: false,
    stickyCtrl: false,
    stickyShift: false,
    navUpDirection: 0,
    navInvertX: false,
    navSensitivity: 0,
    idleTime: 600,
    repeatDelay: 100,
    dedicated: new Array(20).fill(0),
    mappings: [],
  };
}
