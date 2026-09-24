import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default [
  { ignores: ["**/node_modules/**", "**/dist/**"] },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: globals.node },
  },
  {
    files: ["packages/core/src/**/*.js"],
    // Core runs in browsers too: no Node globals allowed.
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    // Node scripts whose callbacks run inside the browser page.
    files: ["apps/web/e2e/**/*.js"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ["apps/web/src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Context modules export their hook next to the provider.
      "react-refresh/only-export-components": ["warn", {
        allowConstantExport: true,
        allowExportNames: ["useAuth", "useI18n", "useToast", "useErrorText"],
      }],
      // Components are referenced from JSX, which core no-unused-vars does not see.
      "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]" }],
    },
  },
];
