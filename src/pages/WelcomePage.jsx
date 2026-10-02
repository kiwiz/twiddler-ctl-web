import React, { useRef } from "react";
import { Box, Button, Card, CardContent, Stack, Tooltip, Typography } from "@mui/material";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import { useConfigSource } from "../contexts/ConfigSourceContext.jsx";
import { useLayout } from "../contexts/LayoutContext.jsx";

export function WelcomePage({
  showLoadScreen,
  handlePickConfigs,
  handleLoadSampleDirectory,
  onOpenFile,
  onReturnToWork,
}) {
  const { hasDirectoryPicker, loadedContext, isOnline, sampleBundleLoaded } = useConfigSource();
  const { layouts } = useLayout();
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onOpenFile(file);
  };

  return (
    <Card variant="outlined" hidden={!showLoadScreen}>
      <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
        <Stack spacing={2.5} alignItems="center" textAlign="center">
          <Box sx={{ maxWidth: 620 }}>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 700 }}>
              Load config source
            </Typography>
          </Box>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems="stretch"
            justifyContent="center"
            useFlexGap
            sx={{ width: "100%" }}
          >
            <Button
              variant="contained"
              size="large"
              onClick={handlePickConfigs}
              disabled={!hasDirectoryPicker || !layouts.length}
              sx={{ flex: 1, minWidth: 0, minHeight: 140, flexDirection: "column", gap: 1.5 }}
            >
              <FolderOpenOutlinedIcon sx={{ fontSize: 48 }} />
              Directory
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.cfg,text/plain,application/octet-stream"
              aria-label="Load a config file"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
            <Button
              variant="contained"
              size="large"
              onClick={() => fileInputRef.current?.click()}
              disabled={!layouts.length}
              sx={{ flex: 1, minWidth: 0, minHeight: 140, flexDirection: "column", gap: 1.5 }}
            >
              <DescriptionOutlinedIcon sx={{ fontSize: 48 }} />
              File
            </Button>
            <Tooltip title={!isOnline && !sampleBundleLoaded ? "Not available offline" : ""}>
              <span
                style={{ flex: 1, minWidth: 0 }}
                tabIndex={!isOnline && !sampleBundleLoaded ? 0 : undefined}
              >
                <Button
                  variant="outlined"
                  size="large"
                  onClick={handleLoadSampleDirectory}
                  disabled={!layouts.length || (!isOnline && !sampleBundleLoaded)}
                  sx={{ width: "100%", minWidth: 0, minHeight: 140, flexDirection: "column", gap: 1.5 }}
                >
                  <FolderOpenOutlinedIcon sx={{ fontSize: 48 }} />
                  Samples
                </Button>
              </span>
            </Tooltip>
          </Stack>
          {loadedContext && (
            <Button variant="text" onClick={onReturnToWork}>
              Return
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
