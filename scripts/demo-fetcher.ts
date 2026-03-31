/**
 * Demo script for the OpenAlex paper fetcher.
 *
 * Usage (from the project root):
 *   npx ts-node scripts/demo-fetcher.ts
 *
 * You can edit the DEMO_OPTIONS constant below to try different searches.
 */

import OpenAlexFetcher from '../src/services/openAlexFetcher';
import { config } from '../src/config/config';

// ─── Demo configuration ───────────────────────────────────────────────────────

const DEMO_OPTIONS = {
  keywords: 'large language models',
  yearFrom: 2023,
  minCitations: 5,
  // Uncomment to filter by topic IDs (OpenAlex format: "T" + number):
  // topicIds: ['T11413'],
};

const MAX_RESULTS = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(text: string, maxLen = 200): string {
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

function formatPaper(paper: ReturnType<typeof Object.assign>, index: number): string {
  const lines: string[] = [
    `\n──────────────────────────────────────────`,
    `[${index + 1}] ${paper.title}`,
    `    Authors : ${paper.authors.slice(0, 3).join(', ')}${paper.authors.length > 3 ? ' et al.' : ''}`,
    `    Year    : ${paper.publicationYear ?? 'N/A'}`,
    `    DOI     : ${paper.doi ?? 'N/A'}`,
    `    Cited   : ${paper.citedByCount ?? 0}`,
    `    Topics  : ${(paper.topics ?? []).slice(0, 3).join(', ') || 'N/A'}`,
    `    URL     : ${paper.url}`,
  ];

  if (paper.abstract) {
    lines.push(`    Abstract: ${truncate(paper.abstract)}`);
  }

  return lines.join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('OpenAlex Paper Fetcher – Demo');
  console.log('==============================');
  console.log('Search options:', JSON.stringify(DEMO_OPTIONS, null, 2));
  console.log(`Fetching up to ${MAX_RESULTS} papers…\n`);

  if (!config.openAlex.email) {
    console.warn(
      'Tip: set OPENALEX_EMAIL in your .env to join the polite pool for better API reliability.',
    );
  }

  const fetcher = new OpenAlexFetcher();

  try {
    const papers = await fetcher.fetchPapers(DEMO_OPTIONS, MAX_RESULTS);

    if (papers.length === 0) {
      console.log('No papers found for the given filters.');
      return;
    }

    console.log(`Found ${papers.length} paper(s):`);
    papers.forEach((paper, i) => console.log(formatPaper(paper, i)));

    console.log('\n──────────────────────────────────────────');
    console.log(`Done. ${papers.length} paper(s) displayed.`);
  } catch (err) {
    console.error('Failed to fetch papers:', err);
    process.exit(1);
  }
}

main();
