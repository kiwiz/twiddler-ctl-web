import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Divider,
  Grid,
  IconButton,
  Link,
  Paper,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import RefreshIcon from "@mui/icons-material/Refresh";
import SystemUpdateAltIcon from "@mui/icons-material/SystemUpdateAlt";
import UsbOutlinedIcon from "@mui/icons-material/UsbOutlined";
import { KeyboardLayoutSelect } from "../components/KeyboardLayoutSelect.jsx";
import { useConfigSource } from "../contexts/ConfigSourceContext.jsx";
import { useLayout } from "../contexts/LayoutContext.jsx";
import { useSync } from "../contexts/SyncContext.jsx";

function SyncSlotStatusIcon({ slot, status }) {
  const state = status?.state ?? "idle";
  const color = ({
    idle: "text.disabled",
    syncing: "primary.main",
    success: "success.main",
    error: "error.main",
  })[state];
  const icon = state === "syncing" ? <CircularProgress size={20} thickness={5} />
    : state === "success" ? <CheckCircleOutlineIcon fontSize="small" />
      : state === "error" ? <ErrorOutlineIcon fontSize="small" />
        : <RadioButtonUncheckedIcon fontSize="small" />;

  return (
    <Tooltip title={status?.message ?? "Not synced yet"}>
      <Box component="span" role="img" aria-label={`Slot ${slot}: ${status?.message ?? "Not synced yet"}`} sx={{ color, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </Box>
    </Tooltip>
  );
}

function formatCount(value) {
  return Number.isFinite(value) ? new Intl.NumberFormat().format(value) : "—";
}

function formatRuntime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  let remaining = Math.floor(seconds);
  const days = Math.floor(remaining / 86400);
  remaining %= 86400;
  const hours = Math.floor(remaining / 3600);
  remaining %= 3600;
  const minutes = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return [
    days ? `${days}d` : "",
    hours ? `${hours}h` : "",
    minutes ? `${minutes}m` : "",
    `${secs}s`,
  ].filter(Boolean).join(" ");
}

function formatCapability(value) {
  if (value === 0 || value === false) return "No";
  if (value === 1 || value === true) return "Yes";
  return value ?? "—";
}

const LATEST_FIRMWARE_VERSION = "3.11.5";

function isFirmwareOutdated(version) {
  if (typeof version !== "string") return false;
  const normalizedVersion = version.trim().replace(/^v/i, "");
  const versionParts = normalizedVersion.split(".");
  const latestParts = LATEST_FIRMWARE_VERSION.split(".");
  if (!versionParts.every((part) => /^\d+$/.test(part))) return false;

  for (let index = 0; index < Math.max(versionParts.length, latestParts.length); index += 1) {
    const devicePart = Number(versionParts[index] ?? 0);
    const latestPart = Number(latestParts[index] ?? 0);
    if (devicePart !== latestPart) return devicePart < latestPart;
  }
  return false;
}

function DeviceInfoValue({ label, content }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>{label}</Typography>
      <Typography component="div" variant="body2" sx={{ overflowWrap: "anywhere" }}>{content ?? "—"}</Typography>
    </Box>
  );
}

export function DevicePage({ page, showLoadScreen, handleOpenSlotConfig }) {
  const { hasDirectoryPicker, configFiles, hasConfigDirectory, isOnline, sampleBundleLoaded } = useConfigSource();
  const { layouts, layout, configuredLayoutState } = useLayout();
  const {
    driveHandle,
    canSyncConfigFiles,
    slotFilenames,
    slotSyncStatuses,
    syncing,
    loadConfigDirectory,
    loadSampleDirectory,
    hasDriveLog,
    decodedDriveLog,
    setDecodedDriveLog,
    decodingDriveLog,
    deviceInfo,
    deviceInfoError,
    loadingDeviceInfo,
    handlePickDrive,
    handleSync,
    refreshDriveLog,
    decodeDriveLog,
    downloadDecodedDriveLog,
    loadDeviceInfo,
    refreshConfiguredLayout,
    refreshSlotSyncStatuses,
    updateSlotFilename,
    handleLayoutChange,
  } = useSync();
  const [deviceLayout, setDeviceLayout] = useState(layout);

  const refreshAndDecodeDriveLog = useCallback(async (selectedLayout) => {
    setDecodedDriveLog(null);
    const exists = await refreshDriveLog();
    if (!exists || !selectedLayout) return false;
    return decodeDriveLog(selectedLayout);
  }, [decodeDriveLog, refreshDriveLog, setDecodedDriveLog]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) setDeviceLayout(configuredLayoutState.layout);
    });
    return () => { active = false; };
  }, [configuredLayoutState]);

  useEffect(() => {
    if (!driveHandle || !deviceLayout) return;
    refreshAndDecodeDriveLog(deviceLayout);
  }, [driveHandle, deviceLayout, refreshAndDecodeDriveLog]);

  useEffect(() => {
    if (driveHandle) loadDeviceInfo();
  }, [driveHandle, loadDeviceInfo]);

  const buttonPresses = deviceInfo?.stats?.button_presses && typeof deviceInfo.stats.button_presses === "object"
    ? Object.entries(deviceInfo.stats.button_presses)
    : [];
  const totalButtonPresses = buttonPresses.reduce((total, [, count]) => total + (Number.isFinite(count) ? count : 0), 0);

  const refreshDevicePage = async () => {
    const configuredLayout = await refreshConfiguredLayout();
    const logRefresh = configuredLayout === deviceLayout
      ? refreshAndDecodeDriveLog(configuredLayout)
      : Promise.resolve();
    setDeviceLayout(configuredLayout);
    await Promise.all([
      logRefresh,
      loadDeviceInfo(),
      refreshSlotSyncStatuses(configuredLayout),
    ]);
  };

  const handleDeviceLayoutChange = (value) => {
    setDeviceLayout(value);
    setDecodedDriveLog(null);
    handleLayoutChange(value);
    refreshSlotSyncStatuses(value);
  };

  return (
    <Box role="tabpanel" id="app-panel-0" aria-labelledby="app-tab-0" hidden={showLoadScreen || page !== 0}>
      <Stack spacing={2}>
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: 1 }}>
                <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                  <Typography variant="h5" component="h2" sx={{ minWidth: 0 }}>
                    {deviceInfo?.name || "Twiddler"}
                  </Typography>
                  {!driveHandle && (
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                      Connect a Twiddler to access device tools and synchronize configs.
                    </Typography>
                  )}
                </Stack>
                {driveHandle && (
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Tooltip title="Refresh data">
                      <span>
                        <IconButton
                          size="small"
                          aria-label="Refresh device data"
                          onClick={refreshDevicePage}
                          disabled={loadingDeviceInfo || syncing}
                        >
                          <RefreshIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handlePickDrive}
                      disabled={!hasDirectoryPicker}
                    >
                      Change drive
                    </Button>
                  </Stack>
                )}
              </Box>
              {!driveHandle && (
                <Button
                  variant="contained"
                  size="large"
                  onClick={handlePickDrive}
                  disabled={!hasDirectoryPicker}
                  sx={{ width: "100%", minHeight: 140, flexDirection: "column", gap: 1.5 }}
                >
                  <UsbOutlinedIcon sx={{ fontSize: 48 }} />
                  Connect drive
                </Button>
              )}
              {driveHandle && (
                <>
                  <Stack spacing={2}>
                    {deviceInfoError && <Alert severity="warning" role="status">{deviceInfoError}</Alert>}
                    {deviceInfo && (
                      <>
                        <Grid container spacing={2}>
                          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                            <DeviceInfoValue
                              label="Firmware"
                              content={(
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                  <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>{deviceInfo.firmware ?? "—"}</Typography>
                                  {isFirmwareOutdated(deviceInfo.firmware) && (
                                    <Tooltip title="New firmware available">
                                      <IconButton
                                        component="a"
                                        href="https://www.mytwiddler.com/doc/doku.php?id=t4_firmwareupgrade"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label="Firmware upgrade instructions"
                                        size="small"
                                        sx={{ color: "warning.main", p: 0.25 }}
                                      >
                                        <SystemUpdateAltIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                </Stack>
                              )}
                            />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                            <DeviceInfoValue label="Device" content={deviceInfo.device} />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                            <DeviceInfoValue label="Address" content={deviceInfo.address} />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                            <DeviceInfoValue label="Haptic" content={formatCapability(deviceInfo.haptic)} />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                            <DeviceInfoValue label="IMU" content={formatCapability(deviceInfo.imu)} />
                          </Grid>
                        </Grid>
                        {deviceInfo.stats && (
                          <Accordion
                            disableGutters
                            elevation={0}
                            sx={{ border: 1, borderColor: "divider", borderRadius: 1, "&:before": { display: "none" } }}
                          >
                            <AccordionSummary
                              expandIcon={<span aria-hidden="true">⌄</span>}
                              aria-controls="device-stats-content"
                              id="device-stats-header"
                            >
                              <Typography variant="subtitle1" component="h4">Statistics</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                              <Stack spacing={1}>
                                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                  <Chip variant="outlined" label={`Boots: ${formatCount(deviceInfo.stats.boot_count)}`} />
                                  <Chip variant="outlined" label={`Runtime: ${formatRuntime(deviceInfo.stats.runtime_sec)}`} />
                                  <Chip variant="outlined" label={`Button presses: ${formatCount(totalButtonPresses)}`} />
                                </Stack>
                                {buttonPresses.length > 0 && (
                                  <TableContainer component={Paper} variant="outlined">
                                    <Table size="small" aria-label="Button press counts">
                                      <TableHead>
                                        <TableRow>
                                          <TableCell>Button</TableCell>
                                          <TableCell align="right">Presses</TableCell>
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        {buttonPresses.map(([button, count]) => (
                                          <TableRow key={button}>
                                            <TableCell>{button}</TableCell>
                                            <TableCell align="right">{formatCount(count)}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </TableContainer>
                                )}
                              </Stack>
                            </AccordionDetails>
                          </Accordion>
                        )}
                      </>
                    )}
                    {loadingDeviceInfo && !deviceInfo && <Typography variant="body2" sx={{ color: "text.secondary" }}>Reading INFO.TXT…</Typography>}
                  </Stack>
                  <Divider />
                  <KeyboardLayoutSelect
                    id="device-layout"
                    layouts={layouts}
                    layout={deviceLayout}
                    onChange={handleDeviceLayoutChange}
                  />
                </>
              )}
            </Stack>
          </CardContent>
        </Card>

        {driveHandle && (
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Stack spacing={0.5}>
                  <Typography variant="h6" component="h3">Config sync</Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Manage the configs on the device.
                  </Typography>
                </Stack>
                {hasConfigDirectory ? (
                  <>
                    {!canSyncConfigFiles && (
                      <Alert severity="warning">
                        Chrome on Windows does not permit access to .CFG files. See{" "}
                        <Link href="https://issues.chromium.org/issues/380857453" target="_blank" rel="noopener noreferrer">
                          here
                        </Link>{" "}for details.
                      </Alert>
                    )}
                    <Stack spacing={1.5}>
                      {[1, 2, 3].map((slot) => (
                        <Box className="slot-row" key={slot}>
                          <SyncSlotStatusIcon slot={slot} status={slotSyncStatuses[slot]} />
                          <TextField
                            select
                            label={`${slot}.CFG source`}
                            value={slotFilenames[slot]}
                            onChange={(event) => updateSlotFilename(slot, event.target.value, deviceLayout)}
                            fullWidth
                            size="small"
                          >
                            {[...new Set([...(configFiles ?? []), slotFilenames[slot]])].filter(Boolean).map((filename) => (
                              <MenuItem key={filename} value={filename}>{filename}</MenuItem>
                            ))}
                          </TextField>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => handleOpenSlotConfig(slotFilenames[slot], deviceLayout)}
                            disabled={!slotFilenames[slot].trim()}
                          >
                            Edit
                          </Button>
                        </Box>
                      ))}
                    </Stack>
                    <Button variant="contained" onClick={() => handleSync(deviceLayout)} disabled={syncing || !canSyncConfigFiles || !layouts.length || !hasDirectoryPicker}>
                      {syncing ? "Syncing…" : "Sync to Twiddler"}
                    </Button>
                  </>
                ) : (
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap flexWrap="wrap">
                    <Button variant="outlined" onClick={loadConfigDirectory} disabled={!hasDirectoryPicker || !layouts.length}>
                      Load config directory
                    </Button>
                    <Tooltip title={!isOnline && !sampleBundleLoaded ? "Not available offline" : ""}>
                      <span tabIndex={!isOnline && !sampleBundleLoaded ? 0 : undefined}>
                        <Button
                          variant="outlined"
                          onClick={loadSampleDirectory}
                          disabled={!layouts.length || (!isOnline && !sampleBundleLoaded)}
                        >
                          Use samples
                        </Button>
                      </span>
                    </Tooltip>
                  </Stack>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}

        {driveHandle && (
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
                    Decode the Twiddler .log file on the device.
                  </Typography>
                </Stack>
                {!hasDriveLog && (
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    No TWIDDLER.LOG found on this drive.
                  </Typography>
                )}
                {hasDriveLog && decodingDriveLog && (
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>Decoding TWIDDLER.LOG…</Typography>
                )}
                {decodedDriveLog !== null && (
                  <>
                    <TextField
                      multiline
                      minRows={5}
                      maxRows={14}
                      fullWidth
                      label="Log text"
                      value={decodedDriveLog}
                      onChange={(event) => setDecodedDriveLog(event.target.value)}
                    />
                    <Button variant="contained" onClick={downloadDecodedDriveLog} sx={{ alignSelf: "flex-start" }}>
                      Download
                    </Button>
                  </>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}

      </Stack>
    </Box>
  );
}
