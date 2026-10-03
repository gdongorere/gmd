import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  { ignores: ["e2e/**", "playwright.config.ts", "vitest.config.mts", "docs/**", "test-results/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // These were switched off wholesale. They are warnings now: visible in every lint run
      // and review, without blocking a build while the remaining cases are cleaned up.
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true }],
      "@typescript-eslint/no-explicit-any": "warn",
      "prefer-const": "warn",
      "react/no-unescaped-entities": "warn",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react/jsx-no-undef": "error",
    },
  },
];

export default eslintConfig;
