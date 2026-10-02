import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useColorScheme } from "@mui/material";
import { EditorView, basicSetup } from "codemirror";
import { Compartment, EditorState } from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as highlightTags } from "@lezer/highlight";
import { Config7, detectFormat, makeConfig, TextConfig } from "../lib/index.js";
import { twiddlerConfigLanguage } from "../editor/codemirror-lang.js";
import { getFileHandleByPath } from "../pages/syncUtils.js";
import { useConfigSource } from "./ConfigSourceContext.jsx";
import { useLayout } from "./LayoutContext.jsx";
import { useNotice } from "./NoticeContext.jsx";
import { usePractice } from "./PracticeContext.jsx";

const EditorContext = createContext(null);
const EMPTY_EDITOR_CONFIG = TextConfig.write(makeConfig(), "qwerty");

function createEditorTheme(dark) {
  const colors = dark
    ? { text: "#e6edf3", surface: "#191c22", gutter: "#191c22", border: "#343a46", muted: "#8b949e", active: "#252a33", selection: "#264f78", cursor: "#e6edf3" }
    : { text: "#24292f", surface: "#ffffff", gutter: "#f6f8fa", border: "#d0d7de", muted: "#57606a", active: "#f6f8fa", selection: "#add6ff", cursor: "#24292f" };
  return EditorView.theme({
    "&": { color: colors.text, backgroundColor: colors.surface },
    ".cm-content": { caretColor: colors.cursor },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: colors.cursor },
    ".cm-gutters": { backgroundColor: colors.gutter, color: colors.muted, borderRightColor: colors.border },
    ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: colors.active },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": { backgroundColor: colors.selection },
  }, { dark });
}

function createEditorExtensions(dark) {
  const t = highlightTags;
  const highlight = HighlightStyle.define(dark
    ? [
      { tag: t.comment, color: "#8b949e", fontStyle: "italic" },
      { tag: t.squareBracket, color: "#c9a0ff" },
      { tag: t.keyword, color: "#ff9d5c" },
      { tag: t.propertyName, color: "#79c0ff" },
      { tag: t.variableName, color: "#7ee787" },
      { tag: t.operator, color: "#e6edf3" },
      { tag: t.punctuation, color: "#e6edf3" },
      { tag: t.number, color: "#ffa657" },
      { tag: t.atom, color: "#d2a8ff" },
      { tag: t.string, color: "#a5d6ff" },
    ]
    : [
      { tag: t.comment, color: "#68707e", fontStyle: "italic" },
      { tag: t.squareBracket, color: "#8250df" },
      { tag: t.keyword, color: "#bc4c00" },
      { tag: t.propertyName, color: "#0550ae" },
      { tag: t.variableName, color: "#116329" },
      { tag: t.operator, color: "#57606a" },
      { tag: t.punctuation, color: "#57606a" },
      { tag: t.number, color: "#953800" },
      { tag: t.atom, color: "#8250df" },
      { tag: t.string, color: "#0a3069" },
    ]);
  return [createEditorTheme(dark), twiddlerConfigLanguage, syntaxHighlighting(highlight)];
}

export function EditorProvider({ children }) {
  const { mode, systemMode } = useColorScheme();
  const colorScheme = mode === "system" ? systemMode : mode;
  const { layout } = useLayout();
  const {
    setLoadedContext,
    configsHandle,
    setConfigsHandle,
    setConfigFiles,
  } = useConfigSource();
  const { loadPracticeConfig, clearPracticeConfig } = usePractice();
  const { setNotice } = useNotice();
  const editorContainerRef = useRef(null);
  const editorViewRef = useRef(null);
  const editorBaselineRef = useRef(EMPTY_EDITOR_CONFIG);
  const editorThemeCompartmentRef = useRef(new Compartment());
  const [editorFileHandle, setEditorFileHandle] = useState(null);
  const [editorFileName, setEditorFileName] = useState("");
  const [editorOpenedFromConfigs, setEditorOpenedFromConfigs] = useState(false);
  const [editorIsNativeConfig, setEditorIsNativeConfig] = useState(false);
  const [editorLayout, setEditorLayout] = useState("");
  const [saving, setSaving] = useState(false);
  const [editorDirty, setEditorDirty] = useState(false);

  const confirmSourceChange = (sourceName) => {
    const currentText = editorViewRef.current?.state.doc.toString();
    if (currentText === undefined || currentText === editorBaselineRef.current) return true;
    return window.confirm(`You have unsaved changes. Loading ${sourceName} will discard them. Continue?`);
  };

  useEffect(() => {
    const editorView = new EditorView({
      state: EditorState.create({
        doc: EMPTY_EDITOR_CONFIG,
        extensions: [
          basicSetup,
          editorThemeCompartmentRef.current.of(createEditorExtensions(false)),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) setEditorDirty(update.state.doc.toString() !== editorBaselineRef.current);
          }),
        ],
      }),
      parent: editorContainerRef.current,
    });
    editorViewRef.current = editorView;
    editorBaselineRef.current = EMPTY_EDITOR_CONFIG;
    return () => {
      editorView.destroy();
      editorViewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const editorView = editorViewRef.current;
    if (!editorView) return;
    editorView.dispatch({
      effects: editorThemeCompartmentRef.current.reconfigure(createEditorExtensions(colorScheme === "dark")),
    });
  }, [colorScheme]);

  const openFile = async (fileSource, openedFromConfigs = false, selectedLayout = layout) => {
    try {
      if (!confirmSourceChange(fileSource.name)) return false;
      const file = typeof fileSource.getFile === "function" ? await fileSource.getFile() : fileSource;
      const nativeConfig = detectFormat(fileSource.name) === "binary";
      const text = nativeConfig
        ? TextConfig.write(Config7.read(new Uint8Array(await file.arrayBuffer()), selectedLayout), selectedLayout)
        : await file.text();
      const view = editorViewRef.current;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
      editorBaselineRef.current = text;
      setEditorDirty(false);
      setEditorFileHandle(typeof fileSource.createWritable === "function" ? fileSource : null);
      setEditorFileName(fileSource.name);
      setEditorOpenedFromConfigs(openedFromConfigs);
      if (!openedFromConfigs) {
        setLoadedContext({ kind: "file", name: fileSource.name });
        clearPracticeConfig();
      }
      setEditorIsNativeConfig(nativeConfig);
      setEditorLayout(selectedLayout);
      return true;
    } catch (error) {
      setNotice({ severity: "error", message: `Could not open config: ${error.message}` });
      return false;
    }
  };

  const openExternalFile = async (file, selectedLayout = layout) => {
    if (!(await openFile(file, false, selectedLayout))) return false;
    setConfigsHandle(null);
    setConfigFiles([]);
    await loadPracticeConfig(file);
    return true;
  };

  const resetEditor = () => {
    const view = editorViewRef.current;
    editorBaselineRef.current = EMPTY_EDITOR_CONFIG;
    if (view) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: EMPTY_EDITOR_CONFIG } });
    }
    setEditorDirty(false);
    setEditorFileHandle(null);
    setEditorFileName("");
    setEditorOpenedFromConfigs(false);
    setEditorIsNativeConfig(false);
    setEditorLayout("");
  };

  const openConfigFromDirectory = async (filename, selectedLayout = layout) => {
    if (!configsHandle) return false;
    try {
      const fileHandle = await getFileHandleByPath(configsHandle, filename);
      return await openFile(fileHandle, true, selectedLayout);
    } catch (error) {
      setNotice({ severity: "error", message: `Could not open ${filename}: ${error.message}` });
      return false;
    }
  };

  const saveConfig = async () => {
    const editorView = editorViewRef.current;
    if (!editorFileHandle || !editorOpenedFromConfigs || !editorView) return;
    setSaving(true);
    try {
      const text = editorView.state.doc.toString();
      const contents = editorIsNativeConfig
        ? Config7.write(TextConfig.read(text, editorLayout), editorLayout)
        : text;
      if (editorFileHandle.queryPermission) {
        let permission = await editorFileHandle.queryPermission({ mode: "readwrite" });
        if (permission !== "granted" && editorFileHandle.requestPermission) {
          permission = await editorFileHandle.requestPermission({ mode: "readwrite" });
        }
        if (permission !== "granted") throw new Error("Write permission was not granted");
      }
      const writable = await editorFileHandle.createWritable();
      await writable.write(contents);
      await writable.close();
      editorBaselineRef.current = text;
      setEditorDirty(false);
    } catch (error) {
      setNotice({ severity: "error", message: `Could not save config: ${error.message}` });
    } finally {
      setSaving(false);
    }
  };

  const downloadConfig = (format) => {
    const editorView = editorViewRef.current;
    if (!editorView) return;
    try {
      const text = editorView.state.doc.toString();
      const isNativeConfig = format === "cfg";
      const contents = isNativeConfig
        ? Config7.write(TextConfig.read(text, editorLayout || layout), editorLayout || layout)
        : text;
      const mimeType = isNativeConfig ? "application/octet-stream" : "text/plain;charset=utf-8";
      const blob = new Blob([contents], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const baseName = (editorFileName || "twiddler").replace(/\.(?:tctl\.txt|txt|cfg)$/i, "") || "twiddler";
      link.href = url;
      link.download = `${baseName}.${format}`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      editorBaselineRef.current = text;
      setEditorDirty(false);
    } catch (error) {
      setNotice({ severity: "error", message: `Could not download config: ${error.message}` });
    }
  };

  const requestMeasure = () => editorViewRef.current?.requestMeasure();

  const value = {
    editorContainerRef,
    editorFileHandle,
    editorFileName,
    editorOpenedFromConfigs,
    editorIsNativeConfig,
    editorLayout,
    setEditorLayout,
    editorDirty,
    saving,
    confirmSourceChange,
    openExternalFile,
    resetEditor,
    openConfigFromDirectory,
    saveConfig,
    downloadConfig,
    requestMeasure,
  };

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditor() {
  const value = useContext(EditorContext);
  if (!value) throw new Error("useEditor must be used within EditorProvider");
  return value;
}
