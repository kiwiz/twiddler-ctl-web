import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useColorScheme,
} from "@mui/material";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { BinaryLog } from "../lib/index.js";
import { KeyboardLayoutSelect } from "../components/KeyboardLayoutSelect.jsx";
import { ConfigFilePicker } from "../components/ConfigFilePicker.jsx";
import { useConfigSource } from "../contexts/ConfigSourceContext.jsx";
import { useLayout } from "../contexts/LayoutContext.jsx";
import { useSync } from "../contexts/SyncContext.jsx";
import { useEditor } from "../contexts/EditorContext.jsx";

export function EditPage({
  page,
  showLoadScreen,
}) {
  const { configFiles, hasConfigDirectory } = useConfigSource();
  const { layouts, layout, configuredLayoutState } = useLayout();
  const { handleLayoutChange, refreshConfigFiles, refreshConfiguredLayout } = useSync();
  const {
    editorContainerRef,
    editorFileHandle,
    editorFileName,
    editorOpenedFromConfigs,
    setEditorLayout,
    editorDirty,
    saving,
    openConfigFromDirectory,
    saveConfig,
    downloadConfig,
    requestMeasure,
  } = useEditor();
  const { mode, systemMode } = useColorScheme();
  const colorScheme = mode === "system" ? systemMode : mode;
  const [downloadMenuAnchor, setDownloadMenuAnchor] = useState(null);
  const logInputRef = useRef(null);
  const [logFilename, setLogFilename] = useState("");
  const [logText, setLogText] = useState("");
  const [binaryLogData, setBinaryLogData] = useState(null);
  const [logTextEdited, setLogTextEdited] = useState(false);
  const [editLayout, setEditLayout] = useState(layout);
  const [logLayout, setLogLayout] = useState(layout);
  const [logError, setLogError] = useState("");

  useEffect(() => {
    if (page === 1 && !showLoadScreen) requestMeasure();
  }, [page, showLoadScreen, requestMeasure]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setEditLayout(configuredLayoutState.layout);
      setLogLayout(configuredLayoutState.layout);
      setEditorLayout(configuredLayoutState.layout);
    });
    return () => { active = false; };
  }, [configuredLayoutState, setEditorLayout]);

  useEffect(() => {
    if (!binaryLogData || logTextEdited || !logLayout) return undefined;
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      try {
        setLogText(BinaryLog.read(binaryLogData, logLayout));
        setLogError("");
      } catch (error) {
        setLogError(error.message);
      }
    });
    return () => { active = false; };
  }, [binaryLogData, logLayout, logTextEdited]);

  const handleDownloadConfig = (format) => {
    setDownloadMenuAnchor(null);
    downloadConfig(format);
  };

  const handleRefreshConfigFiles = async () => {
    if (!(await refreshConfigFiles())) return false;
    await refreshConfiguredLayout();
    return true;
  };

  const handleLogFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".log")) {
      setLogFilename("");
      setBinaryLogData(null);
      setLogText("");
      setLogTextEdited(false);
      setLogError("Select a .log file.");
      return;
    }
    setLogFilename(file.name);
    setLogError("");
    setLogTextEdited(false);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      setBinaryLogData(bytes);
      setLogText(BinaryLog.read(bytes, logLayout));
    } catch (error) {
      setBinaryLogData(null);
      setLogText("");
      setLogError(error.message);
    }
  };

  const convertLog = () => {
    try {
      const blob = new Blob([logText], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const baseName = (logFilename || "twiddler-log").replace(/\.[^.]+$/, "") || "twiddler-log";
      link.href = url;
      link.download = `${baseName}.txt`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      setLogError(error.message);
    }
  };

  const handleEditLayoutChange = (value) => {
    setEditLayout(value);
    setEditorLayout(value);
    handleLayoutChange(value);
  };

  const handleLogLayoutChange = (value) => {
    setLogLayout(value);
    handleLayoutChange(value);
  };

  return (
    <Box role="tabpanel" id="app-panel-1" aria-labelledby="app-tab-1" hidden={showLoadScreen || page !== 1}>
      <Stack spacing={2}>
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Stack spacing={0.5}>
                <Typography variant="h6" component="h3">Editor</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Choose a Twiddler .cfg file or a twiddler-ctl .tctl.txt file to edit it.
                </Typography>
              </Stack>
              <KeyboardLayoutSelect id="edit-layout" layouts={layouts} layout={editLayout} onChange={handleEditLayoutChange} />
              <ConfigFilePicker
                configFiles={configFiles}
                configsAvailable={hasConfigDirectory}
                disabled={!layouts.length}
                selectedFile={editorFileName}
                onSelectConfig={(filename) => openConfigFromDirectory(filename, editLayout)}
                onRefreshFiles={handleRefreshConfigFiles}
              />
              <Box
                ref={editorContainerRef}
                className="editor-frame"
                sx={{ borderRadius: 1 }}
                style={{ borderColor: colorScheme === "dark" ? "#343a46" : "#c5cad5" }}
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                <ButtonGroup
                  variant="contained"
                  aria-label={editorFileHandle && editorOpenedFromConfigs ? "Save or download config" : "Download config"}
                  sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
                >
                  {editorFileHandle && editorOpenedFromConfigs && (
                    <Button onClick={saveConfig} disabled={saving || !editorDirty}>
                      {saving ? "Saving…" : "Save"}
                    </Button>
                  )}
                  <Button
                    endIcon={<ArrowDropDownIcon />}
                    onClick={(event) => setDownloadMenuAnchor(event.currentTarget)}
                    disabled={!layouts.length}
                    aria-haspopup="menu"
                    aria-expanded={Boolean(downloadMenuAnchor)}
                  >
                    Download
                  </Button>
                </ButtonGroup>
                <Menu
                  anchorEl={downloadMenuAnchor}
                  open={Boolean(downloadMenuAnchor)}
                  onClose={() => setDownloadMenuAnchor(null)}
                >
                  <MenuItem onClick={() => handleDownloadConfig("tctl.txt")}>Text (.tctl.txt)</MenuItem>
                  <MenuItem onClick={() => handleDownloadConfig("cfg")}>Native config (.cfg)</MenuItem>
                </Menu>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Stack spacing={0.5}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Typography variant="h6" component="h3">Datalog converter</Typography>
                  <Tooltip title="Datalogger documentation">
                    <IconButton
                      component="a"
                      href="https://www.mytwiddler.com/doc/doku.php?id=t4_datalogger"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Datalogger documentation"
                      size="small"
                    >
                      <InfoOutlinedIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Choose a Twiddler .log file to decode it.
                </Typography>
              </Stack>
              <KeyboardLayoutSelect id="untethered-log-layout" layouts={layouts} layout={logLayout} onChange={handleLogLayoutChange} />
              <input
                ref={logInputRef}
                type="file"
                accept=".log"
                aria-label="Open a .log file"
                style={{ display: "none" }}
                onChange={handleLogFileChange}
              />
              <Button variant="outlined" onClick={() => logInputRef.current?.click()} disabled={!layouts.length}>
                {logFilename || "Open File"}
              </Button>
              {logError && <Alert severity="error" role="alert">Could not convert log: {logError}</Alert>}
              {logFilename && !logError && (
                <>
                  <TextField
                    multiline
                    minRows={5}
                    maxRows={14}
                    fullWidth
                    label="Log text"
                    value={logText}
                    onChange={(event) => {
                      setLogText(event.target.value);
                      setLogTextEdited(true);
                    }}
                  />
                  <Button
                    variant="contained"
                    onClick={convertLog}
                    disabled={!logFilename || Boolean(logError) || !layouts.length}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    Download
                  </Button>
                </>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
