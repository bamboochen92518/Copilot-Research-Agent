import {
  CopilotSummarizer,
  buildSummarizationPrompt,
  formatSummaryForDiscord,
} from '../../src/services/copilotSummarizer';
import { Paper } from '../../src/models/types';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock the entire SDK so tests never spawn a real CLI process
const mockSendAndWait = jest.fn();
const mockCreateSession = jest.fn();
const mockStop = jest.fn();

jest.mock('@github/copilot-sdk', () => ({
  CopilotClient: jest.fn().mockImplementation(() => ({
    createSession: mockCreateSession,
    stop: mockStop,
  })),
  approveAll: jest.fn(),
}));

jest.mock('../../src/config/config', () => ({
  config: {
    github: { token: 'github_pat_test_token', model: 'gpt-4.1' },
  },
}));

jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makePaper = (overrides: Partial<Paper> = {}): Paper => ({
  title: 'Attention Is All You Need',
  authors: ['Vaswani', 'Shazeer', 'Parmar', 'Uszkoreit'],
  abstract: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks.',
  url: 'https://arxiv.org/abs/1706.03762',
  doi: '10.48550/arXiv.1706.03762',
  openAlexId: 'W2963403034',
  pdfUrl: 'https://arxiv.org/pdf/1706.03762',
  citedByCount: 95000,
  publicationYear: 2017,
  topics: ['Transformers', 'NLP', 'Deep Learning'],
  fetchDate: new Date('2026-01-01'),
  ...overrides,
});

const MOCK_RAW_SUMMARY = `**🔑 Key Findings:**
- Introduced the Transformer architecture relying entirely on attention mechanisms.
- Achieved state-of-the-art on WMT 2014 English-to-German translation.
- Trained significantly faster than recurrent baselines.

**🔬 Methodology:**
Replaced recurrence with multi-head self-attention and positional encodings.

**💡 Conclusions:**
Attention-only models are sufficient for sequence transduction and generalize well.`;

// ─── buildSummarizationPrompt ─────────────────────────────────────────────────

describe('buildSummarizationPrompt', () => {
  it('includes the paper title', () => {
    const prompt = buildSummarizationPrompt(makePaper());
    expect(prompt).toContain('Attention Is All You Need');
  });

  it('includes the authors', () => {
    const prompt = buildSummarizationPrompt(makePaper());
    expect(prompt).toContain('Vaswani');
  });

  it('includes the abstract', () => {
    const prompt = buildSummarizationPrompt(makePaper());
    expect(prompt).toContain('dominant sequence transduction');
  });

  it('includes year, citations, DOI and topics', () => {
    const prompt = buildSummarizationPrompt(makePaper());
    expect(prompt).toContain('Year: 2017');
    expect(prompt).toContain('Citations: 95000');
    expect(prompt).toContain('DOI: 10.48550/arXiv.1706.03762');
    expect(prompt).toContain('Topics:');
  });

  it('includes full abstract without truncation', () => {
    const longAbstract = 'x'.repeat(2000);
    const prompt = buildSummarizationPrompt(makePaper({ abstract: longAbstract }));
    // No truncation — full abstract should appear
    expect(prompt).toContain(longAbstract);
  });

  it('truncates a very long author list', () => {
    const manyAuthors = Array.from({ length: 30 }, (_, i) => `Author${i}`);
    const prompt = buildSummarizationPrompt(makePaper({ authors: manyAuthors }));
    expect(prompt).toContain('…');
  });

  it('handles missing abstract gracefully', () => {
    const prompt = buildSummarizationPrompt(makePaper({ abstract: '' }));
    expect(prompt).toContain('(no abstract available)');
  });

  it('omits meta fields when undefined', () => {
    const prompt = buildSummarizationPrompt(
      makePaper({ publicationYear: undefined, citedByCount: undefined, doi: undefined }),
    );
    expect(prompt).not.toContain('Year:');
    expect(prompt).not.toContain('Citations:');
    expect(prompt).not.toContain('DOI:');
  });

  it('limits topics to 3 in the prompt', () => {
    const paper = makePaper({ topics: ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'] });
    const prompt = buildSummarizationPrompt(paper);
    expect(prompt).toContain('Topics: Alpha, Beta, Gamma');
    expect(prompt).not.toContain('Delta');
  });
});

// ─── formatSummaryForDiscord ──────────────────────────────────────────────────

describe('formatSummaryForDiscord', () => {
  it('includes author attribution', () => {
    const result = formatSummaryForDiscord(makePaper(), MOCK_RAW_SUMMARY);
    expect(result).toContain('Vaswani');
  });

  it('shows "et al." when more than 3 authors', () => {
    const result = formatSummaryForDiscord(makePaper(), MOCK_RAW_SUMMARY);
    expect(result).toContain('et al.');
  });

  it('lists authors directly when 3 or fewer', () => {
    const paper = makePaper({ authors: ['Alice', 'Bob'] });
    const result = formatSummaryForDiscord(paper, MOCK_RAW_SUMMARY);
    expect(result).toContain('Alice');
    expect(result).toContain('Bob');
    expect(result).not.toContain('et al.');
  });

  it('includes year and citations in the attribution line', () => {
    const result = formatSummaryForDiscord(makePaper(), MOCK_RAW_SUMMARY);
    expect(result).toContain('2017');
    expect(result).toContain('95000 citations');
  });

  it('includes a DOI link', () => {
    const result = formatSummaryForDiscord(makePaper(), MOCK_RAW_SUMMARY);
    expect(result).toContain('https://doi.org/10.48550/arXiv.1706.03762');
  });

  it('includes the raw summary content', () => {
    const result = formatSummaryForDiscord(makePaper(), MOCK_RAW_SUMMARY);
    expect(result).toContain('**🔑 Key Findings:**');
    expect(result).toContain('**🔬 Methodology:**');
    expect(result).toContain('**💡 Conclusions:**');
  });

  it('trims surrounding whitespace from the raw summary', () => {
    const result = formatSummaryForDiscord(makePaper(), `\n  ${MOCK_RAW_SUMMARY}  \n`);
    // The trimmed summary should not have a leading newline+spaces before the first **
    const summaryPart = result.split('\n\n').pop() ?? '';
    expect(summaryPart.startsWith('**')).toBe(true);
  });

  it('omits DOI link when doi is undefined', () => {
    const result = formatSummaryForDiscord(makePaper({ doi: undefined }), MOCK_RAW_SUMMARY);
    expect(result).not.toContain('https://doi.org/');
  });

  it('handles missing authors array gracefully', () => {
    // Empty author list should not crash and should omit the attribution line
    const result = formatSummaryForDiscord(makePaper({ authors: [] }), MOCK_RAW_SUMMARY);
    expect(result).toContain('**🔑 Key Findings:**');
  });
});

// ─── CopilotSummarizer ────────────────────────────────────────────────────────

describe('CopilotSummarizer', () => {
  let summarizer: CopilotSummarizer;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateSession.mockResolvedValue({ sendAndWait: mockSendAndWait });
    mockSendAndWait.mockResolvedValue({ data: { content: MOCK_RAW_SUMMARY } });
    summarizer = new CopilotSummarizer();
  });

  afterEach(async () => {
    mockStop.mockResolvedValue(undefined);
    await summarizer.shutdown();
  });

  // ── summarizePaper ─────────────────────────────────────────────────────────

  describe('summarizePaper', () => {
    it('returns a formatted summary string', async () => {
      const result = await summarizer.summarizePaper(makePaper());
      expect(result).toContain('**🔑 Key Findings:**');
      expect(typeof result).toBe('string');
    });

    it('calls createSession with the configured model', async () => {
      await summarizer.summarizePaper(makePaper());
      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-4.1' }),
      );
    });

    it('calls sendAndWait with the built prompt', async () => {
      const paper = makePaper();
      await summarizer.summarizePaper(paper);
      const { prompt } = mockSendAndWait.mock.calls[0][0];
      expect(prompt).toContain(paper.title);
    });

    it('retries on error and eventually succeeds', async () => {
      mockSendAndWait
        .mockRejectedValueOnce(new Error('transient'))
        .mockRejectedValueOnce(new Error('transient'))
        .mockResolvedValueOnce({ data: { content: MOCK_RAW_SUMMARY } });

      const result = await summarizer.summarizePaper(makePaper());
      expect(result).toContain('**🔑 Key Findings:**');
      expect(mockSendAndWait).toHaveBeenCalledTimes(3);
    });

    it('throws after MAX_RETRIES consecutive failures', async () => {
      mockSendAndWait.mockRejectedValue(new Error('persistent error'));
      await expect(summarizer.summarizePaper(makePaper())).rejects.toThrow('persistent error');
      expect(mockSendAndWait).toHaveBeenCalledTimes(3);
    });

    it('throws when Copilot returns an empty response', async () => {
      mockSendAndWait.mockResolvedValue({ data: { content: '' } });
      await expect(summarizer.summarizePaper(makePaper())).rejects.toThrow(
        'Copilot returned an empty response',
      );
    });

    it('throws when Copilot returns null', async () => {
      mockSendAndWait.mockResolvedValue(null);
      await expect(summarizer.summarizePaper(makePaper())).rejects.toThrow();
    });
  });

  // ── summarizePapers ────────────────────────────────────────────────────────

  describe('summarizePapers', () => {
    it('returns summaries for all papers on success', async () => {
      const papers = [
        { paper: makePaper({ openAlexId: 'W1' }) },
        { paper: makePaper({ openAlexId: 'W2' }) },
      ];
      const results = await summarizer.summarizePapers(papers);
      expect(results).toHaveLength(2);
      results.forEach((r) => expect(r.summary).toContain('**🔑 Key Findings:**'));
    });

    it('skips a paper that fails and continues with the rest', async () => {
      mockSendAndWait
        .mockRejectedValueOnce(new Error('boom'))   // first paper: 3 retries fail
        .mockRejectedValueOnce(new Error('boom'))
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValue({ data: { content: MOCK_RAW_SUMMARY } }); // second paper: ok

      const papers = [
        { paper: makePaper({ openAlexId: 'W1', title: 'Bad Paper' }) },
        { paper: makePaper({ openAlexId: 'W2', title: 'Good Paper' }) },
      ];
      const results = await summarizer.summarizePapers(papers);
      expect(results).toHaveLength(1);
      expect(results[0].paper.title).toBe('Good Paper');
    });

    it('returns empty array when all papers fail', async () => {
      mockSendAndWait.mockRejectedValue(new Error('all fail'));
      const results = await summarizer.summarizePapers([{ paper: makePaper() }]);
      expect(results).toHaveLength(0);
    });

    it('returns empty array for empty input', async () => {
      const results = await summarizer.summarizePapers([] as never[]);
      expect(results).toHaveLength(0);
    });
  });

  // ── shutdown ───────────────────────────────────────────────────────────────

  describe('shutdown', () => {
    it('calls client.stop()', async () => {
      mockStop.mockResolvedValue(undefined);
      await summarizer.shutdown();
      expect(mockStop).toHaveBeenCalledTimes(1);
    });
  });
});
