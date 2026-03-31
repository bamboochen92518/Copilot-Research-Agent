import Database from 'better-sqlite3';
import {
  addPaper,
  getPaperById,
  getPaperByOpenAlexId,
  isPaperRecommended,
  getPapersByTopics,
  getPapersByCitationCount,
  addRecommendation,
  getRecommendationsByChannel,
  addFavorite,
  removeFavorite,
  getUserFavorites,
} from '../../src/database/operations';
import { getDatabase, closeDatabase } from '../../src/database/models';
import { Paper } from '../../src/models/types';

// ─── Test setup ───────────────────────────────────────────────────────────────

// Use a fresh in-memory database for every test file run so tests are isolated
// and never touch the real data/research-agent.db file.
jest.mock('../../src/config/config', () => ({
  config: { database: { path: ':memory:' } },
}));

jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

let db: Database.Database;

beforeEach(() => {
  closeDatabase();           // ensure no stale singleton
  db = getDatabase();        // creates fresh in-memory DB + schema
});

afterEach(() => {
  closeDatabase();
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makePaper = (overrides: Partial<Paper> = {}): Paper => ({
  title: 'Test Paper',
  authors: ['Alice', 'Bob'],
  abstract: 'A test abstract.',
  url: 'https://example.com/paper',
  doi: '10.1234/test',
  openAlexId: 'W1111111111',
  pdfUrl: 'https://example.com/paper.pdf',
  citedByCount: 50,
  publicationYear: 2023,
  topics: ['Machine Learning', 'NLP'],
  fetchDate: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

// ─── addPaper / getPaperById / getPaperByOpenAlexId ───────────────────────────

describe('addPaper', () => {
  it('inserts a paper and returns it with an id', () => {
    const saved = addPaper(makePaper(), db);
    expect(saved.id).toBeGreaterThan(0);
    expect(saved.title).toBe('Test Paper');
  });

  it('round-trips all fields correctly', () => {
    const paper = makePaper();
    const saved = addPaper(paper, db);

    expect(saved.authors).toEqual(['Alice', 'Bob']);
    expect(saved.abstract).toBe('A test abstract.');
    expect(saved.doi).toBe('10.1234/test');
    expect(saved.openAlexId).toBe('W1111111111');
    expect(saved.pdfUrl).toBe('https://example.com/paper.pdf');
    expect(saved.citedByCount).toBe(50);
    expect(saved.publicationYear).toBe(2023);
    expect(saved.topics).toEqual(['Machine Learning', 'NLP']);
    expect(saved.fetchDate).toEqual(new Date('2026-01-01T00:00:00Z'));
  });

  it('handles optional fields being undefined', () => {
    const paper = makePaper({ doi: undefined, pdfUrl: undefined, openAlexId: undefined });
    const saved = addPaper(paper, db);
    expect(saved.doi).toBeUndefined();
    expect(saved.pdfUrl).toBeUndefined();
    expect(saved.openAlexId).toBeUndefined();
  });

  it('is idempotent — returns existing paper when openAlexId matches', () => {
    const first = addPaper(makePaper(), db);
    const second = addPaper(makePaper({ title: 'Different Title' }), db);
    expect(second.id).toBe(first.id);
    expect(second.title).toBe('Test Paper');
  });

  it('allows two papers without openAlexId to coexist', () => {
    const a = addPaper(makePaper({ openAlexId: undefined }), db);
    const b = addPaper(makePaper({ openAlexId: undefined, title: 'Paper B' }), db);
    expect(a.id).not.toBe(b.id);
  });
});

describe('getPaperById', () => {
  it('returns the paper with the matching id', () => {
    const saved = addPaper(makePaper(), db);
    const found = getPaperById(saved.id!, db);
    expect(found).not.toBeNull();
    expect(found!.title).toBe('Test Paper');
  });

  it('returns null when id does not exist', () => {
    expect(getPaperById(9999, db)).toBeNull();
  });
});

describe('getPaperByOpenAlexId', () => {
  it('returns the paper with the matching openAlexId', () => {
    addPaper(makePaper(), db);
    const found = getPaperByOpenAlexId('W1111111111', db);
    expect(found).not.toBeNull();
    expect(found!.openAlexId).toBe('W1111111111');
  });

  it('returns null when openAlexId does not exist', () => {
    expect(getPaperByOpenAlexId('W9999999999', db)).toBeNull();
  });
});

// ─── isPaperRecommended ───────────────────────────────────────────────────────

describe('isPaperRecommended', () => {
  it('returns false when no recommendation exists', () => {
    addPaper(makePaper(), db);
    expect(isPaperRecommended('W1111111111', 'channel-1', db)).toBe(false);
  });

  it('returns true after a recommendation is recorded', () => {
    const paper = addPaper(makePaper(), db);
    addRecommendation(
      { paperId: paper.id!, channelId: 'channel-1', recommendedDate: new Date() },
      db,
    );
    expect(isPaperRecommended('W1111111111', 'channel-1', db)).toBe(true);
  });

  it('returns false for a different channel', () => {
    const paper = addPaper(makePaper(), db);
    addRecommendation(
      { paperId: paper.id!, channelId: 'channel-1', recommendedDate: new Date() },
      db,
    );
    expect(isPaperRecommended('W1111111111', 'channel-2', db)).toBe(false);
  });
});

// ─── getPapersByTopics ────────────────────────────────────────────────────────

describe('getPapersByTopics', () => {
  beforeEach(() => {
    addPaper(makePaper({ openAlexId: 'W1', topics: ['Machine Learning', 'NLP'] }), db);
    addPaper(makePaper({ openAlexId: 'W2', topics: ['Computer Vision'] }), db);
    addPaper(makePaper({ openAlexId: 'W3', topics: ['Robotics'] }), db);
  });

  it('returns papers matching a single topic', () => {
    const results = getPapersByTopics(['NLP'], db);
    expect(results).toHaveLength(1);
    expect(results[0].openAlexId).toBe('W1');
  });

  it('is case-insensitive', () => {
    const results = getPapersByTopics(['machine learning'], db);
    expect(results).toHaveLength(1);
  });

  it('returns papers matching any of the provided topics (OR)', () => {
    const results = getPapersByTopics(['NLP', 'Computer Vision'], db);
    expect(results).toHaveLength(2);
  });

  it('returns empty array when no paper matches', () => {
    expect(getPapersByTopics(['Quantum Computing'], db)).toHaveLength(0);
  });

  it('returns empty array when topics list is empty', () => {
    expect(getPapersByTopics([], db)).toHaveLength(0);
  });
});

// ─── getPapersByCitationCount ─────────────────────────────────────────────────

describe('getPapersByCitationCount', () => {
  beforeEach(() => {
    addPaper(makePaper({ openAlexId: 'W1', citedByCount: 10 }), db);
    addPaper(makePaper({ openAlexId: 'W2', citedByCount: 50 }), db);
    addPaper(makePaper({ openAlexId: 'W3', citedByCount: 100 }), db);
  });

  it('returns only papers with citations >= threshold', () => {
    const results = getPapersByCitationCount(50, db);
    expect(results).toHaveLength(2);
    expect(results.map((p) => p.openAlexId)).toEqual(
      expect.arrayContaining(['W2', 'W3']),
    );
  });

  it('sorts results descending by citation count', () => {
    const results = getPapersByCitationCount(0, db);
    expect(results[0].citedByCount).toBeGreaterThanOrEqual(results[1].citedByCount!);
  });

  it('returns empty array when no paper meets the threshold', () => {
    expect(getPapersByCitationCount(9999, db)).toHaveLength(0);
  });
});

// ─── addRecommendation / getRecommendationsByChannel ─────────────────────────

describe('recommendations', () => {
  let paperId: number;

  beforeEach(() => {
    const paper = addPaper(makePaper(), db);
    paperId = paper.id!;
  });

  it('adds a recommendation and returns it with an id', () => {
    const rec = addRecommendation(
      { paperId, channelId: 'ch-1', recommendedDate: new Date('2026-01-01') },
      db,
    );
    expect(rec.id).toBeGreaterThan(0);
    expect(rec.channelId).toBe('ch-1');
    expect(rec.paperId).toBe(paperId);
  });

  it('getRecommendationsByChannel returns recs for the channel', () => {
    addRecommendation({ paperId, channelId: 'ch-1', recommendedDate: new Date() }, db);
    addRecommendation({ paperId, channelId: 'ch-2', recommendedDate: new Date() }, db);

    const results = getRecommendationsByChannel('ch-1', db);
    expect(results).toHaveLength(1);
    expect(results[0].channelId).toBe('ch-1');
  });

  it('returns empty array for a channel with no recs', () => {
    expect(getRecommendationsByChannel('no-such-channel', db)).toHaveLength(0);
  });

  it('orders results by recommended_date descending', () => {
    const paper2 = addPaper(makePaper({ openAlexId: 'W2' }), db);
    addRecommendation(
      { paperId, channelId: 'ch-1', recommendedDate: new Date('2026-01-01') },
      db,
    );
    addRecommendation(
      { paperId: paper2.id!, channelId: 'ch-1', recommendedDate: new Date('2026-02-01') },
      db,
    );
    const recs = getRecommendationsByChannel('ch-1', db);
    expect(new Date(recs[0].recommendedDate) >= new Date(recs[1].recommendedDate)).toBe(true);
  });
});

// ─── addFavorite / removeFavorite / getUserFavorites ─────────────────────────

describe('favorites', () => {
  let paper1Id: number;
  let paper2Id: number;

  beforeEach(() => {
    paper1Id = addPaper(makePaper({ openAlexId: 'W1' }), db).id!;
    paper2Id = addPaper(makePaper({ openAlexId: 'W2', title: 'Paper 2' }), db).id!;
  });

  it('adds a favorite and returns it with an id', () => {
    const fav = addFavorite(
      { userId: 'user-1', paperId: paper1Id, favoritedDate: new Date() },
      db,
    );
    expect(fav.id).toBeGreaterThan(0);
    expect(fav.userId).toBe('user-1');
    expect(fav.paperId).toBe(paper1Id);
  });

  it('is idempotent — adding the same favorite twice returns the same row', () => {
    const fav1 = addFavorite(
      { userId: 'user-1', paperId: paper1Id, favoritedDate: new Date() },
      db,
    );
    const fav2 = addFavorite(
      { userId: 'user-1', paperId: paper1Id, favoritedDate: new Date() },
      db,
    );
    expect(fav2.id).toBe(fav1.id);
  });

  it('getUserFavorites returns papers favorited by the user', () => {
    addFavorite({ userId: 'user-1', paperId: paper1Id, favoritedDate: new Date('2026-01-01') }, db);
    addFavorite({ userId: 'user-1', paperId: paper2Id, favoritedDate: new Date('2026-02-01') }, db);

    const favPapers = getUserFavorites('user-1', db);
    expect(favPapers).toHaveLength(2);
    expect(favPapers.map((p) => p.id)).toEqual(
      expect.arrayContaining([paper1Id, paper2Id]),
    );
  });

  it("does not return another user's favorites", () => {
    addFavorite({ userId: 'user-1', paperId: paper1Id, favoritedDate: new Date() }, db);
    expect(getUserFavorites('user-2', db)).toHaveLength(0);
  });

  it('orders favorites by favorited_date descending', () => {
    addFavorite({ userId: 'user-1', paperId: paper1Id, favoritedDate: new Date('2026-01-01') }, db);
    addFavorite({ userId: 'user-1', paperId: paper2Id, favoritedDate: new Date('2026-02-01') }, db);

    const favPapers = getUserFavorites('user-1', db);
    expect(favPapers[0].id).toBe(paper2Id);
  });

  it('removeFavorite returns true and removes the entry', () => {
    addFavorite({ userId: 'user-1', paperId: paper1Id, favoritedDate: new Date() }, db);
    const removed = removeFavorite('user-1', paper1Id, db);
    expect(removed).toBe(true);
    expect(getUserFavorites('user-1', db)).toHaveLength(0);
  });

  it('removeFavorite returns false when no matching entry exists', () => {
    expect(removeFavorite('user-1', paper1Id, db)).toBe(false);
  });
});
