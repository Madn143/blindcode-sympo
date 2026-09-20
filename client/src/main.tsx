import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { CinematicScene } from "./components/CinematicScene";

createRoot(document.getElementById("root")!).render(<StrictMode><CinematicScene /><div className="grain-overlay" /><App /></StrictMode>);