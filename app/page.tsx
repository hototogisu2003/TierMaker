import Link from "next/link";

export default function HomePage() {
  return (
    <section className="stack" style={{ padding: "16px" }}>
      <h1 style={{ margin: 0, color: "#111111" }}>MS Optimize Tools</h1>
      <p style={{ margin: 0, color: "#374151" }}>公開中のツール一覧</p>
      <div>
        <Link href="/tier" style={{ color: "#2563eb", fontWeight: 700 }}>
          Tier Maker (/tier)
        </Link>
      </div>
    </section>
  );
}
