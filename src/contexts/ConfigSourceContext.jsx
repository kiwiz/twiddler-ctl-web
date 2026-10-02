import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ConfigSourceContext = createContext(null);

export function ConfigSourceProvider({ children }) {
  const hasDirectoryPicker = window.isSecureContext && typeof window.showDirectoryPicker === "function";
  const [loadedContext, setLoadedContext] = useState(null);
  const [configsHandle, setConfigsHandle] = useState(null);
  const [configFiles, setConfigFiles] = useState([]);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [sampleBundleLoaded, setSampleBundleLoaded] = useState(false);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  const value = useMemo(() => ({
    hasDirectoryPicker,
    isOnline,
    sampleBundleLoaded,
    setSampleBundleLoaded,
    loadedContext,
    setLoadedContext,
    configsHandle,
    setConfigsHandle,
    configFiles,
    setConfigFiles,
    hasConfigDirectory: Boolean(configsHandle),
  }), [hasDirectoryPicker, isOnline, sampleBundleLoaded, loadedContext, configsHandle, configFiles]);

  return <ConfigSourceContext.Provider value={value}>{children}</ConfigSourceContext.Provider>;
}

export function useConfigSource() {
  const value = useContext(ConfigSourceContext);
  if (!value) throw new Error("useConfigSource must be used within ConfigSourceProvider");
  return value;
}
