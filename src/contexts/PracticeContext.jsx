import { createContext, useContext, useState } from "react";
import { Config7, detectFormat, TextConfig } from "../lib/index.js";
import { getFileHandleByPath } from "../pages/syncUtils.js";
import { choosePracticeMapping, extractPracticeMappings } from "../pages/practiceUtils.js";
import { useConfigSource } from "./ConfigSourceContext.jsx";
import { useLayout } from "./LayoutContext.jsx";
import { useNotice } from "./NoticeContext.jsx";

const PracticeContext = createContext(null);

export function PracticeProvider({ children }) {
  const { layout, layoutCatalog } = useLayout();
  const { configsHandle } = useConfigSource();
  const { setNotice } = useNotice();
  const [practiceConfig, setPracticeConfig] = useState(null);
  const [practiceSession, setPracticeSession] = useState(null);

  const clearPracticeConfig = () => {
    setPracticeConfig(null);
    setPracticeSession(null);
  };

  const loadPracticeConfig = async (fileSource, selectedLayout = layout) => {
    try {
      const file = typeof fileSource.getFile === "function" ? await fileSource.getFile() : fileSource;
      const config = detectFormat(fileSource.name) === "binary"
        ? Config7.read(new Uint8Array(await file.arrayBuffer()), selectedLayout)
        : TextConfig.read(await file.text(), selectedLayout);
      const mappings = extractPracticeMappings(config, selectedLayout, layoutCatalog);
      setPracticeConfig({ filename: fileSource.name, mappings, layout: selectedLayout });
      setPracticeSession(null);
      return true;
    } catch (error) {
      setNotice({ severity: "error", message: `Could not parse config: ${error.message}` });
      return false;
    }
  };

  const selectPracticeConfig = async (filename, selectedLayout = layout) => {
    try {
      if (!configsHandle) return false;
      const fileSource = await getFileHandleByPath(configsHandle, filename);
      return await loadPracticeConfig(fileSource, selectedLayout);
    } catch (error) {
      setNotice({ severity: "error", message: `Could not open ${filename}: ${error.message}` });
    }
  };

  const startPractice = () => {
    if (!practiceConfig?.mappings.length || practiceConfig.layout !== layout) return;
    setPracticeSession({
      active: true,
      endsAt: Date.now() + 60_000,
      remaining: 60,
      correct: 0,
      mistakes: 0,
      mapping: choosePracticeMapping(practiceConfig.mappings),
      wrongForCurrent: 0,
      revealChord: false,
    });
  };

  const value = {
    practiceConfig,
    practiceSession,
    setPracticeSession,
    clearPracticeConfig,
    loadPracticeConfig,
    selectPracticeConfig,
    startPractice,
  };
  return <PracticeContext.Provider value={value}>{children}</PracticeContext.Provider>;
}

export function usePractice() {
  const value = useContext(PracticeContext);
  if (!value) throw new Error("usePractice must be used within PracticeProvider");
  return value;
}
