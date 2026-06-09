import React from "react";
import { createRoot } from "react-dom/client";

export function renderPage(element: React.ReactElement) {
  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("Root element not found");

  const rootStore = window as Window & typeof globalThis & {
    __ceoCampRoot?: ReturnType<typeof createRoot>;
  };
  rootStore.__ceoCampRoot ??= createRoot(rootElement);
  rootStore.__ceoCampRoot.render(element);
}
