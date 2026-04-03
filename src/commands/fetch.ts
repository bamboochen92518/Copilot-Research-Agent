import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import type { Command } from './types';
import { OpenAlexFetcher } from '../services/openAlexFetcher';
import { CopilotSummarizer } from '../services/copilotSummarizer';
import { addPaper, addRecommendation, addMessagePaper, isPaperRecommended } from '../database/operations';
import { config } from '../config/config';
import { fetchPdfText } from '../utils/pdfFetcher';
import logger from '../utils/logger';
import type { Paper } from '../models/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a rich Discord embed for a single paper + its AI-generated summary.
 * The summary already contains attribution metadata (authors, year, DOI) from
 * `formatSummaryForDiscord`, so the embed itself stays clean.
 */
export function buildPaperEmbed(paper: Paper, summary: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(paper.title.slice(0, 256))
    .setColor(0x5865f2)
    .setDescription(summary.slice(0, 4096))
    .setFooter({ text: 'React with ⭐ to save to favorites  •  Source: OpenAlex' })
    .setTimestamp();

  if (paper.url) {
    embed.setURL(paper.url);
  }

  if (paper.pdfUrl) {
    embed.addFields({
      name: '📄 Full PDF',
      value: `[Open PDF](${paper.pdfUrl})`,
      inline: true,
    });
  }

  return embed;
}

// ─── Command definition ───────────────────────────────────────────────────────

const fetchCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('fetch')
    .setDescription('Fetch and summarize academic papers from OpenAlex')
    .addIntegerOption((opt) =>
      opt
        .setName('count')
        .setDescription('Number of papers to fetch (1–10, default 5)')
        .setMinValue(1)
        .setMaxValue(10),
    )
    .addStringOption((opt) =>
      opt
        .setName('domain')
        .setDescription(
          'Research domain or keywords (e.g. "machine learning", "quantum computing")',
        ),
    )
    .addIntegerOption((opt) =>
      opt
        .setName('start_year')
        .setDescription('Only include papers published on or after this year (e.g. 2020)')
        .setMinValue(1900)
        .setMaxValue(2100),
    )
    .addIntegerOption((opt) =>
      opt
        .setName('end_year')
        .setDescription('Only include papers published on or before this year (default: no upper limit)')
        .setMinValue(1900)
        .setMaxValue(2100),
    )
    .addIntegerOption((opt) =>
      opt
        .setName('min_citations')
        .setDescription('Only include papers with at least this many citations (e.g. 50)')
        .setMinValue(0),
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const count = interaction.options.getInteger('count') ?? 5;
    const domain =
      interaction.options.getString('domain') ??
      config.paper.defaultTopics[0] ??
      'artificial intelligence';
    const startYear = interaction.options.getInteger('start_year') ?? undefined;
    const endYear = interaction.options.getInteger('end_year') ?? undefined;
    const minCitations = interaction.options.getInteger('min_citations') ?? undefined;

    // Defer reply – fetching + summarizing can take 10–30 s
    await interaction.deferReply();

    try {
      // ── Step 1: Fetch papers ──────────────────────────────────────────────
      // Fetch 200 candidates in a single API call (perPage=200) to minimise
      // round-trips. After filtering seen papers we shuffle so repeated queries
      // surface different papers instead of always the same BM25-top results.
      const fetcher = new OpenAlexFetcher();
      const channelId = interaction.channelId;
      const candidates = await fetcher.fetchPapers(
        { keywords: domain, yearFrom: startYear, yearTo: endYear, minCitations, perPage: 200 },
        200,
      );

      // Filter out papers already recommended to this channel and papers with
      // no authors (typically conference proceedings headers, editorial notes, etc.)
      const unseen = candidates.filter(
        (p) =>
          p.authors.length > 0 &&
          (!p.openAlexId || !isPaperRecommended(p.openAlexId, channelId)),
      );
      // Fisher-Yates shuffle for uniform random sampling
      for (let i = unseen.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [unseen[i], unseen[j]] = [unseen[j], unseen[i]];
      }
      const papers = unseen.slice(0, count);

      const skipped = candidates.length - unseen.length;

      if (papers.length === 0) {
        const yearClause = startYear
          ? ` (${startYear}–${endYear ?? 'present'})`
          : '';
        const hint = skipped > 0
          ? ' All recent results have already been recommended in this channel.'
          : ' Try different keywords or a wider year range.';
        await interaction.editReply(
          `❌ No new papers found for **"${domain}"**${yearClause}.${hint}`,
        );
        return;
      }

      const yearLabel = startYear ? ` (${startYear}–${endYear ?? 'present'})` : '';
      const citationLabel = minCitations ? ` ≥${minCitations} citations` : '';
      const skippedNote = skipped > 0 ? ` (${skipped} already-seen paper(s) skipped)` : '';
      await interaction.editReply(
        `🔍 Found **${papers.length}** new paper(s) for **"${domain}"**${yearLabel}${citationLabel}${skippedNote}. Summarizing with GitHub Copilot…`,
      );

      // ── Step 2: Fetch PDF text in parallel (best-effort) ─────────────────
      const pdfTexts = await Promise.all(
        papers.map((p) => fetchPdfText(p.pdfUrl)),
      );
      const papersWithText = papers.map((paper, i) => ({
        paper,
        fullText: pdfTexts[i],
      }));
      const pdfCount = pdfTexts.filter(Boolean).length;
      if (pdfCount > 0) {
        logger.info(`Downloaded full text for ${pdfCount}/${papers.length} paper(s)`);
      }

      // ── Step 3: Summarize ─────────────────────────────────────────────────
      const summarizer = new CopilotSummarizer();
      let results: Array<{ paper: Paper; summary: string }> = [];
      try {
        results = await summarizer.summarizePapers(papersWithText);
      } finally {
        await summarizer.shutdown();
      }

      if (results.length === 0) {
        await interaction.editReply(
          '❌ Failed to generate summaries. Please try again later.',
        );
        return;
      }

      // ── Step 3: Persist papers + recommendations ──────────────────────────
      const savedPapers = new Map<string, number>(); // openAlexId → db id
      for (const { paper } of results) {
        const saved = addPaper(paper);
        if (saved.id !== undefined) {
          addRecommendation({
            paperId: saved.id,
            channelId,
            recommendedDate: new Date(),
          });
          if (saved.openAlexId) {
            savedPapers.set(saved.openAlexId, saved.id);
          }
        }
      }

      // ── Step 4: Send embeds ───────────────────────────────────────────────
      await interaction.editReply(
        `📚 Here are **${results.length}** paper(s) on **"${domain}"**${yearLabel}${citationLabel}:`,
      );

      for (const { paper, summary } of results) {
        const embed = buildPaperEmbed(paper, summary);
        const msg = await interaction.followUp({ embeds: [embed] });
        // Record message ID → paper ID so the ⭐ reaction handler can look it up
        const dbId = paper.openAlexId ? savedPapers.get(paper.openAlexId) : undefined;
        if (dbId !== undefined) {
          addMessagePaper(msg.id, dbId);
        }
      }
    } catch (error) {
      logger.error('Error in /fetch command', { error });
      const msg = '❌ An error occurred while fetching papers. Please try again.';
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(msg);
      }
    }
  },
};

export default fetchCommand;
