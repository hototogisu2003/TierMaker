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
      "出力される画像の縦横比を1280:720に固定化するように修正しました。"
    ],
  },
];
