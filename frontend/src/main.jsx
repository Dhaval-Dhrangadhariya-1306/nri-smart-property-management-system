import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
const savedTheme = localStorage.getItem("nri_theme");
if (savedTheme) document.documentElement.dataset.theme = savedTheme;
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
