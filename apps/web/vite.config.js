import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const DEFAULT_API_URL = "https://edwebservices2.engdis.com/api/";
const DICTIONARY_ORIGIN = "https://api.dictionaryapi.dev";

// Content-Security-Policy for the built site. connect-src is the important
// line: the page can only talk to ED22 and the dictionary, so even a
// compromised dependency could not send a token or password anywhere else.
// Build-only, because Vite's dev server relies on inline scripts.
function contentSecurityPolicy(apiUrl) {
  const policy = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    `connect-src ${new URL(apiUrl).origin} ${DICTIONARY_ORIGIN}`,
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");

  return {
    name: "ed22-csp",
    apply: "build",
    transformIndexHtml: (html) => html.replace(
      "<!-- csp -->",
      `<meta http-equiv="Content-Security-Policy" content="${policy}">`,
    ),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const apiUrl = env.VITE_ED22_API_URL || DEFAULT_API_URL;

  return {
    // Relative asset paths + hash routing: works on GitHub Pages or any static host, under any path.
    base: "./",
    plugins: [react(), contentSecurityPolicy(apiUrl)],
    build: { target: "es2022", sourcemap: false },
  };
});
