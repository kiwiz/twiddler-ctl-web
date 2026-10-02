import React from "react";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { normalizeStr } from "../lib/util.js";

const PICKER_LAYOUTS = ["QWERTY", "AZERTY", "QWERTZ", "Colemak", "Dvorak"];

export function KeyboardLayoutSelect({ id, layouts, layout, onChange }) {
  const pickerLayouts = PICKER_LAYOUTS
    .filter((name) => layouts.some((available) => normalizeStr(available) === normalizeStr(name)))
    .map((name) => ({ value: normalizeStr(name), label: name }));
  const selectedLayout = layouts.find((name) => normalizeStr(name) === normalizeStr(layout));
  if (selectedLayout && !pickerLayouts.some(({ value }) => value === normalizeStr(selectedLayout))) {
    pickerLayouts.push({ value: normalizeStr(selectedLayout), label: selectedLayout });
  }

  return (
    <FormControl fullWidth size="small" disabled={!layouts.length}>
      <InputLabel id={`${id}-label`}>Keyboard layout</InputLabel>
      <Select labelId={`${id}-label`} label="Keyboard layout" value={layout} onChange={(event) => onChange(event.target.value)}>
        {pickerLayouts.map(({ value, label: name }) => (
          <MenuItem key={value} value={value}>{name}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
