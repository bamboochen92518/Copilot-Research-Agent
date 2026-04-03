jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../src/database/operations', () => ({
  getSchedulerConfig: jest.fn(),
  getAllEnabledSchedulerConfigs: jest.fn(),
  addPaper: jest.fn((p: unknown) => ({ ...(p as object), id: 1 })),
  addRecommendation: jest.fn(),
  addMessagePaper: jest.fn(),
  isPaperRecommended: jest.fn().mockReturnValue(false),
}));

jest.mock('../../src/services/openAlexFetcher');
jest.mock('../../src/services/copilotSummarizer');
jest.mock('../../src/utils/pdfFetcher', () => ({
  fetchPdfText: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../src/commands/fetch', () => ({
  buildPaperEmbed: jest.fn().mockReturnValue({ toJSON: () => ({}) }),
}));

// node-cron mock — validate always returns true by default; schedule returns a stoppable task
const mockStop = jest.fn();
jest.mock('node-cron', () => ({
  __esModule: true,
  default: {
    validate: jest.fn().mockReturnValue(true),
    schedule: jest.fn().mockReturnValue({ stop: mockStop }),
  },
}));

import cron from 'node-cron';
import * as dbOps from '../../src/database/operations';
import { OpenAlexFetcher } from '../../src/services/openAlexFetcher';
import { CopilotSummarizer } from '../../src/services/copilotSummarizer';
import {
  runScheduledJob,
  startGuildScheduler,
  stopGuildScheduler,
  isGuildSchedulerRunning,
  initScheduler,
} from '../../src/services/scheduler';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const makeCfg = (overrides = {}) => ({
  guildId: 'guild-1',
  channelId: 'ch-1',
  cronExpression: '0 9 * * *',
  domains: ['AI'],
  papersPerBatch: 2,
  enabled: true,
  updatedAt: new Date(),
  ...overrides,
});

const fakePaper = {
  title: 'Paper',
  authors: ['Alice'],
  abstract: 'Abstract.',
  url: 'https://example.com',
  openAlexId: 'W1',
  pdfUrl: undefined,
  citedByCount: 10,
  publicationYear: 2024,
  topics: ['AI'],
  fetchDate: new Date(),
};

// ─── isGuildSchedulerRunning ──────────────────────────────────────────────────

describe('isGuildSchedulerRunning', () => {
  it('returns false when no task has been started', () => {
    expect(isGuildSchedulerRunning('never-started')).toBe(false);
  });
});

// ─── startGuildScheduler / stopGuildScheduler ─────────────────────────────────

describe('startGuildScheduler / stopGuildScheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (cron.validate as jest.Mock).mockReturnValue(true);
    (cron.schedule as jest.Mock).mockReturnValue({ stop: mockStop });
    // Ensure the guild is not running before each test
    stopGuildScheduler('guild-start');
  });

  it('does nothing when config is null', () => {
    (dbOps.getSchedulerConfig as jest.Mock).mockReturnValue(null);
    startGuildScheduler({} as never, 'guild-start');
    expect(cron.schedule).not.toHaveBeenCalled();
    expect(isGuildSchedulerRunning('guild-start')).toBe(false);
  });

  it('does nothing when config is disabled', () => {
    (dbOps.getSchedulerConfig as jest.Mock).mockReturnValue(makeCfg({ guildId: 'guild-start', enabled: false }));
    startGuildScheduler({} as never, 'guild-start');
    expect(cron.schedule).not.toHaveBeenCalled();
  });

  it('logs error and skips scheduling when cron expression is invalid', () => {
    (dbOps.getSchedulerConfig as jest.Mock).mockReturnValue(
      makeCfg({ guildId: 'guild-start', cronExpression: 'bad' }),
    );
    (cron.validate as jest.Mock).mockReturnValue(false);
    startGuildScheduler({} as never, 'guild-start');
    expect(cron.schedule).not.toHaveBeenCalled();
    expect(isGuildSchedulerRunning('guild-start')).toBe(false);
  });

  it('schedules a cron task and marks guild as running', () => {
    (dbOps.getSchedulerConfig as jest.Mock).mockReturnValue(makeCfg({ guildId: 'guild-start' }));
    startGuildScheduler({} as never, 'guild-start');
    expect(cron.schedule).toHaveBeenCalledWith('0 9 * * *', expect.any(Function));
    expect(isGuildSchedulerRunning('guild-start')).toBe(true);
    // Cleanup
    stopGuildScheduler('guild-start');
  });

  it('stopGuildScheduler stops and removes the task', () => {
    (dbOps.getSchedulerConfig as jest.Mock).mockReturnValue(makeCfg({ guildId: 'guild-start' }));
    startGuildScheduler({} as never, 'guild-start');
    expect(isGuildSchedulerRunning('guild-start')).toBe(true);
    stopGuildScheduler('guild-start');
    expect(mockStop).toHaveBeenCalled();
    expect(isGuildSchedulerRunning('guild-start')).toBe(false);
  });

  it('stopGuildScheduler is a no-op when guild has no running task', () => {
    expect(() => stopGuildScheduler('never-ran')).not.toThrow();
  });

  it('restarting replaces the existing task', () => {
    (dbOps.getSchedulerConfig as jest.Mock).mockReturnValue(makeCfg({ guildId: 'guild-start' }));
    startGuildScheduler({} as never, 'guild-start');
    startGuildScheduler({} as never, 'guild-start'); // second call
    expect(mockStop).toHaveBeenCalledTimes(1); // old task stopped once
    expect(cron.schedule).toHaveBeenCalledTimes(2);
    stopGuildScheduler('guild-start');
  });
});

// ─── initScheduler ────────────────────────────────────────────────────────────

describe('initScheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (cron.validate as jest.Mock).mockReturnValue(true);
    (cron.schedule as jest.Mock).mockReturnValue({ stop: mockStop });
    stopGuildScheduler('g-init-1');
    stopGuildScheduler('g-init-2');
  });

  it('starts tasks for all enabled guilds returned by getAllEnabledSchedulerConfigs', () => {
    (dbOps.getAllEnabledSchedulerConfigs as jest.Mock).mockReturnValue([
      makeCfg({ guildId: 'g-init-1' }),
      makeCfg({ guildId: 'g-init-2' }),
    ]);
    (dbOps.getSchedulerConfig as jest.Mock).mockImplementation((id: string) =>
      makeCfg({ guildId: id }),
    );

    initScheduler({} as never);

    expect(isGuildSchedulerRunning('g-init-1')).toBe(true);
    expect(isGuildSchedulerRunning('g-init-2')).toBe(true);

    stopGuildScheduler('g-init-1');
    stopGuildScheduler('g-init-2');
  });

  it('starts nothing when no enabled configs exist', () => {
    (dbOps.getAllEnabledSchedulerConfigs as jest.Mock).mockReturnValue([]);
    initScheduler({} as never);
    expect(cron.schedule).not.toHaveBeenCalled();
  });
});

// ─── runScheduledJob ──────────────────────────────────────────────────────────

describe('runScheduledJob', () => {
  const mockSend = jest.fn().mockResolvedValue({ id: 'msg-1' });
  const mockFetchChannel = jest.fn();
  const mockClient = { channels: { fetch: mockFetchChannel } };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchChannel.mockResolvedValue({
      isTextBased: () => true,
      send: mockSend,
    });
  });

  it('returns early when config is null', async () => {
    (dbOps.getSchedulerConfig as jest.Mock).mockReturnValue(null);
    await runScheduledJob(mockClient as never, 'guild-1');
    expect(mockFetchChannel).not.toHaveBeenCalled();
  });

  it('returns early when config is disabled', async () => {
    (dbOps.getSchedulerConfig as jest.Mock).mockReturnValue(makeCfg({ enabled: false }));
    await runScheduledJob(mockClient as never, 'guild-1');
    expect(mockFetchChannel).not.toHaveBeenCalled();
  });

  it('returns early when channel fetch throws', async () => {
    (dbOps.getSchedulerConfig as jest.Mock).mockReturnValue(makeCfg());
    mockFetchChannel.mockRejectedValue(new Error('403 Forbidden'));
    await runScheduledJob(mockClient as never, 'guild-1');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns early when channel is not text-based', async () => {
    (dbOps.getSchedulerConfig as jest.Mock).mockReturnValue(makeCfg());
    mockFetchChannel.mockResolvedValue({ isTextBased: () => false });
    await runScheduledJob(mockClient as never, 'guild-1');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('posts a header message and paper embeds when papers are available', async () => {
    (dbOps.getSchedulerConfig as jest.Mock).mockReturnValue(makeCfg({ domains: ['AI'] }));

    (OpenAlexFetcher.prototype.fetchPapers as jest.Mock) = jest.fn().mockResolvedValue([fakePaper]);
    (CopilotSummarizer.prototype.summarizePapers as jest.Mock) = jest
      .fn()
      .mockResolvedValue([{ paper: fakePaper, summary: '**🔑 Key Findings:** ...' }]);
    (CopilotSummarizer.prototype.shutdown as jest.Mock) = jest.fn().mockResolvedValue(undefined);

    await runScheduledJob(mockClient as never, 'guild-1');

    // At least: one header send + one embed send
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(dbOps.addPaper).toHaveBeenCalled();
    expect(dbOps.addRecommendation).toHaveBeenCalled();
  });

  it('skips posting when no unseen papers are found', async () => {
    (dbOps.getSchedulerConfig as jest.Mock).mockReturnValue(makeCfg({ domains: ['AI'] }));
    (OpenAlexFetcher.prototype.fetchPapers as jest.Mock) = jest.fn().mockResolvedValue([]);

    await runScheduledJob(mockClient as never, 'guild-1');

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('skips posting when summarizer returns empty results', async () => {
    (dbOps.getSchedulerConfig as jest.Mock).mockReturnValue(makeCfg({ domains: ['AI'] }));
    (OpenAlexFetcher.prototype.fetchPapers as jest.Mock) = jest.fn().mockResolvedValue([fakePaper]);
    (CopilotSummarizer.prototype.summarizePapers as jest.Mock) = jest.fn().mockResolvedValue([]);
    (CopilotSummarizer.prototype.shutdown as jest.Mock) = jest.fn().mockResolvedValue(undefined);

    await runScheduledJob(mockClient as never, 'guild-1');

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('continues to the next domain when one domain throws', async () => {
    (dbOps.getSchedulerConfig as jest.Mock).mockReturnValue(
      makeCfg({ domains: ['BadDomain', 'GoodDomain'] }),
    );

    let callCount = 0;
    (OpenAlexFetcher.prototype.fetchPapers as jest.Mock) = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) throw new Error('API failure');
      return Promise.resolve([fakePaper]);
    });
    (CopilotSummarizer.prototype.summarizePapers as jest.Mock) = jest
      .fn()
      .mockResolvedValue([{ paper: fakePaper, summary: 'Summary.' }]);
    (CopilotSummarizer.prototype.shutdown as jest.Mock) = jest.fn().mockResolvedValue(undefined);

    await runScheduledJob(mockClient as never, 'guild-1');

    // Second domain should still post
    expect(mockSend).toHaveBeenCalledTimes(2);
  });
});
