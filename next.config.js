/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // next/image を使う場合に Supabase Storage のドメインを許可する
    // （現状は img タグなので必須ではないが、将来切替のために用意）
    remotePatterns: (() => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!url) return [];

      try {
        const u = new URL(url);
        // Supabase Storage の public URL は通常:
        // https://<project-ref>.supabase.co/storage/v1/object/public/...
        return [
          {
            protocol: u.protocol.replace(":", ""),
            hostname: u.hostname,
            pathname: "/storage/v1/object/**",
          },
        ];
      } catch {
        return [];
      }
    })(),
  },
};

module.exports = nextConfig;
