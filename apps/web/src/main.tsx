import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { loadFonts } from "./fonts";
import { registerServiceWorker } from "./sw-update";
// Swap for "@illigma/tokens/tokens.css" once the tokens package lands.
import "./styles/tokens-fallback.css"; // app-only names; the Figma tokens below override any shared ones
import "@illigma/tokens/tokens.css";
import "./styles/app.css";
import "./styles/layers.css";
import "./styles/definitions.css";

loadFonts();

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// The service worker precaches the built app so it opens offline. Only in
// production builds: in development Vite serves modules that change constantly.
if (import.meta.env.PROD && "serviceWorker" in navigator) registerServiceWorker(`${import.meta.env.BASE_URL}sw.js`);
