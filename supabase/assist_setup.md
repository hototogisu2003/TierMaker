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

## 既存テーブルへの倍率列追加

既存環境では、アプリ更新前に `assist_ratio_update.sql` をSQL Editorで全文実行してください。`ratio numeric`列の追加と、Excelの番号に対応した倍率の設定を行います。実行済みの場合は再実行不要です。名前・説明文・分類などは変更しません。

フロート画面の「並び替え」から「番号順」「倍率順」を選べます。倍率順は「攻撃アップ」選択時のみ有効で、`ratio`の数値降順、同値は番号降順、未入力は末尾です。説明文のパーセントから換算せず、Excelの値（例：106）をそのまま使用します。攻撃アップを解除すると番号順に戻ります。「検索」で確定、「閉じる」・背景クリック・Escapeで変更を破棄し、「条件をリセット」で番号順へ戻ります。

## CSVをExcelから作り直す場合

Excelの列を次の名前へ置き換え、分類の空欄を `0` にしてください。該当する分類には `1` を入力します。

| Excel列 | CSV・DB列名 |
| --- | --- |
| name | name |
| number | number |
| file_path | file_path |
| assist_skill | assist_skill |
| 攻撃アップ | attack_up |
| ratio | ratio |
| 友情アップ | friendship_up |
| HPアップ | hp_up |
| SS短縮 | ss_shortening |
| ダメージ軽減 | damage_reduction |
| 回復 | recovery |
| バリア付与 | barrier_grant |
| 状態付与 | status_grant |

`number`は整数で重複不可です。同名キャラクターでも番号が異なる場合は別レコードです。`file_path`の数式は計算済みの値として保存し、CSV UTF-8形式で出力してください。説明文や見出しにExcelのふりがな情報を付加しないでください。カンマ・改行を含む説明文はCSVの引用符を維持してください。

`ratio`は小数も扱える数値で、空欄はNULLとして取り込みます。分類列の位置が移動しているため、列の見出しで対応付けてください。同梱CSVの倍率入力は45件です。

## 公開後の更新

Supabase Table Editorからレコードを追加・修正します。分類は必ず0または1で設定し、画像を追加する場合はR2にも対応するファイルを配置してください。同梱CSVは初期投入用です。運用中のテーブルに再インポートすると主キーが重複するため、既存データの更新には管理画面を使ってください。

変更後は `/assist` を再読み込みしてください。ブラウザ内の検索に全件データを使用し、API応答はキャッシュしません。DB未作成・通信失敗時は再試行ボタンを表示します。

## 検証

- `node --test tests/assist.test.cjs`：検索のAND条件・説明文対象・並び順・初期CSVの件数を検証します。
- `npm run build`：型チェックと本番ビルドを実行します。
- `npm run start -- -p 3100` で起動後、別ターミナルで `node tests/assist.browser.cjs`：インストール済みChromeとNode 24で、テスト用API応答を使って検索・モーダル・スマホ表示・取得失敗からの復帰を確認します。Chromeが標準の場所にない場合は `CHROME_PATH` を指定してください。スクリーンショットは `.next/assist-mobile.png` に保存します。
- 画面では、分類を選択して「閉じる」・背景クリック・Escapeで破棄されること、「検索」で確定すること、再表示時の選択状態、Tab操作と閉じた後のフォーカスを確認します。
- 倍率順の選択可否、倍率順からの確定・破棄、攻撃アップ解除時の番号順への復帰と、条件リセットを確認します。モーダルのスマホ画面は `.next/assist-sort-mobile.png` に保存します。
- 説明文入力後300msの反映、条件リセット、0件表示、狭い画面と長文、画像欠損時の代替表示、API取得失敗からの再試行を確認します。
