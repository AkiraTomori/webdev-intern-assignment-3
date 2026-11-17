import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// The frontend talks to the backend only through /api/*.
const backendPatterns = [
  { group: ["**/backend/**", "**/database/**"], message: "The frontend must not import backend or database code. Call /api/* instead." },
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    rules: {
      "no-restricted-imports": ["error", { patterns: backendPatterns, paths: ["express", "@prisma/client", "prisma", "pg", "zod"] }],
    },
  },
  // Tests may read backend/domain to cross-check message keys.
  { files: ["test/**"], rules: { "no-restricted-imports": "off" } },
]);
