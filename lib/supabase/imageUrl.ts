// lib/supabase/imageUrl.ts
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Build an image URL from Storage path (icon_path).
 * Assumes the bucket is PUBLIC.
 *
 * If your bucket is PRIVATE, replace this with createSignedUrl(...)
 * later. (We keep it isolated here so you can swap logic easily.)
 */
export function getIconPublicUrl(
  supabase: SupabaseClient,
  bucketName: string,
  iconPath: string
): string {
  const { data } = supabase.storage.from(bucketName).getPublicUrl(iconPath);
  return data?.publicUrl ?? iconPath;
}
