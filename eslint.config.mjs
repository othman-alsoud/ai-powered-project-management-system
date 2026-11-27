import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const jsxA11yPlugin = nextVitals.find((entry) => entry.plugins?.["jsx-a11y"])
  ?.plugins?.["jsx-a11y"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...(jsxA11yPlugin?.flatConfigs?.recommended?.rules
    ? [
        {
          name: "a11y/recommended",
          files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
          rules: {
            ...jsxA11yPlugin.flatConfigs.recommended.rules,
          },
        },
      ]
    : []),
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".agents/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
