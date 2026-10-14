import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ASSIST_FILTERS, type AssistCharacter } from "./characters";

export async function loadAssistCharacters(): Promise<AssistCharacter[]> {
  const supabase = getSupabaseServerClient({
    // Opt out of the server-side data cache as well as the API/browser cache.
    fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
  });
  const r2Base = (process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ?? "").trim().replace(/\/+$/, "");
  const bucket = process.env.NEXT_PUBLIC_ICON_BUCKET ?? "characters";
  const characters: AssistCharacter[] = [];
  // Fetch every row even if the table grows beyond Supabase's default row limit.
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("assist_characters")
      .select(`number,name,file_path,assist_skill,ratio,${ASSIST_FILTERS.map(({ key }) => key).join(",")}`)
      .order("number", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as unknown as (Omit<AssistCharacter, "iconUrl"> & { file_path: string })[];
    for (const row of rows) {
      const path = row.file_path.trim();
      const iconUrl = !path ? "" : /^https?:\/\//i.test(path) ? path
        : r2Base ? `${r2Base}/${path.replace(/^\/+/, "")}`
        : supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      characters.push({
        number: row.number,
        ratio: row.ratio != null && Number.isFinite(Number(row.ratio)) ? Number(row.ratio) : null,
        name: row.name,
        assist_skill: row.assist_skill,
        iconUrl,
        ...Object.fromEntries(ASSIST_FILTERS.map(({ key }) => [key, row[key]])),
      } as AssistCharacter);
    }
    if (rows.length < pageSize) return characters;
  }
}
