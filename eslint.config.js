import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

const javascriptFiles = ["**/*.{js,jsx,mjs}"];
const appFiles = ["src/**/*.{js,jsx}"];

export default [
  {
    ignores: ["dist/**"],
  },
  {
    files: javascriptFiles,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ["vite.config.js", "scripts/**/*.mjs", "test/**/*.mjs"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    ...js.configs.recommended,
    files: javascriptFiles,
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    ...react.configs.flat.recommended,
    files: appFiles,
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  {
    ...react.configs.flat["jsx-runtime"],
    files: appFiles,
    rules: {
      ...react.configs.flat["jsx-runtime"].rules,
      "react/jsx-uses-react": "error",
      "react/jsx-uses-vars": "error",
      "react/prop-types": "off",
    },
  },
  {
    ...reactHooks.configs.flat.recommended,
    files: appFiles,
  },
  {
    ...jsxA11y.flatConfigs.recommended,
    files: appFiles,
  },
];
