export const BINGO_GRID_SIZE = 9;
export const BINGO_EXCEPTION_CHARACTER_IDS = ["1177", "1178", "1179"] as const;
export const BINGO_EXCLUDED_CHARACTER_IDS = ["105", "110", "1510"] as const;
export const BINGO_TARGET_GACHAS = ["限定", "恒常", "α"] as const;
export const BINGO_ELEMENTS = ["火", "水", "木", "光", "闇"] as const;
export const BINGO_FORMS = ["獣神化", "獣神化改"] as const;
export const MAX_BINGO_RANKING = 20;

export type BingoElement = (typeof BINGO_ELEMENTS)[number];
export type BingoGacha = (typeof BINGO_TARGET_GACHAS)[number];
export type BingoForm = (typeof BINGO_FORMS)[number];

export type BingoCharacterFilters = {
  elements: BingoElement[];
  gachas: BingoGacha[];
  forms: BingoForm[];
};

export type BingoCharacterSummary = {
  id: string;
  name: string;
  nameKana: string;
  iconUrl: string;
};

export type BingoSubmissionPayload = {
  characters: BingoCharacterSummary[];
};

export type BingoRankingItem = BingoCharacterSummary & {
  count: number;
};

export type BingoRanking = {
  totalSubmissions: number;
  characterRanking: BingoRankingItem[];
};
