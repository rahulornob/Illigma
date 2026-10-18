import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { loadFonts } from "./fonts";
// Swap for "@illigma/tokens/tokens.css" once the tokens package lands.
import "./styles/tokens-fallback.css";
import "./styles/app.css";

loadFonts();

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// The service worker precaches the built app so it opens offline. Only in
// production builds: in development Vite serves modules that change constantly.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err: unknown) => {
      console.warn("Illigma couldn't install its offline cache.", err);
    });
  });
}
