import React from "react";
import { Box, Button, Paper, Typography } from "@mui/material";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { useConfigSource } from "../contexts/ConfigSourceContext.jsx";

export function SourceContext({ showLoadScreen, onChangeSource }) {
  const { loadedContext } = useConfigSource();
  if (showLoadScreen || !loadedContext) return null;

  const isFolderSource = loadedContext.kind === "directory";
  const sourceName = isFolderSource ? `${loadedContext.name.replace(/\/+$/, "")}/` : loadedContext.name;

  return (
    <Paper variant="outlined" sx={{ px: 2, py: 0.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minHeight: 32 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1, minWidth: 0 }}>
          <Box component="span" sx={{ display: "flex", alignItems: "center", flexShrink: 0, color: "text.secondary" }}>
            {isFolderSource
              ? <FolderOpenOutlinedIcon fontSize="small" />
              : <DescriptionOutlinedIcon fontSize="small" />}
          </Box>
          <Typography component="span" variant="body2" sx={{ minWidth: 0, color: "text.secondary" }}>
            {sourceName}
          </Typography>
        </Box>
        <Button size="small" startIcon={<SwapHorizIcon />} onClick={onChangeSource} sx={{ flexShrink: 0, ml: "auto", whiteSpace: "nowrap" }}>
          Change source
        </Button>
      </Box>
    </Paper>
  );
}
