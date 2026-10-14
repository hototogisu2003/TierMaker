# アシストスキル検索ツールのセットアップ

## 初回の公開

1. 既存ツールと同じSupabaseプロジェクトのSQL Editorで `assist_characters.sql` を実行します。
2. Table Editorで `public.assist_characters` を開き、同梱の `assist_characters.csv` をインポートします。CSVは修正済みの `idea/assist_1.xlsx` から作成した87件です。ヘッダーとDB列名を対応させてください。
3. 次のSQLで取り込み件数と分類を確認します。結果は `87 / 45 / 8` になります。

   ```sql
   select count(*) as total,
          sum(attack_up) as attack_up,
          sum(ss_shortening) as ss_shortening
   from public.assist_characters;

   select number, name, attack_up, ss_shortening
   from public.assist_characters
   where number in (8487, 8921);
   -- 8487 スサノオ: attack_up=0, ss_shortening=1
   -- 8921 ラファエル: attack_up=1, ss_shortening=0
   ```

4. アプリに既存の `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`NEXT_PUBLIC_R2_PUBLIC_BASE_URL` を設定します。新たな認証キーは不要です。画像パスは `7321.jpg` のようなR2の公開ベースURLからの相対パスです。R2設定がない場合は、既存方式と同じく `NEXT_PUBLIC_ICON_BUCKET`（既定値 `characters`）のSupabase公開URLを使用します。
5. `/assist` を開き、全87件、番号降順、画像表示を確認します。トップページへのリンク追加はありません。

SQLによって匿名・ログイン済み利用者は読み取り専用になります。アプリではサービスロールキーを使用しません。

## CSVをExcelから作り直す場合

Excelの列を次の名前へ置き換え、分類の空欄を `0` にしてください。該当する分類には `1` を入力します。

| Excel列 | CSV・DB列名 |
| --- | --- |
| name | name |
| number | number |
| file_path | file_path |
| assist_skill | assist_skill |
| 攻撃アップ | attack_up |
| 友情アップ | friendship_up |
| HPアップ | hp_up |
| SS短縮 | ss_shortening |
| ダメージ軽減 | damage_reduction |
| 回復 | recovery |
| バリア付与 | barrier_grant |
| 状態付与 | status_grant |

`number`は整数で重複不可です。同名キャラクターでも番号が異なる場合は別レコードです。`file_path`の数式は計算済みの値として保存し、CSV UTF-8形式で出力してください。説明文や見出しにExcelのふりがな情報を付加しないでください。カンマ・改行を含む説明文はCSVの引用符を維持してください。

## 公開後の更新

Supabase Table Editorからレコードを追加・修正します。分類は必ず0または1で設定し、画像を追加する場合はR2にも対応するファイルを配置してください。同梱CSVは初期投入用です。運用中のテーブルに再インポートすると主キーが重複するため、既存データの更新には管理画面を使ってください。

変更後は `/assist` を再読み込みしてください。ブラウザ内の検索に全件データを使用し、API応答はキャッシュしません。DB未作成・通信失敗時は再試行ボタンを表示します。

## 検証

- `node --test tests/assist.test.cjs`：検索のAND条件・説明文対象・並び順・初期CSVの件数を検証します。
- `npm run build`：型チェックと本番ビルドを実行します。
- `npm run start -- -p 3100` で起動後、別ターミナルで `node tests/assist.browser.cjs`：インストール済みChromeとNode 24で、テスト用API応答を使って検索・モーダル・スマホ表示・取得失敗からの復帰を確認します。Chromeが標準の場所にない場合は `CHROME_PATH` を指定してください。スクリーンショットは `.next/assist-mobile.png` に保存します。
- 画面では、分類を選択して「閉じる」・背景クリック・Escapeで破棄されること、「検索」で確定すること、再表示時の選択状態、Tab操作と閉じた後のフォーカスを確認します。
- 説明文入力後300msの反映、条件リセット、0件表示、狭い画面と長文、画像欠損時の代替表示、API取得失敗からの再試行を確認します。
