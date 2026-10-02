import React, { useState } from "react";
import { CircularProgress, IconButton, MenuItem, Stack, TextField, Tooltip } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

/**
 * Shared config source picker for the editor and practice tools. Configs in
 * the Sync folder are offered only while that folder is available. Loading a
 * file from the computer is handled by the app's source-selection screen.
 */
export function ConfigFilePicker({
  configFiles = [],
  configsAvailable = false,
  disabled = false,
  selectedFile = "",
  label = "Config file",
  onSelectConfig,
  onRefreshFiles,
}) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!onRefreshFiles) return;
    setRefreshing(true);
    try {
      await onRefreshFiles();
    } finally {
      setRefreshing(false);
    }
  };

  if (!configsAvailable) return null;

  const availableFiles = [...new Set([...configFiles, ...(selectedFile ? [selectedFile] : [])])];

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <TextField
        select
        fullWidth
        size="small"
        label={label}
        value={selectedFile}
        onChange={(event) => onSelectConfig(event.target.value)}
        inputProps={{ "aria-label": "Select a config file" }}
        disabled={disabled}
      >
        <MenuItem value="" disabled sx={{ display: "none" }} />
        {availableFiles.length ? availableFiles.map((filename) => (
          <MenuItem key={filename} value={filename}>{filename}</MenuItem>
        )) : <MenuItem disabled>No config files found</MenuItem>}
      </TextField>
      <Tooltip title="Refresh file list">
        <span>
          <IconButton
            size="small"
            aria-label="Refresh file list"
            onClick={handleRefresh}
            disabled={disabled || refreshing || !onRefreshFiles}
          >
            {refreshing ? <CircularProgress size={20} /> : <RefreshIcon />}
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );
}
