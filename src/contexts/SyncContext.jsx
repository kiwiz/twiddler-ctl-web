import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { BinaryLog, layoutExists, normalizeStr, pickTwiddlerDrive } from "../lib/index.js";
import {
  directoryPickerHelp,
  checkUppercaseSlotConfigs,
  getSyncConfigFileHandle,
  listConfigFiles,
  parseSyncConfig,
  persistSyncConfig,
  syncUppercaseSlotConfigs,
  SYNC_CONFIG_FILENAME,
  validateConfigsDirectory,
  validateTwiddlerDrive,
} from "../pages/syncUtils.js";
import { useConfigSource } from "./ConfigSourceContext.jsx";
import { useLayout } from "./LayoutContext.jsx";
import { useNotice } from "./NoticeContext.jsx";
import { usePractice } from "./PracticeContext.jsx";
import { useEditor } from "./EditorContext.jsx";
import { createSampleConfigDirectoryHandle, preloadSampleBundle } from "../samples/samples.js";

const SyncContext = createContext(null);
const DRIVE_LOG_FILENAME = "TWIDDLER.LOG";

function makeIdleSyncStatuses(message = "Not synced yet") {
  return {
    1: { state: "idle", message },
    2: { state: "idle", message },
    3: { state: "idle", message },
  };
}

export function SyncProvider({ children }) {
  const { layout, setLayout, configuredLayoutState, resetConfiguredLayout } = useLayout();
  const { setNotice } = useNotice();
  const {
    hasDirectoryPicker,
    isOnline,
    sampleBundleLoaded,
    setSampleBundleLoaded,
    setLoadedContext,
    configsHandle,
    setConfigsHandle,
    setConfigFiles,
  } = useConfigSource();
  const { clearPracticeConfig } = usePractice();
  const { confirmSourceChange, resetEditor } = useEditor();
  const [driveHandle, setDriveHandle] = useState(null);
  const [slotFilenames, setSlotFilenames] = useState({
    1: "default.tctl.txt",
    2: "default.tctl.txt",
    3: "default.tctl.txt",
  });
  const [slotSyncStatuses, setSlotSyncStatuses] = useState(() => makeIdleSyncStatuses());
  const [syncing, setSyncing] = useState(false);
  const [hasDriveLog, setHasDriveLog] = useState(false);
  const [decodedDriveLog, setDecodedDriveLog] = useState(null);
  const [decodingDriveLog, setDecodingDriveLog] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [deviceInfoError, setDeviceInfoError] = useState("");
  const [loadingDeviceInfo, setLoadingDeviceInfo] = useState(false);
  const configWriteQueueRef = useRef(Promise.resolve());

  const refreshSlotSyncStatuses = useCallback(async (selectedLayout, isCurrent = () => true) => {
    const sourceDirectoryHandle = configsHandle;
    if (!driveHandle || !sourceDirectoryHandle || !selectedLayout || syncing) {
      return;
    }

    setSlotSyncStatuses({
      1: { state: "syncing", message: "Checking…" },
      2: { state: "syncing", message: "Checking…" },
      3: { state: "syncing", message: "Checking…" },
    });
    try {
      const statuses = await checkUppercaseSlotConfigs(driveHandle, sourceDirectoryHandle, slotFilenames, selectedLayout);
      if (isCurrent()) setSlotSyncStatuses(statuses);
    } catch (error) {
      if (isCurrent()) {
        setSlotSyncStatuses({
          1: { state: "error", message: `Check failed: ${error.message}` },
          2: { state: "error", message: `Check failed: ${error.message}` },
          3: { state: "error", message: `Check failed: ${error.message}` },
        });
      }
    }
  }, [driveHandle, configsHandle, syncing, slotFilenames]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) refreshSlotSyncStatuses(configuredLayoutState.layout, () => active);
    });
    return () => { active = false; };
  }, [configuredLayoutState, refreshSlotSyncStatuses]);

  const queueSyncConfig = (directoryHandle, selectedLayout, filenames) => {
    if (directoryHandle?.readOnly) return Promise.resolve();
    const queuedWrite = configWriteQueueRef.current
      .catch(() => {})
      .then(() => persistSyncConfig(directoryHandle, selectedLayout, filenames));
    configWriteQueueRef.current = queuedWrite;
    queuedWrite.catch((error) => {
      setNotice({ severity: "error", message: `Could not save ${SYNC_CONFIG_FILENAME}: ${error.message}` });
    });
    return queuedWrite;
  };

  const loadConfigsHandle = async (handle) => {
    await validateConfigsDirectory(handle, driveHandle);
    const filenames = await listConfigFiles(handle);
    filenames.sort((a, b) => a.localeCompare(b));
    let savedConfig = null;
    let savedConfigFilename = SYNC_CONFIG_FILENAME;
    const configHandle = await getSyncConfigFileHandle(handle);
    if (configHandle) {
      savedConfigFilename = configHandle.name;
      savedConfig = parseSyncConfig(await (await configHandle.getFile()).text());
    }
    if (!confirmSourceChange(handle.name)) return false;

    resetEditor();
    let configWarning = null;
    let configuredLayout = layout;
    if (savedConfig?.layout) {
      const savedLayout = normalizeStr(savedConfig.layout);
      if (layoutExists(savedLayout)) {
        configuredLayout = savedLayout;
        setLayout(savedLayout);
      } else {
        configWarning = { severity: "warning", message: `${savedConfigFilename} names an unknown layout: ${savedConfig.layout}` };
      }
    }
    if (savedConfig?.configs) {
      setSlotFilenames((current) => ({
        1: savedConfig.configs["1"]?.replaceAll("\\", "/") || current[1],
        2: savedConfig.configs["2"]?.replaceAll("\\", "/") || current[2],
        3: savedConfig.configs["3"]?.replaceAll("\\", "/") || current[3],
      }));
    }
    setConfigsHandle(handle);
    setConfigFiles(filenames);
    setSlotSyncStatuses(makeIdleSyncStatuses());
    clearPracticeConfig();
    setLoadedContext({ kind: "directory", name: handle.name });
    resetConfiguredLayout(configuredLayout);
    if (configWarning) setNotice(configWarning);
    return true;
  };

  const loadConfigDirectory = async () => {
    if (!hasDirectoryPicker) {
      setNotice({ severity: "warning", message: directoryPickerHelp() });
      return false;
    }
    try {
      const handle = await window.showDirectoryPicker({ id: "twiddler-configs", mode: "readwrite" });
      return await loadConfigsHandle(handle);
    } catch (error) {
      if (error.name !== "AbortError") setNotice({ severity: "error", message: error.message });
      return false;
    }
  };

  const loadSampleDirectory = async () => {
    if (!isOnline && !sampleBundleLoaded) return false;
    const handle = createSampleConfigDirectoryHandle();
    try {
      await preloadSampleBundle();
      setSampleBundleLoaded(true);
      return await loadConfigsHandle(handle);
    } catch (error) {
      setNotice({ severity: "error", message: `Could not load config source: ${error.message}` });
      return false;
    }
  };

  const refreshConfigFiles = async () => {
    if (!configsHandle) return false;
    try {
      const filenames = await listConfigFiles(configsHandle);
      filenames.sort((a, b) => a.localeCompare(b));
      setConfigFiles(filenames);
      return true;
    } catch (error) {
      setNotice({ severity: "error", message: `Could not refresh config files: ${error.message}` });
      return false;
    }
  };

  const refreshConfiguredLayout = async () => {
    let configuredLayout = layout;
    let syncConfigFilename = SYNC_CONFIG_FILENAME;
    if (configsHandle) {
      try {
        await configWriteQueueRef.current.catch(() => {});
        const configHandle = await getSyncConfigFileHandle(configsHandle);
        if (configHandle) syncConfigFilename = configHandle.name;
        const savedConfig = configHandle
          ? parseSyncConfig(await (await configHandle.getFile()).text())
          : null;
        if (savedConfig?.layout) {
          const savedLayout = normalizeStr(savedConfig.layout);
          if (layoutExists(savedLayout)) {
            configuredLayout = savedLayout;
            setLayout(savedLayout);
          }
        }
      } catch (error) {
        if (error.name !== "NotFoundError") {
          setNotice({ severity: "warning", message: `Could not refresh ${syncConfigFilename} layout: ${error.message}` });
        }
      }
    }
    setLayout(configuredLayout);
    resetConfiguredLayout(configuredLayout);
    return configuredLayout;
  };

  const handlePickDrive = async () => {
    if (!hasDirectoryPicker) {
      setNotice({ severity: "warning", message: directoryPickerHelp() });
      return false;
    }
    try {
      const handle = await pickTwiddlerDrive();
      await validateTwiddlerDrive(handle);
      await validateConfigsDirectory(configsHandle, handle);
      setDriveHandle(handle);
      setSlotSyncStatuses(makeIdleSyncStatuses());
      setHasDriveLog(false);
      setDecodedDriveLog(null);
      setDeviceInfo(null);
      setDeviceInfoError("");
      resetConfiguredLayout(layout);
      return true;
    } catch (error) {
      if (error.name !== "AbortError") {
        setNotice({ severity: "error", message: error.message });
      }
      return false;
    }
  };

  const refreshDriveLog = useCallback(async () => {
    if (!driveHandle) return false;
    try {
      let exists = true;
      try {
        await driveHandle.getFileHandle(DRIVE_LOG_FILENAME);
      } catch (error) {
        if (error.name !== "NotFoundError") throw error;
        exists = false;
      }
      setHasDriveLog(exists);
      return exists;
    } catch (error) {
      setNotice({ severity: "error", message: `Could not check for ${DRIVE_LOG_FILENAME}: ${error.message}` });
      return false;
    }
  }, [driveHandle, setNotice]);

  const loadDeviceInfo = useCallback(async () => {
    if (!driveHandle) return false;
    setLoadingDeviceInfo(true);
    setDeviceInfoError("");
    try {
      const infoHandle = await driveHandle.getFileHandle("INFO.TXT");
      const contents = await (await infoHandle.getFile()).text();
      const info = JSON.parse(contents.replace(/^\uFEFF/, ""));
      if (!info || typeof info !== "object" || Array.isArray(info)) {
        throw new Error("INFO.TXT must contain a JSON object");
      }
      setDeviceInfo(info);
      return true;
    } catch (error) {
      setDeviceInfo(null);
      setDeviceInfoError(error.name === "NotFoundError"
        ? "INFO.TXT was not found on this drive."
        : `Could not read INFO.TXT: ${error.message}`);
      return false;
    } finally {
      setLoadingDeviceInfo(false);
    }
  }, [driveHandle]);

  const decodeDriveLog = useCallback(async (selectedLayout) => {
    if (!driveHandle) return false;
    setDecodingDriveLog(true);
    try {
      const fileHandle = await driveHandle.getFileHandle(DRIVE_LOG_FILENAME);
      const file = await fileHandle.getFile();
      const text = BinaryLog.read(new Uint8Array(await file.arrayBuffer()), selectedLayout);
      setDecodedDriveLog(text);
      return true;
    } catch (error) {
      setNotice({ severity: "error", message: `Could not decode ${DRIVE_LOG_FILENAME}: ${error.message}` });
      return false;
    } finally {
      setDecodingDriveLog(false);
    }
  }, [driveHandle, setNotice]);

  const downloadDecodedDriveLog = () => {
    if (decodedDriveLog === null) return;
    const blob = new Blob([decodedDriveLog], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const basename = DRIVE_LOG_FILENAME.replace(/\.[^.]+$/, "") || "twiddler-log";
    link.href = url;
    link.download = `${basename}.txt`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const handleSync = async (selectedLayout = layout) => {
    const sourceDirectoryHandle = configsHandle;
    if (!sourceDirectoryHandle) {
      setNotice({ severity: "warning", message: "Select the configs folder first." });
      return;
    }
    if (!hasDirectoryPicker) {
      setNotice({ severity: "warning", message: directoryPickerHelp() });
      return;
    }
    if (!layoutExists(selectedLayout)) {
      setNotice({ severity: "error", message: `Unknown layout: ${selectedLayout}` });
      return;
    }

    if (!driveHandle) {
      setNotice({ severity: "warning", message: "Connect a Twiddler drive before syncing." });
      return;
    }

    setSyncing(true);
    try {
      await validateTwiddlerDrive(driveHandle);
      if (configsHandle) await validateConfigsDirectory(configsHandle, driveHandle);
      await configWriteQueueRef.current.catch(() => {});
      if (configsHandle && !configsHandle.readOnly) await persistSyncConfig(configsHandle, selectedLayout, slotFilenames);
      await syncUppercaseSlotConfigs(driveHandle, sourceDirectoryHandle, slotFilenames, selectedLayout, (slot, status) => {
        setSlotSyncStatuses((current) => ({ ...current, [slot]: status }));
      });
    } catch (error) {
      setNotice({
        severity: error.name === "AbortError" ? "warning" : "error",
        message: error.name === "AbortError" ? "Drive selection cancelled; sync was not run." : `Sync failed: ${error.message}`,
      });
    } finally {
      setSyncing(false);
    }
  };

  const updateSlotFilename = (slot, value, selectedLayout = layout) => {
    const next = { ...slotFilenames, [slot]: value };
    setSlotFilenames(next);
    setSlotSyncStatuses((current) => ({ ...current, [slot]: { state: "idle", message: "Needs sync" } }));
    if (configsHandle) queueSyncConfig(configsHandle, selectedLayout, next);
  };

  const handleLayoutChange = (value) => {
    setLayout(value);
    setSlotSyncStatuses(makeIdleSyncStatuses("Layout changed; sync to update"));
    if (configsHandle) queueSyncConfig(configsHandle, value, slotFilenames);
  };

  const value = {
    driveHandle,
    slotFilenames,
    slotSyncStatuses,
    syncing,
    loadConfigDirectory,
    loadSampleDirectory,
    refreshConfigFiles,
    refreshConfiguredLayout,
    handlePickDrive,
    hasDriveLog,
    decodedDriveLog,
    setDecodedDriveLog,
    decodingDriveLog,
    deviceInfo,
    deviceInfoError,
    loadingDeviceInfo,
    refreshDriveLog,
    loadDeviceInfo,
    refreshSlotSyncStatuses,
    decodeDriveLog,
    downloadDecodedDriveLog,
    handleSync,
    updateSlotFilename,
    handleLayoutChange,
  };
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const value = useContext(SyncContext);
  if (!value) throw new Error("useSync must be used within SyncProvider");
  return value;
}
