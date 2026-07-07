import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { getOpgeslagenThema, pasThemaToe } from "./theme";
import "./styles.css";

try {
  pasThemaToe(getOpgeslagenThema());
} catch {
  // thema mag opstarten nooit blokkeren
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Root-element #root niet gevonden.");
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

