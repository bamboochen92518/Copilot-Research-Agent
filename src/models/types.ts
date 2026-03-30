export interface Paper {
  id?: number;
  title: string;
  authors: string[];
  abstract: string;
  url: string;
  arxivId?: string;
  fetchDate: Date;
  domain: string;
  pdfUrl?: string;
}

export interface Recommendation {
  id?: number;
  paperId: number;
  channelId: string;
  recommendedDate: Date;
}

export interface Favorite {
  id?: number;
  userId: string;
  paperId: number;
  favoritedDate: Date;
}
