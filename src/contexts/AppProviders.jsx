import React from "react";
import { ConfigSourceProvider } from "./ConfigSourceContext.jsx";
import { LayoutProvider } from "./LayoutContext.jsx";
import { NoticeProvider } from "./NoticeContext.jsx";
import { PracticeProvider } from "./PracticeContext.jsx";
import { SyncProvider } from "./SyncContext.jsx";
import { EditorProvider } from "./EditorContext.jsx";

export function AppProviders({ children }) {
  return (
    <NoticeProvider>
      <LayoutProvider>
        <ConfigSourceProvider>
          <PracticeProvider>
            <EditorProvider>
              <SyncProvider>{children}</SyncProvider>
            </EditorProvider>
          </PracticeProvider>
        </ConfigSourceProvider>
      </LayoutProvider>
    </NoticeProvider>
  );
}
