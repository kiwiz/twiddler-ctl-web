import React, { useState } from "react";
import {
  Alert,
  Container,
  CssBaseline,
  Paper,
  Stack,
  Tab,
  Tabs,
  createTheme,
} from "@mui/material";
import { DevicePage } from "./pages/DevicePage.jsx";
import { EditPage } from "./pages/EditPage.jsx";
import { PracticePage } from "./pages/PracticePage.jsx";
import { WelcomePage } from "./pages/WelcomePage.jsx";
import { AppProviders } from "./contexts/AppProviders.jsx";
import { useConfigSource } from "./contexts/ConfigSourceContext.jsx";
import { useNotice } from "./contexts/NoticeContext.jsx";
import { useSync } from "./contexts/SyncContext.jsx";
import { useEditor } from "./contexts/EditorContext.jsx";
import { TopNavBar } from "./components/TopNavBar.jsx";
import { SourceContext } from "./components/SourceContext.jsx";
import { directoryPickerHelp } from "./pages/syncUtils.js";
import "./app.css";

export const theme = createTheme({
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#3157c8" },
        background: { default: "#f5f7fb" },
      },
    },
    dark: {
      palette: {
        primary: { main: "#3157c8" },
        background: { default: "#111318", paper: "#191c22" },
      },
    },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
});

function AppShell() {
  const { hasDirectoryPicker } = useConfigSource();
  const { notice, setNotice } = useNotice();
  const { loadConfigDirectory, loadSampleDirectory } = useSync();
  const {
    openExternalFile,
    openConfigFromDirectory,
  } = useEditor();
  const [page, setPage] = useState(0);
  const [showLoadScreen, setShowLoadScreen] = useState(true);
  const [showFileSystemWarning, setShowFileSystemWarning] = useState(!hasDirectoryPicker);

  const handlePickConfigs = async () => {
    if (await loadConfigDirectory()) {
      setPage(0);
      setShowLoadScreen(false);
    }
  };

  const handleLoadSampleDirectory = async () => {
    if (await loadSampleDirectory()) {
      setPage(0);
      setShowLoadScreen(false);
    }
  };

  const handleOpenConfig = async (file) => {
    if (await openExternalFile(file)) {
      setPage(1);
      setShowLoadScreen(false);
    }
  };

  const handleOpenSlotConfig = async (filename, selectedLayout) => {
    if (await openConfigFromDirectory(filename, selectedLayout)) {
      setPage(1);
      setShowLoadScreen(false);
    }
  };

  return (
    <>
      <CssBaseline />
      <TopNavBar />

      <Container component="main" maxWidth="md" sx={{ py: { xs: 2.5, sm: 4 } }}>
        <Stack spacing={2}>
          {showFileSystemWarning && (
            <Alert severity="warning" role="status" onClose={() => setShowFileSystemWarning(false)}>
              {directoryPickerHelp()}
            </Alert>
          )}
          {notice && (
            <Alert
              severity={notice.severity}
              role={notice.severity === "error" ? "alert" : "status"}
              onClose={() => setNotice(null)}
            >
              {notice.message}
            </Alert>
          )}

          <WelcomePage
            showLoadScreen={showLoadScreen}
            handlePickConfigs={handlePickConfigs}
            handleLoadSampleDirectory={handleLoadSampleDirectory}
            onOpenFile={handleOpenConfig}
            onReturnToWork={() => setShowLoadScreen(false)}
          />

          <Paper variant="outlined" sx={{ px: 1, borderRadius: 0 }} hidden={showLoadScreen}>
            <Tabs value={page} onChange={(_event, nextPage) => setPage(nextPage)} aria-label="Application pages">
              <Tab value={0} label="Device" id="app-tab-0" aria-controls="app-panel-0" />
              <Tab value={1} label="Edit" id="app-tab-1" aria-controls="app-panel-1" />
              <Tab value={2} label="Practice" id="app-tab-2" aria-controls="app-panel-2" />
            </Tabs>
          </Paper>

          <SourceContext showLoadScreen={showLoadScreen} onChangeSource={() => setShowLoadScreen(true)} />

          <DevicePage
            page={page}
            showLoadScreen={showLoadScreen}
            handleOpenSlotConfig={handleOpenSlotConfig}
          />

          <EditPage
            page={page}
            showLoadScreen={showLoadScreen}
          />

          <PracticePage
            page={page}
            showLoadScreen={showLoadScreen}
          />

        </Stack>
      </Container>
    </>
  );
}

export function App() {
  return (
    <AppProviders>
      <AppShell />
    </AppProviders>
  );
}
