# 13周年ビンゴの公開手順

1. DD4と同じSupabaseプロジェクトでSQL Editorを開き、`supabase/bingo_13th_predictions.sql` を実行します。
2. Table Editorで `bingo_13th_predictions` の作成を確認します。DD4のデータを移す必要はありません。
3. 本番環境に既存の `SUPABASE_SERVICE_ROLE_KEY`、`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY` が設定されていることを確認します。13周年用の環境変数追加は不要です。
4. アプリの変更をデプロイします。
5. `/bingo/13th` で9マス入力して予想データを登録し、`/bingo/13th/ranking` に反映されることを確認します。同じ端末から再登録すると、その端末の13周年予想が更新されます。
6. DD4の入力内容・ランキングが変わっていないことを確認します。

13周年の端末Cookie・入力下書き・投稿テーブルはDD4と分離されています。キャラクター検索と操作画面は共通です。

新テーブルはRLSを有効にし、anon/authenticatedには集計に使う `character_ids` 列の読み取りだけを許可します。書き込みはサーバーのサービスロールで行います。端末識別用の `token_hash` は公開しません。

SQLの実行前はランキングが空で表示され、登録時にテーブル作成を促すエラーが表示されます。DB作成とアプリのデプロイを終えるまでは公開完了ではありません。
