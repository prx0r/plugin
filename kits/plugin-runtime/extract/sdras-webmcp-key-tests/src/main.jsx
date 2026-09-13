import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { installModelContextShim } from "./lib/modelContextShim.js";
import "./styles.css";

// `?sim` installs the in-page simulator before React mounts, so every
// registration path sees `document.modelContext` from the first render.
if (new URLSearchParams(location.search).has("sim")) installModelContextShim();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
