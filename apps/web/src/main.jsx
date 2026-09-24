import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

// Refuse to run inside a frame (clickjacking). Static hosts such as GitHub
// Pages cannot send a frame-ancestors header, and CSP meta tags ignore it.
if (window.top !== window.self) {
  document.body.textContent = "ED22 Tracker cannot be embedded in another site.";
} else {
  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
