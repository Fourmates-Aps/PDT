import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Node CLI tooling, not application code: seeding, migrations and the
    // Phase 1 verification harness. `cond ? pass(...) : fail(...)` reads well in
    // a long list of checks and is intentional there.
    files: ["scripts/**/*.mjs"],
    rules: {
      "@typescript-eslint/no-unused-expressions": "off",
    },
  },
]);

export default eslintConfig;
