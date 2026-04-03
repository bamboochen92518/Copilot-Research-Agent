import type Database from 'better-sqlite3';
import { Paper, Recommendation, Favorite } from '../models/types';
import { getDatabase } from './models';

// ─── Internal row types (SQLite returns plain objects) ────────────────────────

interface PaperRow {
  id: number;
  title: string;
  authors: string;
  abstract: string;
  url: string;
  doi: string | null;
  openalex_id: string | null;
  pdf_url: string | null;
  cited_by_count: number;
  publication_year: number | null;
  topics: string;
  fetch_date: string;
}

interface RecommendationRow {
  id: number;
  paper_id: number;
  channel_id: string;
  recommended_date: string;
}

interface FavoriteRow {
  id: number;
  user_id: string;
  paper_id: number;
  favorited_date: string;
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

function rowToPaper(row: PaperRow): Paper {
  return {
    id: row.id,
    title: row.title,
    authors: JSON.parse(row.authors) as string[],
    abstract: row.abstract,
    url: row.url,
    doi: row.doi ?? undefined,
    openAlexId: row.openalex_id ?? undefined,
    pdfUrl: row.pdf_url ?? undefined,
    citedByCount: row.cited_by_count,
    publicationYear: row.publication_year ?? undefined,
    topics: JSON.parse(row.topics) as string[],
    fetchDate: new Date(row.fetch_date),
  };
}

function rowToRecommendation(row: RecommendationRow): Recommendation {
  return {
    id: row.id,
    paperId: row.paper_id,
    channelId: row.channel_id,
    recommendedDate: new Date(row.recommended_date),
  };
}

function rowToFavorite(row: FavoriteRow): Favorite {
  return {
    id: row.id,
    userId: row.user_id,
    paperId: row.paper_id,
    favoritedDate: new Date(row.favorited_date),
  };
}

// ─── Papers ──────────────────────────────────────────────────────────────────

/**
 * Inserts a paper and returns it with the generated `id`.
 * If a paper with the same `openAlexId` already exists the existing record is
 * returned unchanged (idempotent insert).
 */
export function addPaper(paper: Paper, db?: Database.Database): Paper {
  const conn = db ?? getDatabase();

  // Avoid duplicates keyed on openAlexId
  if (paper.openAlexId) {
    const existing = getPaperByOpenAlexId(paper.openAlexId, conn);
    if (existing) return existing;
  }

  const stmt = conn.prepare<[
    string, string, string, string,
    string | null, string | null, string | null,
    number, number | null, string, string
  ]>(`
    INSERT INTO papers
      (title, authors, abstract, url, doi, openalex_id, pdf_url,
       cited_by_count, publication_year, topics, fetch_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    paper.title,
    JSON.stringify(paper.authors),
    paper.abstract,
    paper.url,
    paper.doi ?? null,
    paper.openAlexId ?? null,
    paper.pdfUrl ?? null,
    paper.citedByCount ?? 0,
    paper.publicationYear ?? null,
    JSON.stringify(paper.topics ?? []),
    paper.fetchDate.toISOString(),
  );

  return { ...paper, id: result.lastInsertRowid as number };
}

/** Returns a paper by its primary-key `id`, or `null` if not found. */
export function getPaperById(id: number, db?: Database.Database): Paper | null {
  const conn = db ?? getDatabase();
  const row = conn
    .prepare<[number], PaperRow>('SELECT * FROM papers WHERE id = ?')
    .get(id);
  return row ? rowToPaper(row) : null;
}

/** Returns a paper by its OpenAlex work ID, or `null` if not found. */
export function getPaperByOpenAlexId(
  openAlexId: string,
  db?: Database.Database,
): Paper | null {
  const conn = db ?? getDatabase();
  const row = conn
    .prepare<[string], PaperRow>('SELECT * FROM papers WHERE openalex_id = ?')
    .get(openAlexId);
  return row ? rowToPaper(row) : null;
}

/**
 * Returns `true` when the paper identified by `openAlexId` has already been
 * recommended to the given channel.
 */
export function isPaperRecommended(
  openAlexId: string,
  channelId: string,
  db?: Database.Database,
): boolean {
  const conn = db ?? getDatabase();
  const row = conn
    .prepare<[string, string], { count: number }>(`
      SELECT COUNT(*) AS count
      FROM   recommendations r
      JOIN   papers p ON p.id = r.paper_id
      WHERE  p.openalex_id = ?
      AND    r.channel_id  = ?
    `)
    .get(openAlexId, channelId);
  return (row?.count ?? 0) > 0;
}

/**
 * Returns all papers matching any of the given topic strings (case-insensitive
 * substring match against the stored JSON topics array).
 */
export function getPapersByTopics(
  topics: string[],
  db?: Database.Database,
): Paper[] {
  if (topics.length === 0) return [];
  const conn = db ?? getDatabase();

  // SQLite doesn't have native JSON array filtering without JSON1 extension;
  // using LIKE on the serialised JSON column is portable enough for our needs.
  const conditions = topics.map(() => "LOWER(topics) LIKE '%' || LOWER(?) || '%'").join(' OR ');
  const rows = conn
    .prepare<string[], PaperRow>(`SELECT * FROM papers WHERE ${conditions}`)
    .all(...topics);
  return rows.map(rowToPaper);
}

/**
 * Returns papers with `cited_by_count >= minCitations`, sorted descending by
 * citation count.
 */
export function getPapersByCitationCount(
  minCitations: number,
  db?: Database.Database,
): Paper[] {
  const conn = db ?? getDatabase();
  const rows = conn
    .prepare<[number], PaperRow>(
      'SELECT * FROM papers WHERE cited_by_count >= ? ORDER BY cited_by_count DESC',
    )
    .all(minCitations);
  return rows.map(rowToPaper);
}

// ─── Recommendations ──────────────────────────────────────────────────────────

/**
 * Records a recommendation for a paper in a channel.
 * Returns the created `Recommendation` (with generated `id`).
 */
export function addRecommendation(
  rec: Omit<Recommendation, 'id'>,
  db?: Database.Database,
): Recommendation {
  const conn = db ?? getDatabase();
  const stmt = conn.prepare<[number, string, string]>(`
    INSERT INTO recommendations (paper_id, channel_id, recommended_date)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(
    rec.paperId,
    rec.channelId,
    rec.recommendedDate.toISOString(),
  );
  return { ...rec, id: result.lastInsertRowid as number };
}

/**
 * Returns all recommendations for a given channel, most recent first.
 */
export function getRecommendationsByChannel(
  channelId: string,
  db?: Database.Database,
): Recommendation[] {
  const conn = db ?? getDatabase();
  const rows = conn
    .prepare<[string], RecommendationRow>(
      'SELECT * FROM recommendations WHERE channel_id = ? ORDER BY recommended_date DESC',
    )
    .all(channelId);
  return rows.map(rowToRecommendation);
}

// ─── Favorites ────────────────────────────────────────────────────────────────

/**
 * Saves a paper as a favorite for a user.
 * Returns the created `Favorite` (with generated `id`).
 * Silently ignores duplicates (same user + paper), returning the existing row.
 */
export function addFavorite(
  fav: Omit<Favorite, 'id'>,
  db?: Database.Database,
): Favorite {
  const conn = db ?? getDatabase();

  // Return existing if already favorited
  const existing = conn
    .prepare<[string, number], FavoriteRow>(
      'SELECT * FROM favorites WHERE user_id = ? AND paper_id = ?',
    )
    .get(fav.userId, fav.paperId);
  if (existing) return rowToFavorite(existing);

  const stmt = conn.prepare<[string, number, string]>(`
    INSERT INTO favorites (user_id, paper_id, favorited_date)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(
    fav.userId,
    fav.paperId,
    fav.favoritedDate.toISOString(),
  );
  return { ...fav, id: result.lastInsertRowid as number };
}

/**
 * Removes a favorite. Returns `true` if a row was deleted, `false` otherwise.
 */
export function removeFavorite(
  userId: string,
  paperId: number,
  db?: Database.Database,
): boolean {
  const conn = db ?? getDatabase();
  const result = conn
    .prepare<[string, number]>(
      'DELETE FROM favorites WHERE user_id = ? AND paper_id = ?',
    )
    .run(userId, paperId);
  return result.changes > 0;
}

/**
 * Returns all papers favorited by the given user, most recently added first.
 */
export function getUserFavorites(
  userId: string,
  db?: Database.Database,
): Paper[] {
  const conn = db ?? getDatabase();
  const rows = conn
    .prepare<[string], PaperRow>(`
      SELECT p.*
      FROM   papers p
      JOIN   favorites f ON f.paper_id = p.id
      WHERE  f.user_id = ?
      ORDER  BY f.favorited_date DESC
    `)
    .all(userId);
  return rows.map(rowToPaper);
}

// ─── Message → Paper mapping ──────────────────────────────────────────────────

/**
 * Stores a mapping from a Discord message ID to a paper's DB ID.
 * Called after posting a paper embed so the reaction handler can look it up.
 */
export function addMessagePaper(
  messageId: string,
  paperId: number,
  db?: Database.Database,
): void {
  const conn = db ?? getDatabase();
  conn
    .prepare<[string, number]>(
      'INSERT OR IGNORE INTO message_papers (message_id, paper_id) VALUES (?, ?)',
    )
    .run(messageId, paperId);
}

/**
 * Returns the paper associated with a Discord message ID, or null if not mapped.
 */
export function getPaperByMessageId(
  messageId: string,
  db?: Database.Database,
): Paper | null {
  const conn = db ?? getDatabase();
  const row = conn
    .prepare<[string], PaperRow>(`
      SELECT p.*
      FROM   papers p
      JOIN   message_papers mp ON mp.paper_id = p.id
      WHERE  mp.message_id = ?
    `)
    .get(messageId);
  return row ? rowToPaper(row) : null;
}

// ─── Scheduler config ─────────────────────────────────────────────────────────

export interface SchedulerConfig {
  guildId: string;
  channelId: string;
  cronExpression: string;
  domains: string[];
  papersPerBatch: number;
  enabled: boolean;
  updatedAt: Date;
}

interface SchedulerConfigRow {
  guild_id: string;
  channel_id: string;
  cron_expression: string;
  domains: string;
  papers_per_batch: number;
  enabled: number;
  updated_at: string;
}

function rowToSchedulerConfig(row: SchedulerConfigRow): SchedulerConfig {
  return {
    guildId: row.guild_id,
    channelId: row.channel_id,
    cronExpression: row.cron_expression,
    domains: row.domains.split(',').map((d) => d.trim()).filter(Boolean),
    papersPerBatch: row.papers_per_batch,
    enabled: row.enabled === 1,
    // SQLite datetime('now') stores UTC without a timezone marker.
    // Appending 'Z' makes Date() treat the string as UTC instead of local time.
    updatedAt: new Date(row.updated_at.replace(' ', 'T') + 'Z'),
  };
}

/** Returns the scheduler config for a guild, or null if not configured. */
export function getSchedulerConfig(
  guildId: string,
  db?: Database.Database,
): SchedulerConfig | null {
  const conn = db ?? getDatabase();
  const row = conn
    .prepare<[string], SchedulerConfigRow>(
      'SELECT * FROM scheduler_config WHERE guild_id = ?',
    )
    .get(guildId);
  return row ? rowToSchedulerConfig(row) : null;
}

/** Returns all guilds with an enabled scheduler. */
export function getAllEnabledSchedulerConfigs(
  db?: Database.Database,
): SchedulerConfig[] {
  const conn = db ?? getDatabase();
  const rows = conn
    .prepare<[], SchedulerConfigRow>(
      'SELECT * FROM scheduler_config WHERE enabled = 1',
    )
    .all();
  return rows.map(rowToSchedulerConfig);
}

/**
 * Inserts or updates the scheduler config for a guild.
 * Only the caller-supplied fields are written; the rest keep their defaults.
 */
export function upsertSchedulerConfig(
  cfg: Omit<SchedulerConfig, 'updatedAt'>,
  db?: Database.Database,
): SchedulerConfig {
  const conn = db ?? getDatabase();
  conn
    .prepare<[string, string, string, string, number, number]>(`
      INSERT INTO scheduler_config
        (guild_id, channel_id, cron_expression, domains, papers_per_batch, enabled, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(guild_id) DO UPDATE SET
        channel_id       = excluded.channel_id,
        cron_expression  = excluded.cron_expression,
        domains          = excluded.domains,
        papers_per_batch = excluded.papers_per_batch,
        enabled          = excluded.enabled,
        updated_at       = datetime('now')
    `)
    .run(
      cfg.guildId,
      cfg.channelId,
      cfg.cronExpression,
      cfg.domains.join(','),
      cfg.papersPerBatch,
      cfg.enabled ? 1 : 0,
    );
  return getSchedulerConfig(cfg.guildId, conn)!;
}

/** Toggles only the `enabled` flag without touching other settings. */
export function setSchedulerEnabled(
  guildId: string,
  enabled: boolean,
  db?: Database.Database,
): boolean {
  const conn = db ?? getDatabase();
  const info = conn
    .prepare<[number, string]>(
      "UPDATE scheduler_config SET enabled = ?, updated_at = datetime('now') WHERE guild_id = ?",
    )
    .run(enabled ? 1 : 0, guildId);
  return info.changes > 0;
}
