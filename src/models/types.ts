export interface Paper {
  id?: number;
  title: string;
  authors: string[];
  abstract: string;
  url: string;
  doi?: string;
  openAlexId?: string;
  pdfUrl?: string;
  citedByCount?: number;
  publicationYear?: number;
  topics?: string[];
  fetchDate: Date;
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
