import axios from 'axios';
import {
  OpenAlexFetcher,
  reconstructAbstract,
} from '../../src/services/openAlexFetcher';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../../src/config/config', () => ({
  config: {
    openAlex: {
      apiUrl: 'https://api.openalex.org',
      email: 'test@example.com',
      maxResults: 10,
    },
  },
}));

jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// ─── Test fixtures ────────────────────────────────────────────────────────────

const makeWork = (overrides: Record<string, unknown> = {}) => ({
  id: 'https://openalex.org/W1234567890',
  doi: 'https://doi.org/10.1234/test',
  display_name: 'Test Paper Title',
  publication_year: 2023,
  cited_by_count: 42,
  authorships: [
    { author: { id: 'A1', display_name: 'Alice Smith' } },
    { author: { id: 'A2', display_name: 'Bob Jones' } },
  ],
  abstract_inverted_index: {
    This: [0],
    is: [1],
    a: [2],
    test: [3],
  },
  primary_location: {
    pdf_url: 'https://example.com/paper.pdf',
    landing_page_url: 'https://doi.org/10.1234/test',
    source: { id: 'S1', display_name: 'Nature' },
  },
  open_access: { is_oa: true, oa_url: 'https://oa.example.com/paper.pdf' },
  topics: [{ id: 'T10005', display_name: 'Machine Learning' }],
  ...overrides,
});

const makeApiResponse = (
  results: ReturnType<typeof makeWork>[],
  nextCursor: string | null = null,
  count = results.length,
) => ({
  data: {
    meta: { count, per_page: 25, next_cursor: nextCursor },
    results,
  },
});

// ─── reconstructAbstract ─────────────────────────────────────────────────────

describe('reconstructAbstract', () => {
  it('reconstructs abstract from inverted index', () => {
    const index = { Hello: [0], world: [1], '!': [2] };
    expect(reconstructAbstract(index)).toBe('Hello world !');
  });

  it('handles out-of-order words', () => {
    const index = { B: [1], A: [0], C: [2] };
    expect(reconstructAbstract(index)).toBe('A B C');
  });

  it('handles a word appearing at multiple positions', () => {
    const index = { the: [0, 2], cat: [1], mat: [3] };
    expect(reconstructAbstract(index)).toBe('the cat the mat');
  });

  it('returns empty string for empty inverted index', () => {
    expect(reconstructAbstract({})).toBe('');
  });
});

// ─── OpenAlexFetcher ─────────────────────────────────────────────────────────

describe('OpenAlexFetcher', () => {
  let fetcher: OpenAlexFetcher;
  let mockGet: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGet = jest.fn();
    mockedAxios.create.mockReturnValue({ get: mockGet } as never);
    // Use 0ms delay so tests don't slow down
    fetcher = new OpenAlexFetcher(0);
  });

  // ── Constructor ────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates an axios instance with the base URL from config', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.openalex.org',
        }),
      );
    });

    it('includes mailto in default params when email is configured', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({ mailto: 'test@example.com' }),
        }),
      );
    });
  });

  // ── searchWorks – request params ──────────────────────────────────────────

  describe('searchWorks – request params', () => {
    beforeEach(() => {
      mockGet.mockResolvedValue(makeApiResponse([makeWork()]));
    });

    it('requests /works with cursor=* by default', async () => {
      await fetcher.searchWorks();
      expect(mockGet).toHaveBeenCalledWith(
        '/works',
        expect.objectContaining({ params: expect.objectContaining({ cursor: '*' }) }),
      );
    });

    it('passes the provided cursor', async () => {
      await fetcher.searchWorks({ cursor: 'abc123' });
      expect(mockGet).toHaveBeenCalledWith(
        '/works',
        expect.objectContaining({ params: expect.objectContaining({ cursor: 'abc123' }) }),
      );
    });

    it('adds search param when keywords provided', async () => {
      await fetcher.searchWorks({ keywords: 'transformer models' });
      expect(mockGet).toHaveBeenCalledWith(
        '/works',
        expect.objectContaining({
          params: expect.objectContaining({ search: 'transformer models' }),
        }),
      );
    });

    it('omits search param when no keywords', async () => {
      await fetcher.searchWorks({});
      const { params } = (mockGet as jest.Mock).mock.calls[0][1];
      expect(params).not.toHaveProperty('search');
    });

    it('uses per_page from options', async () => {
      await fetcher.searchWorks({ perPage: 50 });
      expect(mockGet).toHaveBeenCalledWith(
        '/works',
        expect.objectContaining({ params: expect.objectContaining({ per_page: 50 }) }),
      );
    });

    it('falls back to config.openAlex.maxResults for per_page', async () => {
      await fetcher.searchWorks();
      expect(mockGet).toHaveBeenCalledWith(
        '/works',
        expect.objectContaining({ params: expect.objectContaining({ per_page: 10 }) }),
      );
    });
  });

  // ── searchWorks – filter building ─────────────────────────────────────────

  describe('searchWorks – filter building', () => {
    const getFilter = () => {
      const { params } = (mockGet as jest.Mock).mock.calls[0][1];
      return params.filter as string | undefined;
    };

    beforeEach(() => {
      mockGet.mockResolvedValue(makeApiResponse([]));
    });

    it('builds year range filter', async () => {
      await fetcher.searchWorks({ yearFrom: 2020, yearTo: 2024 });
      expect(getFilter()).toBe('publication_year:2020-2024');
    });

    it('builds from-only year filter', async () => {
      await fetcher.searchWorks({ yearFrom: 2022 });
      expect(getFilter()).toBe('from_publication_date:2022-01-01');
    });

    it('builds to-only year filter', async () => {
      await fetcher.searchWorks({ yearTo: 2021 });
      expect(getFilter()).toBe('to_publication_date:2021-12-31');
    });

    it('builds citation count filter', async () => {
      await fetcher.searchWorks({ minCitations: 50 });
      expect(getFilter()).toBe('cited_by_count:>49');
    });

    it('skips citation filter when minCitations is 0', async () => {
      await fetcher.searchWorks({ minCitations: 0 });
      expect(getFilter()).toBeUndefined();
    });

    it('builds single topic ID filter', async () => {
      await fetcher.searchWorks({ topicIds: ['T10005'] });
      expect(getFilter()).toBe('topics.id:T10005');
    });

    it('OR-combines multiple topic IDs', async () => {
      await fetcher.searchWorks({ topicIds: ['T10005', 'T20010'] });
      expect(getFilter()).toBe('topics.id:T10005|T20010');
    });

    it('builds venue filter', async () => {
      await fetcher.searchWorks({ venueId: 'S137773608' });
      expect(getFilter()).toBe('primary_location.source.id:S137773608');
    });

    it('combines multiple filters with comma', async () => {
      await fetcher.searchWorks({
        yearFrom: 2022,
        yearTo: 2024,
        minCitations: 10,
        topicIds: ['T10005'],
      });
      expect(getFilter()).toBe(
        'publication_year:2022-2024,cited_by_count:>9,topics.id:T10005',
      );
    });

    it('omits filter param entirely when no filters set', async () => {
      await fetcher.searchWorks({ keywords: 'llm' });
      const { params } = (mockGet as jest.Mock).mock.calls[0][1];
      expect(params).not.toHaveProperty('filter');
    });
  });

  // ── searchWorks – response mapping ───────────────────────────────────────

  describe('searchWorks – response mapping', () => {
    it('maps work fields to Paper model correctly', async () => {
      mockGet.mockResolvedValue(makeApiResponse([makeWork()], 'cursor2', 100));
      const result = await fetcher.searchWorks();

      expect(result.totalCount).toBe(100);
      expect(result.nextCursor).toBe('cursor2');
      expect(result.papers).toHaveLength(1);

      const paper = result.papers[0];
      expect(paper.title).toBe('Test Paper Title');
      expect(paper.authors).toEqual(['Alice Smith', 'Bob Jones']);
      expect(paper.abstract).toBe('This is a test');
      expect(paper.doi).toBe('10.1234/test');
      expect(paper.openAlexId).toBe('W1234567890');
      expect(paper.pdfUrl).toBe('https://example.com/paper.pdf');
      expect(paper.url).toBe('https://doi.org/10.1234/test');
      expect(paper.citedByCount).toBe(42);
      expect(paper.publicationYear).toBe(2023);
      expect(paper.topics).toEqual(['Machine Learning']);
      expect(paper.fetchDate).toBeInstanceOf(Date);
    });

    it('strips "https://doi.org/" prefix from DOI', async () => {
      mockGet.mockResolvedValue(
        makeApiResponse([makeWork({ doi: 'https://doi.org/10.5678/foo' })]),
      );
      const { papers } = await fetcher.searchWorks();
      expect(papers[0].doi).toBe('10.5678/foo');
    });

    it('sets abstract to empty string when inverted index is null', async () => {
      mockGet.mockResolvedValue(
        makeApiResponse([makeWork({ abstract_inverted_index: null })]),
      );
      const { papers } = await fetcher.searchWorks();
      expect(papers[0].abstract).toBe('');
    });

    it('falls back to OA url when primary_location has no pdf_url', async () => {
      mockGet.mockResolvedValue(
        makeApiResponse([
          makeWork({
            primary_location: {
              pdf_url: null,
              landing_page_url: 'https://doi.org/10.1234/test',
              source: null,
            },
            open_access: { oa_url: 'https://oa.example.com/paper.pdf' },
          }),
        ]),
      );
      const { papers } = await fetcher.searchWorks();
      expect(papers[0].pdfUrl).toBe('https://oa.example.com/paper.pdf');
    });

    it('uses OpenAlex work ID as url when primary_location is null', async () => {
      mockGet.mockResolvedValue(
        makeApiResponse([
          makeWork({
            doi: null,
            primary_location: null,
          }),
        ]),
      );
      const { papers } = await fetcher.searchWorks();
      expect(papers[0].url).toBe('https://openalex.org/W1234567890');
    });

    it('sets nextCursor to null when meta.next_cursor is missing', async () => {
      mockGet.mockResolvedValue(
        makeApiResponse([makeWork()], null),
      );
      const result = await fetcher.searchWorks();
      expect(result.nextCursor).toBeNull();
    });

    it('returns empty papers array when results is empty', async () => {
      mockGet.mockResolvedValue(makeApiResponse([], null, 0));
      const result = await fetcher.searchWorks();
      expect(result.papers).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });
  });

  // ── fetchPapers – pagination ──────────────────────────────────────────────

  describe('fetchPapers – pagination', () => {
    it('returns results from a single page when they fit within maxResults', async () => {
      mockGet.mockResolvedValue(
        makeApiResponse([makeWork(), makeWork()], null, 2),
      );
      const papers = await fetcher.fetchPapers({}, 5);
      expect(papers).toHaveLength(2);
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('follows cursor across multiple pages', async () => {
      mockGet
        .mockResolvedValueOnce(makeApiResponse([makeWork()], 'page2cursor', 3))
        .mockResolvedValueOnce(makeApiResponse([makeWork()], 'page3cursor', 3))
        .mockResolvedValueOnce(makeApiResponse([makeWork()], null, 3));

      const papers = await fetcher.fetchPapers({}, 10);
      expect(papers).toHaveLength(3);
      expect(mockGet).toHaveBeenCalledTimes(3);
    });

    it('passes the correct cursor to each subsequent request', async () => {
      mockGet
        .mockResolvedValueOnce(makeApiResponse([makeWork()], 'cursor2', 2))
        .mockResolvedValueOnce(makeApiResponse([makeWork()], null, 2));

      await fetcher.fetchPapers({}, 10);

      const [, secondCallArgs] = mockGet.mock.calls;
      expect(secondCallArgs[1].params.cursor).toBe('cursor2');
    });

    it('stops after collecting maxResults papers', async () => {
      mockGet
        .mockResolvedValueOnce(makeApiResponse([makeWork(), makeWork()], 'c2', 10))
        .mockResolvedValueOnce(makeApiResponse([makeWork(), makeWork()], 'c3', 10));

      const papers = await fetcher.fetchPapers({}, 3);
      expect(papers).toHaveLength(3);
    });

    it('stops when the API returns an empty results page', async () => {
      mockGet
        .mockResolvedValueOnce(makeApiResponse([makeWork()], 'c2', 5))
        .mockResolvedValueOnce(makeApiResponse([], 'c3', 5));

      const papers = await fetcher.fetchPapers({}, 10);
      expect(papers).toHaveLength(1);
    });

    it('throws and logs when the API call fails', async () => {
      const apiError = new Error('Network error');
      mockGet.mockRejectedValue(apiError);

      await expect(fetcher.fetchPapers()).rejects.toThrow('Network error');
    });

    it('uses config.openAlex.maxResults when maxResults is not given', async () => {
      mockGet.mockResolvedValue(makeApiResponse([], null, 0));
      // config mock sets maxResults = 10; we just verify no error
      await expect(fetcher.fetchPapers()).resolves.toEqual([]);
    });
  });
});
