import { CommandType, getForwardMapping, normalizeStr } from "../lib/index.js";

export function extractPracticeMappings(config, selectedLayout, layoutCatalog) {
  return config.mappings.flatMap((mapping) => {
    if (mapping.commands.length !== 1 || mapping.commands[0].commandType !== CommandType.KEYBOARD || mapping.commands[0].b !== 0) {
      return [];
    }
    const character = printableCharacterForCommand(mapping.commands[0], selectedLayout, layoutCatalog);
    return character === null ? [] : [{ character, chord: mapping.chord }];
  });
}

function printableCharacterForCommand(command, selectedLayout, layoutCatalog) {
  const modifiers = command.a & 0xff;
  const shift = Boolean(modifiers & (0x02 | 0x20));
  const altGr = Boolean(modifiers & 0x40);
  if (modifiers & ~(0x02 | 0x20 | 0x40)) return null;
  const keyName = getForwardMapping(selectedLayout)?.get(command.a >> 8);
  if (!keyName) return null;
  const layoutName = layoutCatalog.listLayouts().find((name) => normalizeStr(name) === selectedLayout);
  if (!layoutName) return null;
  const composition = layoutCatalog.getLayout(layoutName).jsonData.composition ?? {};
  const normalizedKeyName = normalizeStr(keyName);

  for (const [character, alternatives] of Object.entries(composition)) {
    if (Array.from(character).length !== 1 || /\p{C}/u.test(character)) continue;
    if (!Array.isArray(alternatives)) continue;
    for (const combination of alternatives) {
      if (!Array.isArray(combination)) continue;
      const tokens = combination.map((token) => normalizeStr(String(token)));
      const hasShift = tokens.includes("shift");
      const hasAltGr = tokens.includes("altgr");
      const keyTokens = tokens.filter((token) => token !== "shift" && token !== "altgr");
      if (keyTokens.length === 1 && keyTokens[0] === normalizedKeyName && hasShift === shift && hasAltGr === altGr) {
        return character;
      }
    }
  }
  return null;
}

export function choosePracticeMapping(mappings, previousCharacter = null) {
  const differentCharacters = mappings.filter((mapping) => mapping.character !== previousCharacter);
  const choices = differentCharacters.length ? differentCharacters : mappings;
  return choices[Math.floor(Math.random() * choices.length)];
}

export function displayPracticeCharacter(character) {
  return character === " " ? "␠" : character;
}

export function practiceAccuracy(session) {
  const attempts = session.correct + session.mistakes;
  return attempts ? Math.round((session.correct / attempts) * 100) : 100;
}

export function chordToPracticeText(chord) {
  const parts = [];
  const thumbs = chord.thumbs.map((pressed, index) => pressed ? index : "").join("");
  if (thumbs) parts.push(`T${thumbs}`);

  const rows = chord.fingers.map((row) => `${row[2] ? "L" : ""}${row[1] ? "M" : ""}${row[0] ? "R" : ""}`);
  let firstFinger = true;
  rows.forEach((row, index) => {
    if (!row) return;
    parts.push(`${firstFinger ? "F" : ""}${index}${row}`);
    firstFinger = false;
  });
  return parts.join("") || "_";
}
