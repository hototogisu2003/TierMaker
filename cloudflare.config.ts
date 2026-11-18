import { bindings, defineConfig, defineWorker } from "cf/config";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // The browser bundle and the server-side Supabase clients use the same public settings.
  const publicEnv = loadEnv(mode ?? "production", import.meta.dirname, "NEXT_PUBLIC_");
  const publicBindings = Object.fromEntries(
    Object.entries(publicEnv).map(([name, value]) => [name, bindings.text(value)]),
  );

  return {
    worker: defineWorker({
      name: "tier-maker-staging",
      entrypoint: "vinext/server/fetch-handler",
      compatibilityDate: "2026-11-18",
      assets: {
        htmlHandling: "none",
        notFoundHandling: "none",
      },
      env: {
        ...publicBindings,
        ASSETS: bindings.assets(),
        SUPABASE_SERVICE_ROLE_KEY: bindings.secret(),
      },
    }),
  };
});
