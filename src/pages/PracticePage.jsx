import React, { useEffect } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import CloseIcon from "@mui/icons-material/Close";
import GpsFixedIcon from "@mui/icons-material/GpsFixed";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import { ConfigFilePicker } from "../components/ConfigFilePicker.jsx";
import { KeyboardLayoutSelect } from "../components/KeyboardLayoutSelect.jsx";
import { useConfigSource } from "../contexts/ConfigSourceContext.jsx";
import { useLayout } from "../contexts/LayoutContext.jsx";
import { usePractice } from "../contexts/PracticeContext.jsx";
import { useSync } from "../contexts/SyncContext.jsx";
import {
  chordToPracticeText,
  choosePracticeMapping,
  displayPracticeCharacter,
  practiceAccuracy,
} from "./practiceUtils.js";

export function PracticePage({
  page,
  showLoadScreen,
}) {
  const { configFiles, hasConfigDirectory } = useConfigSource();
  const { layouts, layout } = useLayout();
  const { handleLayoutChange, refreshConfigFiles } = useSync();
  const {
    practiceConfig,
    practiceSession,
    setPracticeSession,
    selectPracticeConfig,
    startPractice,
  } = usePractice();

  const handlePracticeLayoutChange = (value) => {
    handleLayoutChange(value);
    if (practiceConfig) selectPracticeConfig(practiceConfig.filename, value);
  };

  useEffect(() => {
    if (!practiceSession?.active) return undefined;
    const timer = window.setInterval(() => {
      setPracticeSession((current) => {
        if (!current?.active) return current;
        const remaining = Math.max(0, Math.ceil((current.endsAt - Date.now()) / 1000));
        return { ...current, remaining, active: remaining > 0 };
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [practiceSession?.active, practiceSession?.endsAt, setPracticeSession]);

  useEffect(() => {
    if (!practiceSession?.active || page !== 2 || showLoadScreen) return undefined;
    const handlePracticeKey = (event) => {
      const altGraph = event.getModifierState?.("AltGraph") || (event.ctrlKey && event.altKey);
      if (event.repeat || event.metaKey || (event.ctrlKey && !altGraph) || (event.altKey && !altGraph) || Array.from(event.key).length !== 1) return;
      event.preventDefault();
      setPracticeSession((current) => {
        if (!current?.active) return current;
        if (event.key === current.mapping.character) {
          return {
            ...current,
            correct: current.correct + 1,
            mapping: choosePracticeMapping(practiceConfig.mappings, current.mapping.character),
            wrongForCurrent: 0,
            revealChord: false,
          };
        }
        const wrongForCurrent = current.wrongForCurrent + 1;
        return {
          ...current,
          mistakes: current.mistakes + 1,
          wrongForCurrent,
          revealChord: current.revealChord || wrongForCurrent >= 2,
        };
      });
    };
    window.addEventListener("keydown", handlePracticeKey);
    return () => window.removeEventListener("keydown", handlePracticeKey);
  }, [practiceSession?.active, practiceSession?.mapping, practiceConfig, page, showLoadScreen, setPracticeSession]);

  return (
    <Box role="tabpanel" id="app-panel-2" aria-labelledby="app-tab-2" hidden={showLoadScreen || page !== 2}>
      {practiceSession ? (
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, textAlign: "center" }}>
          <Stack spacing={2} alignItems="center">
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              flexWrap="wrap"
              justifyContent="center"
              sx={{ width: "100%", minWidth: 0 }}
            >
              <Chip
                icon={<TimerOutlinedIcon />}
                label={`${practiceSession.remaining}s`}
                aria-label={`Time remaining: ${practiceSession.remaining} seconds`}
                color={practiceSession.remaining <= 10 ? "error" : "primary"}
              />
              <Chip
                icon={<CheckIcon />}
                label={practiceSession.correct}
                aria-label={`Correct: ${practiceSession.correct}`}
                variant="outlined"
              />
              <Chip
                icon={<CloseIcon />}
                label={practiceSession.mistakes}
                aria-label={`Mistakes: ${practiceSession.mistakes}`}
                variant="outlined"
              />
              <Chip
                icon={<GpsFixedIcon />}
                label={`${practiceAccuracy(practiceSession)}%`}
                aria-label={`Accuracy: ${practiceAccuracy(practiceSession)}%`}
                variant="outlined"
              />
            </Stack>
            {practiceSession.active ? (
              <>
                <Typography
                  variant="h1"
                  aria-live="polite"
                  sx={{
                    fontSize: { xs: "5rem", sm: "7rem" },
                    fontWeight: 700,
                    lineHeight: 1.1,
                    overflowWrap: "anywhere",
                  }}
                >
                  {practiceSession.revealChord
                    ? chordToPracticeText(practiceSession.mapping.chord)
                    : displayPracticeCharacter(practiceSession.mapping.character)}
                </Typography>
                {practiceSession.revealChord ? (
                  <Typography variant="body2" color="text.secondary" role="status">
                    Chord for {displayPracticeCharacter(practiceSession.mapping.character)}
                  </Typography>
                ) : (
                  <Typography variant="body2" color="text.secondary">Type the character shown above.</Typography>
                )}
              </>
            ) : (
              <Typography variant="h6">Time’s up!</Typography>
            )}
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={startPractice} disabled={!practiceConfig?.mappings.length || practiceConfig.layout !== layout}>
                {practiceSession.active ? "Restart" : "Play again"}
              </Button>
              <Button variant="outlined" onClick={() => setPracticeSession(null)}>
                Quit
              </Button>
            </Stack>
          </Stack>
        </Paper>
      ) : (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Stack spacing={0.5}>
                <Typography variant="h6" component="h3">Practice</Typography>
                <Typography variant="body2" color="text.secondary">
                  Choose a config to practice.
                </Typography>
              </Stack>
              <KeyboardLayoutSelect
                id="practice-layout"
                layouts={layouts}
                layout={layout}
                onChange={handlePracticeLayoutChange}
              />
              <ConfigFilePicker
                configFiles={configFiles}
                configsAvailable={hasConfigDirectory}
                disabled={!layouts.length}
                selectedFile={practiceConfig?.filename ?? ""}
                onSelectConfig={selectPracticeConfig}
                onRefreshFiles={refreshConfigFiles}
              />
              {practiceConfig && (
                practiceConfig.mappings.length ? (
                  <Stack direction="row" spacing={1} alignItems="center" role="status">
                    <CheckCircleOutlineIcon color="success" fontSize="small" aria-hidden="true" />
                    <Typography variant="body2" color="text.secondary">
                      {practiceConfig.mappings.length} {practiceConfig.mappings.length === 1 ? "chord" : "chords"} found.
                    </Typography>
                  </Stack>
                ) : (
                  <Alert severity="warning" role="status">
                    No usable chords found.
                  </Alert>
                )
              )}
              <Button variant="contained" startIcon={<SportsEsportsIcon />} onClick={startPractice} disabled={!practiceConfig?.mappings.length || practiceConfig.layout !== layout} sx={{ alignSelf: "flex-start" }}>
                Start
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
