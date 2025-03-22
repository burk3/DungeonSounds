import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Import fonts in the main entry point
import "@fontsource/cinzel/400.css";
import "@fontsource/cinzel/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/material-icons/index.css";

createRoot(document.getElementById("root")!).render(<App />);
