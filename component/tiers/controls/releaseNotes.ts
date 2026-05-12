export type ReleaseNoteItem = {
  id: string;
  date: string;
  title?: string;
  items: string[];
};

export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    id: "2026-05-12",
    date: "2026-05-12",
    title: "保存機能と管理画面を追加",
    items: [
      "作成した表を保存できるようにしました。",
      "保存した表を一覧で確認し、編集できるようにしました。",
      "表の管理画面に削除機能を追加し、不要な保存データを削除できるようにしました。",
    ],
  },
  {
    id: "2026-03-29",
    date: "2026-03-29",
    title: "出力画像の比率を調整",
    items: [
      "画像出力時のレイアウトを見直し、端末に依存せず安定した比率で保存できるようにしました。",
    ],
  },
];
