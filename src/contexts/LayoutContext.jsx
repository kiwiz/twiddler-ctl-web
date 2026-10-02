import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { initLayouts, Layouts, listLayouts, normalizeStr } from "../lib/index.js";
import { useNotice } from "./NoticeContext.jsx";

const LayoutContext = createContext(null);

export function LayoutProvider({ children }) {
  const [layouts, setLayouts] = useState([]);
  const [layoutCatalog, setLayoutCatalog] = useState(null);
  const [layout, setLayout] = useState("");
  const [configuredLayoutState, setConfiguredLayoutState] = useState({ revision: 0, layout: "" });
  const { setNotice } = useNotice();
  const resetConfiguredLayout = useCallback((nextLayout) => {
    setConfiguredLayoutState((current) => ({ revision: current.revision + 1, layout: nextLayout }));
  }, []);

  useEffect(() => {
    let active = true;
    const publicRoot = new URL(import.meta.env.BASE_URL, window.location.href);
    Promise.all([initLayouts(publicRoot), Layouts.load(publicRoot)])
      .then(([, catalog]) => {
        if (!active) return;
        setLayoutCatalog(catalog);
        const availableLayouts = listLayouts();
        setLayouts(availableLayouts);
        const preferred = availableLayouts.find((name) => normalizeStr(name) === "qwerty");
        const initialLayout = normalizeStr(preferred ?? availableLayouts[0] ?? "");
        setLayout((current) => current || initialLayout);
        setConfiguredLayoutState((current) => ({ revision: current.revision + 1, layout: initialLayout }));
      })
      .catch((error) => {
        if (active) setNotice({ severity: "error", message: `Could not load keyboard layouts: ${error.message}` });
      });
    return () => { active = false; };
  }, [setNotice]);

  return (
    <LayoutContext.Provider value={{ layouts, layoutCatalog, layout, setLayout, configuredLayoutState, resetConfiguredLayout }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const value = useContext(LayoutContext);
  if (!value) throw new Error("useLayout must be used within LayoutProvider");
  return value;
}
