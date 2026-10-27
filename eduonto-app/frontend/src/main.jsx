import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import App from "./App.jsx";
import { ToastProvider } from "./components/Toast.jsx";
import "./styles.css";

// Thème choisi précédemment (clair / sombre), appliqué avant le premier affichage
try {
  const theme = localStorage.getItem("eduonto-theme");
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
} catch {
  // stockage indisponible (navigation privée) : on suit la préférence du système
}

createRoot(document.getElementById("root")).render(
  <ToastProvider>
    <App />
  </ToastProvider>,
);
