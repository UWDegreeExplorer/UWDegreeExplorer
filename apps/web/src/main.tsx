import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

// Configure API base URL for production
if (import.meta.env.VITE_API_URL) {
  setBaseUrl(import.meta.env.VITE_API_URL);
} else if (import.meta.env.DEV) {
  // Optional: fallback for local dev if not using proxy
  // setBaseUrl("http://localhost:5001");
}

createRoot(document.getElementById("root")!).render(<App />);
