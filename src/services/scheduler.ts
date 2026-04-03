import cron, { ScheduledTask } from 'node-cron';
import { Client, TextChannel } from 'discord.js';
import logger from '../utils/logger';
import {
  getSchedulerConfig,
  getAllEnabledSchedulerConfigs,
  addPaper,
  addRecommendation,
  addMessagePaper,
  isPaperRecommended,
} from '../database/operations';
import { OpenAlexFetcher } from './openAlexFetcher';
import { CopilotSummarizer } from './copilotSummarizer';
import { fetchPdfText } from '../utils/pdfFetcher';
import { buildPaperEmbed } from '../commands/fetch';
import type { Paper } from '../models/types';

// ─── Active task registry ─────────────────────────────────────────────────────

/** Maps guild_id → active cron task so we can start/stop per guild. */
const activeTasks = new Map<string, ScheduledTask>();

// ─── Core job ─────────────────────────────────────────────────────────────────

/**
 * Runs the scheduled fetch-summarize-post pipeline for a single guild.
 * For each configured domain it fetches up to `papersPerBatch` unseen papers,
 * summarizes them with Copilot, and sends the embeds to the target channel.
 */
export async function runScheduledJob(client: Client, guildId: string): Promise<void> {
  const cfg = getSchedulerConfig(guildId);
  if (!cfg || !cfg.enabled) return;

  let channel;
  try {
    channel = await client.channels.fetch(cfg.channelId);
  } catch {
    logger.warn(`Scheduler: cannot fetch channel ${cfg.channelId} for guild ${guildId}`);
    return;
  }

  if (!channel || !channel.isTextBased()) {
    logger.warn(`Scheduler: channel ${cfg.channelId} is not a text channel (guild ${guildId})`);
    return;
  }

  const textChannel = channel as TextChannel;
  logger.info(`Scheduler: starting job for guild ${guildId} (${cfg.domains.length} domain(s))`);

  for (const domain of cfg.domains) {
    try {
      // ── Fetch candidates ──────────────────────────────────────────────────
      const fetcher = new OpenAlexFetcher();
      const candidates = await fetcher.fetchPapers(
        { keywords: domain, perPage: 200 },
        200,
      );

      const unseen = candidates.filter(
        (p) =>
          p.authors.length > 0 &&
          (!p.openAlexId || !isPaperRecommended(p.openAlexId, cfg.channelId)),
      );

      // Fisher-Yates shuffle so we don't always surface the same BM25-top papers
      for (let i = unseen.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [unseen[i], unseen[j]] = [unseen[j], unseen[i]];
      }

      const papers = unseen.slice(0, cfg.papersPerBatch);
      if (papers.length === 0) {
        logger.info(`Scheduler: no new papers for domain "${domain}" (guild ${guildId})`);
        continue;
      }

      // ── PDF text (best-effort) ────────────────────────────────────────────
      const pdfTexts = await Promise.all(papers.map((p) => fetchPdfText(p.pdfUrl)));
      const papersWithText = papers.map((paper, i) => ({ paper, fullText: pdfTexts[i] }));

      // ── Summarize ─────────────────────────────────────────────────────────
      const summarizer = new CopilotSummarizer();
      let results: Array<{ paper: Paper; summary: string }> = [];
      try {
        results = await summarizer.summarizePapers(papersWithText);
      } finally {
        await summarizer.shutdown();
      }

      if (results.length === 0) {
        logger.warn(`Scheduler: no summaries generated for domain "${domain}" (guild ${guildId})`);
        continue;
      }

      // ── Persist & post ────────────────────────────────────────────────────
      const date = new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      });
      await textChannel.send(
        `📅 **Daily Papers — ${domain}** (${date})`,
      );

      const savedPapers = new Map<string, number>();
      for (const { paper } of results) {
        const saved = addPaper(paper);
        if (saved.id !== undefined) {
          addRecommendation({
            paperId: saved.id,
            channelId: cfg.channelId,
            recommendedDate: new Date(),
          });
          if (saved.openAlexId) savedPapers.set(saved.openAlexId, saved.id);
        }
      }

      for (const { paper, summary } of results) {
        const embed = buildPaperEmbed(paper, summary);
        const msg = await textChannel.send({ embeds: [embed] });
        const dbId = paper.openAlexId ? savedPapers.get(paper.openAlexId) : undefined;
        if (dbId !== undefined) addMessagePaper(msg.id, dbId);
      }

      logger.info(
        `Scheduler: posted ${results.length} paper(s) for domain "${domain}" (guild ${guildId})`,
      );
    } catch (err) {
      logger.error(
        `Scheduler: error processing domain "${domain}" for guild ${guildId}`,
        { err },
      );
    }
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

/**
 * Starts (or restarts) the cron task for a single guild.
 * Reads the latest config from the database, so calling this after an update
 * will automatically pick up the new cron expression / settings.
 */
export function startGuildScheduler(client: Client, guildId: string): void {
  stopGuildScheduler(guildId); // cancel any existing task first

  const cfg = getSchedulerConfig(guildId);
  if (!cfg || !cfg.enabled) return;

  if (!cron.validate(cfg.cronExpression)) {
    logger.error(`Scheduler: invalid cron expression "${cfg.cronExpression}" for guild ${guildId}`);
    return;
  }

  const task = cron.schedule(cfg.cronExpression, () => {
    runScheduledJob(client, guildId).catch((err) => {
      logger.error(`Scheduler: unhandled error in job for guild ${guildId}`, { err });
    });
  });

  activeTasks.set(guildId, task);
  logger.info(`Scheduler: started for guild ${guildId} with cron "${cfg.cronExpression}"`);
}

/** Stops and removes the cron task for a guild (no-op if not running). */
export function stopGuildScheduler(guildId: string): void {
  const task = activeTasks.get(guildId);
  if (task) {
    task.stop();
    activeTasks.delete(guildId);
    logger.info(`Scheduler: stopped for guild ${guildId}`);
  }
}

/** Returns true if there is an active cron task for the given guild. */
export function isGuildSchedulerRunning(guildId: string): boolean {
  return activeTasks.has(guildId);
}

/**
 * Called once at bot startup — restores all enabled guild schedulers from the DB.
 */
export function initScheduler(client: Client): void {
  const configs = getAllEnabledSchedulerConfigs();
  for (const cfg of configs) {
    startGuildScheduler(client, cfg.guildId);
  }
  logger.info(`Scheduler: initialised — ${activeTasks.size} guild scheduler(s) active`);
}
