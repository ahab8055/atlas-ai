import React from "react";
import ReactDOM from "react-dom/client";
import { createLogger } from "@atlas-ai/logging";
import App from "./App";
import "./index.css";

const log = createLogger({
  service: "desktop-ui",
  level: "debug",
  category: "application",
});

log.info("desktop UI bootstrap");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
