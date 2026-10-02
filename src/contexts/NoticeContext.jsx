import { createContext, useContext, useState } from "react";

const NoticeContext = createContext(null);

export function NoticeProvider({ children }) {
  const [notice, setNotice] = useState(null);
  return <NoticeContext.Provider value={{ notice, setNotice }}>{children}</NoticeContext.Provider>;
}

export function useNotice() {
  const value = useContext(NoticeContext);
  if (!value) throw new Error("useNotice must be used within NoticeProvider");
  return value;
}
