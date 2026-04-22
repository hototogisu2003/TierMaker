export const metadata = {
  title: "プライバシーポリシー",
};

const pageStyle: React.CSSProperties = {
  padding: "16px",
  color: "#111111",
  lineHeight: 1.45,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "14px 0 4px",
  fontSize: "18px",
};

const paragraphStyle: React.CSSProperties = {
  margin: "0 0 6px",
};

export default function PrivacyPage() {
  return (
    <section style={pageStyle}>
      <h1 style={{ margin: 0 }}>プライバシーポリシー</h1>
      <p style={{ ...paragraphStyle, marginTop: 4, color: "#4b5563" }}>最終更新日: 2026年3月5日</p>

      <h2 style={sectionTitleStyle}>1. 取得する情報</h2>
      <p style={paragraphStyle}>
        当サイトでは、アクセス時にIPアドレス、ブラウザ情報、アクセス日時などの技術情報が
        サーバーログとして自動的に記録される場合があります。
      </p>

      <h2 style={sectionTitleStyle}>2. 利用目的</h2>
      <p style={paragraphStyle}>
        取得した情報は、サイトの安定運用、障害対応、セキュリティ対策、利用状況の把握のために利用します。
      </p>

      <h2 style={sectionTitleStyle}>3. 第三者サービス</h2>
      <p style={paragraphStyle}>
        当サイトは、ホスティング等のために第三者サービス（例: Vercel、Supabase）を利用しています。
        これらのサービス事業者が各社のポリシーに基づいて情報を取り扱う場合があります。
      </p>

      <h2 style={sectionTitleStyle}>4. Cookie等の利用</h2>
      <p style={paragraphStyle}>
        当サイトでは、機能提供や利便性向上のためにCookie等を利用する場合があります。
      </p>

      <h2 style={sectionTitleStyle}>5. 第三者提供</h2>
      <p style={paragraphStyle}>
        法令に基づく場合を除き、取得した情報を本人の同意なく第三者に提供しません。
      </p>

      <h2 style={sectionTitleStyle}>6. 開示・削除等の問い合わせ</h2>
      <p style={paragraphStyle}>
        本ポリシーや個人情報の取り扱いに関するお問い合わせは、サイト管理者までご連絡ください。
      </p>

      <h2 style={sectionTitleStyle}>7. 改定</h2>
      <p style={paragraphStyle}>
        本ポリシーは、必要に応じて改定することがあります。改定後は本ページにて告知します。
      </p>
    </section>
  );
}
