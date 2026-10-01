import "./storage-shim.js"; // window.storage поверх localStorage — до импорта приложения
import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css"; // Tailwind v3 (локально, без CDN)
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(<App />);
