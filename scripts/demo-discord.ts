/**
 * End-to-end demo: fetch papers from OpenAlex, summarize with Copilot,
 * and post them to a Discord channel.
 *
 * Usage:
 *   npx ts-node scripts/demo-discord.ts
 *
 * Required .env variables:
 *   DISCORD_TOKEN            — your bot token
 *   DISCORD_TEST_CHANNEL_ID  — ID of the channel to post into
 *   GITHUB_TOKEN             — fine-grained PAT for Copilot summarization
 *
 * Optional:
 *   DEMO_KEYWORDS  — search query  (default: "large language models")
 *   DEMO_COUNT     — number of papers (default: 3)
 */

import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  TextChannel,
  Colors,
} from 'discord.js';
import dotenv from 'dotenv';
import OpenAlexFetcher from '../src/services/openAlexFetcher';
import CopilotSummarizer from '../src/services/copilotSummarizer';
import { Paper } from '../src/models/types';

dotenv.config();

// ─── Config ───────────────────────────────────────────────────────────────────

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.DISCORD_TEST_CHANNEL_ID;
const KEYWORDS = process.env.DEMO_KEYWORDS || 'large language models';
const COUNT = parseInt(process.env.DEMO_COUNT || '3', 10);

if (!DISCORD_TOKEN || !CHANNEL_ID || CHANNEL_ID === 'your_channel_id_here') {
  console.error(
    '❌  Set DISCORD_TOKEN and DISCORD_TEST_CHANNEL_ID in your .env file.\n' +
    '   To get a channel ID: Discord → Settings → Advanced → enable Developer Mode,\n' +
    '   then right-click the channel → Copy Channel ID.',
  );
  process.exit(1);
}

// ─── Paper → Discord Embed ────────────────────────────────────────────────────

function paperToEmbed(paper: Paper, index: number, summary?: string): EmbedBuilder {
  const authors =
    paper.authors.length > 3
      ? `${paper.authors.slice(0, 3).join(', ')} et al.`
      : paper.authors.join(', ');

  // Use the Copilot summary as the description when available;
  // otherwise fall back to a truncated abstract.
  const description = summary
    ? summary
    : paper.abstract
    ? paper.abstract.length > 400
      ? `${paper.abstract.slice(0, 400)}…`
      : paper.abstract
    : '*No abstract available.*';

  const embed = new EmbedBuilder()
    .setTitle(`[${index}] ${paper.title}`)
    .setURL(paper.url)
    .setDescription(description)
    .setColor(summary ? Colors.Green : Colors.Blurple)
    .addFields(
      { name: '👥 Authors', value: authors || 'N/A', inline: true },
      { name: '📅 Year', value: String(paper.publicationYear ?? 'N/A'), inline: true },
      { name: '📊 Citations', value: String(paper.citedByCount ?? 0), inline: true },
    )
    .setTimestamp();

  if (paper.topics && paper.topics.length > 0) {
    embed.addFields({
      name: '🏷️ Topics',
      value: paper.topics.slice(0, 4).join(', '),
    });
  }

  const footerParts: string[] = [];
  if (summary) footerParts.push('✨ Summarized by GitHub Copilot');
  if (paper.doi) footerParts.push(`DOI: ${paper.doi}`);
  if (footerParts.length > 0) embed.setFooter({ text: footerParts.join('  •  ') });

  return embed;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user?.tag}`);

  const channel = await client.channels.fetch(CHANNEL_ID!);
  if (!channel || !(channel instanceof TextChannel)) {
    console.error(`❌  Channel ${CHANNEL_ID} not found or is not a text channel.`);
    await client.destroy();
    process.exit(1);
  }

  // ── Fetch papers ────────────────────────────────────────────────────────────
  console.log(`\nFetching ${COUNT} papers for "${KEYWORDS}"…`);
  const fetcher = new OpenAlexFetcher();
  const papers = await fetcher.fetchPapers(
    { keywords: KEYWORDS, yearFrom: 2022, minCitations: 5 },
    COUNT,
  );

  if (papers.length === 0) {
    await channel.send('🔍 No papers found for the given query.');
    await client.destroy();
    return;
  }

  // ── Summarize papers with Copilot ───────────────────────────────────────────
  console.log(`\nSummarizing ${papers.length} paper(s) with GitHub Copilot…`);
  const summarizer = new CopilotSummarizer();
  const summaryMap = new Map<string, string>();

  for (let i = 0; i < papers.length; i++) {
    const paper = papers[i];
    process.stdout.write(`  Summarizing [${i + 1}/${papers.length}] ${paper.title}… `);
    try {
      const summary = await summarizer.summarizePaper(paper);
      summaryMap.set(paper.openAlexId ?? paper.title, summary);
      console.log('✅');
    } catch {
      console.log('⚠️  skipped (will use abstract)');
    }
  }

  await summarizer.shutdown();

  // ── Header message ──────────────────────────────────────────────────────────
  await channel.send(
    `📚 **Research Paper Demo** — top **${papers.length}** results for \`${KEYWORDS}\` ✨ *AI-summarized by GitHub Copilot*`,
  );

  // ── Post each paper as an embed ─────────────────────────────────────────────
  for (let i = 0; i < papers.length; i++) {
    const paper = papers[i];
    const summary = summaryMap.get(paper.openAlexId ?? paper.title);
    const embed = paperToEmbed(paper, i + 1, summary);
    await channel.send({ embeds: [embed] });
    console.log(`  Posted [${i + 1}/${papers.length}] ${paper.title}`);
  }

  console.log('\n✅ Done! Check your Discord channel.');
  await client.destroy();
});

client.on('error', (err) => {
  console.error('Discord client error:', err);
});

client.login(DISCORD_TOKEN).catch((err) => {
  console.error('❌  Failed to log in to Discord:', err.message);
  process.exit(1);
});
