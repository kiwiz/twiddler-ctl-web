import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@mui/material";
import { App, theme } from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <ThemeProvider
    theme={theme}
    defaultMode="system"
    modeStorageKey="theme-mode"
    colorSchemeStorageKey="theme-color-scheme"
  >
    <App />
  </ThemeProvider>,
);
