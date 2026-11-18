import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  {
    files: ["**/*.{ts,tsx}"],
    // Report newer React Compiler checks without blocking the hosting migration.
    rules: {
      "react-hooks/error-boundaries": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  globalIgnores([".cloudflare/**", ".vinext/**", ".wrangler/**", "dist/**"]),
]);
