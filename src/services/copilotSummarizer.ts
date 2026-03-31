import { CopilotClient, approveAll } from '@github/copilot-sdk';
import { Paper } from '../models/types';
import { config } from '../config/config';
import logger from '../utils/logger';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum characters of abstract text to include in the prompt. */
const MAX_ABSTRACT_CHARS = 800;

/** Maximum characters for the author list in the prompt. */
const MAX_AUTHORS_CHARS = 120;

/** Retry configuration for transient API errors. */
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

/**
 * Builds the prompt sent to GitHub Copilot for a given paper.
 * Kept concise to stay within token limits while covering all key aspects.
 */
export function buildSummarizationPrompt(paper: Paper): string {
  const authors = truncate(paper.authors.join(', '), MAX_AUTHORS_CHARS);
  const abstract = paper.abstract
    ? truncate(paper.abstract, MAX_ABSTRACT_CHARS)
    : '(no abstract available)';

  const meta: string[] = [];
  if (paper.publicationYear) meta.push(`Year: ${paper.publicationYear}`);
  if (paper.citedByCount !== undefined) meta.push(`Citations: ${paper.citedByCount}`);
  if (paper.doi) meta.push(`DOI: ${paper.doi}`);
  if (paper.topics && paper.topics.length > 0) {
    meta.push(`Topics: ${paper.topics.slice(0, 3).join(', ')}`);
  }

  return `You are a research assistant helping Discord users discover academic papers.
Summarize the following paper in Discord-flavored Markdown.

Use EXACTLY this structure (keep all bold headers):

**🔑 Key Findings:**
(2–3 bullet points with the most important findings)

**🔬 Methodology:**
(1–2 sentences on how the research was conducted)

**💡 Conclusions:**
(1–2 sentences on the main takeaways and implications)

Rules:
- Be concise; the entire summary must fit comfortably in a Discord message.
- Do NOT repeat the paper title or authors — those are shown separately.
- Do NOT add any preamble or closing remarks outside the three sections.

---
Title: ${paper.title}
Authors: ${authors}
${meta.join(' | ')}

Abstract:
${abstract}`;
}

/**
 * Formats a raw Copilot summary + paper metadata into the final Discord embed
 * description string.
 */
export function formatSummaryForDiscord(paper: Paper, rawSummary: string): string {
  const lines: string[] = [];

  // Attribution line
  const attrParts: string[] = [];
  if (paper.authors.length > 0) {
    const authorStr =
      paper.authors.length > 3
        ? `${paper.authors.slice(0, 3).join(', ')} et al.`
        : paper.authors.join(', ');
    attrParts.push(`👥 ${authorStr}`);
  }
  if (paper.publicationYear) attrParts.push(`📅 ${paper.publicationYear}`);
  if (paper.citedByCount !== undefined) attrParts.push(`📊 ${paper.citedByCount} citations`);
  if (attrParts.length > 0) lines.push(attrParts.join('  |  '));

  // DOI / link
  if (paper.doi) lines.push(`🔗 https://doi.org/${paper.doi}`);

  lines.push(''); // blank line separator
  lines.push(rawSummary.trim());

  return lines.join('\n');
}

// ─── Main service class ───────────────────────────────────────────────────────

/**
 * Wraps the GitHub Copilot SDK to summarize academic papers.
 *
 * Authentication is handled automatically by the SDK:
 * the `GITHUB_TOKEN` environment variable is read and used to access Copilot.
 * A GitHub Copilot subscription (Individual, Business, or Enterprise) is
 * required for the account associated with the token.
 *
 * @example
 * ```ts
 * const summarizer = new CopilotSummarizer();
 * const summary = await summarizer.summarizePaper(paper);
 * await summarizer.shutdown();
 * ```
 */
export class CopilotSummarizer {
  private readonly client: CopilotClient;
  private readonly model: string;

  constructor() {
    if (!config.github.token) {
      logger.warn(
        'GITHUB_TOKEN is not set. The Copilot SDK may fall back to interactive CLI login.',
      );
    }

    // The SDK automatically picks up GITHUB_TOKEN from the environment.
    // Passing useLoggedInUser: false ensures we rely only on the token and
    // never block waiting for an interactive login prompt in a bot context.
    this.client = new CopilotClient({ useLoggedInUser: false });
    this.model = config.github.model;
  }

  /**
   * Summarizes a single paper using GitHub Copilot.
   * Retries up to `MAX_RETRIES` times with exponential backoff on error.
   *
   * @returns Discord-formatted summary string.
   */
  async summarizePaper(paper: Paper): Promise<string> {
    const prompt = buildSummarizationPrompt(paper);
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const rawSummary = await this._callCopilot(prompt);
        const formatted = formatSummaryForDiscord(paper, rawSummary);
        logger.info('Summarized paper', { title: paper.title });
        return formatted;
      } catch (err) {
        lastError = err;
        logger.warn(`Copilot summarization attempt ${attempt} failed`, { err });
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
        }
      }
    }

    logger.error('All summarization attempts failed', { lastError });
    throw lastError;
  }

  /**
   * Summarizes multiple papers in sequence (to avoid hammering the API).
   * Papers that fail individually are skipped (error logged); others continue.
   *
   * @returns Array of `{ paper, summary }` for successful summarizations only.
   */
  async summarizePapers(
    papers: Paper[],
  ): Promise<Array<{ paper: Paper; summary: string }>> {
    const results: Array<{ paper: Paper; summary: string }> = [];

    for (const paper of papers) {
      try {
        const summary = await this.summarizePaper(paper);
        results.push({ paper, summary });
      } catch (err) {
        logger.error('Skipping paper due to summarization error', {
          title: paper.title,
          err,
        });
      }
    }

    return results;
  }

  /**
   * Stops the underlying Copilot CLI process.
   * Call this during bot shutdown to release resources.
   */
  async shutdown(): Promise<void> {
    await this.client.stop();
    logger.info('CopilotSummarizer shut down');
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private async _callCopilot(prompt: string): Promise<string> {
    const session = await this.client.createSession({ model: this.model, onPermissionRequest: approveAll });
    const response = await session.sendAndWait({ prompt });

    if (!response?.data?.content) {
      throw new Error('Copilot returned an empty response');
    }

    return response.data.content as string;
  }
}

export default CopilotSummarizer;
