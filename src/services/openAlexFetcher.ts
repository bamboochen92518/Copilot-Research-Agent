import axios, { AxiosInstance } from 'axios';
import { Paper } from '../models/types';
import { config } from '../config/config';
import logger from '../utils/logger';

// ─── Public option/result types ─────────────────────────────────────────────

export interface SearchOptions {
  /** Full-text search query (searches title and abstract). */
  keywords?: string;
  /** Filter: only include works published on or after this year. */
  yearFrom?: number;
  /** Filter: only include works published on or before this year. */
  yearTo?: number;
  /** Filter: only include works with at least this many citations. */
  minCitations?: number;
  /**
   * Filter by OpenAlex topic IDs (e.g. ["T10005", "T12345"]).
   * Multiple IDs are OR-combined.
   */
  topicIds?: string[];
  /** Filter by OpenAlex source/venue ID (e.g. "S137773608"). */
  venueId?: string;
  /** Results per page (default 25, max 200). */
  perPage?: number;
  /**
   * Cursor for pagination.  Pass "*" (or omit) to start from the first page,
   * then pass the `nextCursor` returned by the previous call.
   */
  cursor?: string;
}

export interface SearchResult {
  papers: Paper[];
  /** Cursor to pass for the next page; null when no more results exist. */
  nextCursor: string | null;
  /** Total number of works matching the query (across all pages). */
  totalCount: number;
}

// ─── Internal OpenAlex API response types ────────────────────────────────────

interface OpenAlexAuthor {
  id: string;
  display_name: string;
}

interface OpenAlexAuthorship {
  author: OpenAlexAuthor;
}

interface OpenAlexSource {
  id: string;
  display_name?: string;
}

interface OpenAlexLocation {
  source?: OpenAlexSource | null;
  pdf_url?: string | null;
  landing_page_url?: string | null;
}

interface OpenAlexOpenAccess {
  is_oa?: boolean;
  oa_url?: string | null;
}

interface OpenAlexTopic {
  id: string;
  display_name: string;
}

interface OpenAlexWork {
  id: string;
  doi?: string | null;
  display_name: string;
  publication_year: number;
  cited_by_count: number;
  authorships: OpenAlexAuthorship[];
  abstract_inverted_index?: Record<string, number[]> | null;
  primary_location?: OpenAlexLocation | null;
  open_access?: OpenAlexOpenAccess | null;
  topics?: OpenAlexTopic[];
}

interface OpenAlexMeta {
  count: number;
  per_page: number;
  next_cursor?: string | null;
}

interface OpenAlexResponse {
  meta: OpenAlexMeta;
  results: OpenAlexWork[];
}

// ─── Utility functions ───────────────────────────────────────────────────────

/**
 * Reconstructs a plain-text abstract from the inverted-index format returned
 * by OpenAlex.  The index maps each word to the list of positions it occupies
 * inside the abstract.
 */
export function reconstructAbstract(
  invertedIndex: Record<string, number[]>,
): string {
  const words: string[] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words[pos] = word;
    }
  }
  // Filter out any gaps (undefined slots) before joining
  return words.filter(Boolean).join(' ');
}

/** Returns a Promise that resolves after `ms` milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Main service class ───────────────────────────────────────────────────────

/**
 * Client for the OpenAlex REST API.
 *
 * @example
 * ```ts
 * const fetcher = new OpenAlexFetcher();
 * const papers = await fetcher.fetchPapers(
 *   { keywords: 'large language models', yearFrom: 2022, minCitations: 20 },
 *   50,
 * );
 * ```
 */
export class OpenAlexFetcher {
  private readonly client: AxiosInstance;

  /**
   * Delay in ms between successive requests to respect the polite-pool
   * guideline of roughly 1 request per second.
   */
  private readonly requestDelayMs: number;

  constructor(requestDelayMs = 1000) {
    this.requestDelayMs = requestDelayMs;

    // Default query params added to every request
    const defaultParams: Record<string, string> = {};
    if (config.openAlex.email) {
      // Joining the "polite pool" gives better reliability in exchange for
      // the operator knowing which consumer is making requests.
      defaultParams['mailto'] = config.openAlex.email;
    }

    this.client = axios.create({
      baseURL: config.openAlex.apiUrl,
      params: defaultParams,
      timeout: 30_000,
    });
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  /**
   * Builds the comma-separated `filter` parameter value from SearchOptions.
   * Returns an empty string when no filters apply.
   */
  private buildFilter(options: SearchOptions): string {
    const parts: string[] = [];

    // Publication year range
    if (options.yearFrom !== undefined && options.yearTo !== undefined) {
      parts.push(`publication_year:${options.yearFrom}-${options.yearTo}`);
    } else if (options.yearFrom !== undefined) {
      parts.push(`from_publication_date:${options.yearFrom}-01-01`);
    } else if (options.yearTo !== undefined) {
      parts.push(`to_publication_date:${options.yearTo}-12-31`);
    }

    // Minimum citation count — use > (n-1) to mean >= n
    if (options.minCitations !== undefined && options.minCitations > 0) {
      parts.push(`cited_by_count:>${options.minCitations - 1}`);
    }

    // Topic IDs — OR-combined with the pipe syntax
    if (options.topicIds && options.topicIds.length > 0) {
      parts.push(`topics.id:${options.topicIds.join('|')}`);
    }

    // Venue (source) filter
    if (options.venueId) {
      parts.push(`primary_location.source.id:${options.venueId}`);
    }

    return parts.join(',');
  }

  /**
   * Maps a raw OpenAlex work object to the internal `Paper` model.
   */
  private mapWorkToPaper(work: OpenAlexWork): Paper {
    const authors = work.authorships.map((a) => a.author.display_name);

    const abstract = work.abstract_inverted_index
      ? reconstructAbstract(work.abstract_inverted_index)
      : '';

    // Prefer the primary location's PDF URL; fall back to the OA URL
    const pdfUrl =
      work.primary_location?.pdf_url ??
      work.open_access?.oa_url ??
      undefined;

    // Canonical landing page: primary location → DOI → OpenAlex ID
    const url =
      work.primary_location?.landing_page_url ??
      work.doi ??
      work.id;

    const topics = work.topics?.map((t) => t.display_name) ?? [];

    // The DOI from OpenAlex often includes the full URI prefix; strip it so
    // we store only the bare DOI (e.g. "10.1234/example").
    const doi = work.doi
      ? work.doi.replace(/^https?:\/\/doi\.org\//i, '')
      : undefined;

    // The OpenAlex work ID is a full URI; extract just the short ID.
    const openAlexId = work.id.split('/').pop();

    return {
      title: work.display_name,
      authors,
      abstract,
      url,
      doi,
      openAlexId,
      pdfUrl: pdfUrl ?? undefined,
      citedByCount: work.cited_by_count,
      publicationYear: work.publication_year,
      topics,
      fetchDate: new Date(),
    };
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Fetches a **single page** of works from the OpenAlex API.
   *
   * Use {@link fetchPapers} if you want automatic multi-page fetching.
   */
  async searchWorks(options: SearchOptions = {}): Promise<SearchResult> {
    const params: Record<string, string | number> = {
      per_page: options.perPage ?? config.openAlex.maxResults,
      // Always request a cursor so the caller can paginate further
      cursor: options.cursor ?? '*',
    };

    if (options.keywords) {
      params['search'] = options.keywords;
    }

    const filter = this.buildFilter(options);
    if (filter) {
      params['filter'] = filter;
    }

    logger.debug('OpenAlex API request', { params });

    const response = await this.client.get<OpenAlexResponse>('/works', {
      params,
    });

    const data = response.data;
    const papers = data.results.map((work) => this.mapWorkToPaper(work));
    const nextCursor = data.meta.next_cursor ?? null;

    logger.info(
      `Fetched ${papers.length} paper(s) (total available: ${data.meta.count})`,
      { totalCount: data.meta.count, nextCursor },
    );

    return {
      papers,
      nextCursor,
      totalCount: data.meta.count,
    };
  }

  /**
   * Fetches **up to `maxResults` papers**, automatically following the cursor
   * across multiple pages and inserting a rate-limit delay between requests.
   *
   * @param options   - Search and filter options (cursor is managed internally).
   * @param maxResults - Maximum total papers to return
   *                    (defaults to `config.openAlex.maxResults`).
   */
  async fetchPapers(
    options: SearchOptions = {},
    maxResults?: number,
  ): Promise<Paper[]> {
    const limit = maxResults ?? config.openAlex.maxResults;
    const perPage = Math.min(options.perPage ?? 25, 200);
    const allPapers: Paper[] = [];
    let cursor: string | null = '*';
    let pageCount = 0;

    while (cursor !== null && allPapers.length < limit) {
      if (pageCount > 0) {
        await sleep(this.requestDelayMs);
      }

      const remaining = limit - allPapers.length;
      const thisPerPage = Math.min(perPage, remaining);

      try {
        const result = await this.searchWorks({
          ...options,
          perPage: thisPerPage,
          cursor,
        });

        allPapers.push(...result.papers);
        cursor = result.nextCursor;
        pageCount++;

        if (result.papers.length === 0) {
          break;
        }
      } catch (error) {
        logger.error('Error fetching papers from OpenAlex', {
          error,
          cursor,
          pageCount,
        });
        throw error;
      }
    }

    return allPapers.slice(0, limit);
  }
}

export default OpenAlexFetcher;
