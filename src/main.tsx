import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Ensure pointer events are enabled on mount
const rootElement = document.getElementById("root");
if (rootElement) {
  rootElement.style.pointerEvents = "auto";
}

createRoot(rootElement!).render(<App />);
