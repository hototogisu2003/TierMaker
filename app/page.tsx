// app/page.tsx
import { createClient } from "@supabase/supabase-js";
import TierMaker from "@/components/tiers/TierMaker";

type CharacterRow = {
  id: string | number;
  name?: string | null;
  icon_path: string; // e.g. "characters/8000.jpg"
};

export type CharacterForUI = {
  id: string;
  name: string;
  iconPath: string;
  iconUrl: string;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return v;
}

function toStringId(id: string | number): string {
  return typeof id === "number" ? String(id) : id;
}

export default async function Page() {
  // Supabase env (server-side fetch OK)
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  // These can be overridden per your project
  const tableName = process.env.NEXT_PUBLIC_CHARACTERS_TABLE ?? "characters";
  const bucketName = process.env.NEXT_PUBLIC_ICON_BUCKET ?? "icons";

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });

  // Fetch characters
  const { data, error } = await supabase
    .from(tableName)
    .select("id,name,icon_path")
    .order("id", { ascending: true })
    .limit(5000);

  if (error) {
    // You can customize error UI later
    throw new Error(
      `Failed to fetch characters from Supabase: ${error.message}`
    );
  }

  const rows = (data ?? []) as CharacterRow[];

  // Build icon URLs from icon_path (public bucket assumed)
  const characters: CharacterForUI[] = rows
    .filter((r) => typeof r.icon_path === "string" && r.icon_path.length > 0)
    .map((r) => {
      const iconPath = r.icon_path;
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(iconPath);

      // If bucket is private, publicUrl may exist but won't load.
      // (We'll handle private bucket later if needed.)
      const iconUrl = urlData?.publicUrl ?? iconPath;

      return {
        id: toStringId(r.id),
        name: (r.name ?? "").trim() || toStringId(r.id),
        iconPath,
        iconUrl,
      };
    });

  return (
    <section className="stack">
      <h1 className="title">キャラランクメーカー</h1>
      <p className="muted">
        下のアイコンをドラッグして、S/A/B/C に配置してください（ページを開き直すとリセットされます）
      </p>

      {/* TierMaker は次のステップで components 側に実装します */}
      <TierMaker characters={characters} initialTiers={["S", "A", "B", "C"]} />
    </section>
  );
}
