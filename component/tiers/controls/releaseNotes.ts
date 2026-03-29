export type ReleaseNoteItem = {
  id: string;
  date: string;
  title?: string;
  items: string[];
};

export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    id: "2026-03-29",
    date: "2026-03-29",
    title: "出力画像の修正",
    items: [
      "画像出力時のレイアウトを見直し、端末に依存せず安定した比率で保存できるようにしました。"
    ],
  },
];
