import { createLogger, defineConfig } from "vite";
import vinext from "vinext";
import { kvDataAdapter } from "@vinext/cloudflare/cache/kv-data-adapter";
import { cloudflare } from "@cloudflare/vite-plugin";
import { createHash } from "node:crypto";
import { patchCssModules } from "vite-css-modules";
import path from "node:path";

const unicodeWindowsPath = process.platform === "win32" && /[^\x00-\x7F]/u.test(import.meta.dirname);

export default defineConfig({
  // The native Rolldown reporter can cut a UTF-8 path in the middle of a character.
  // Skip its progress display while keeping Vite's regular startup and error logs.
  ...(unicodeWindowsPath ? { logLevel: "warn", customLogger: createLogger() } : {}),
  plugins: [
    patchCssModules({ exportMode: "default" }),
    vinext({ cache: { data: kvDataAdapter() } }),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
  css: {
    modules: {
      generateScopedName(name: string, filename: string) {
        const relativePath = path.relative(import.meta.dirname, filename.replace(/\?.*$/, "")).replaceAll("\\", "/");
        return `_${name}_${createHash("sha256").update(relativePath).digest("hex").slice(0, 7)}`;
      },
    },
  },
});
