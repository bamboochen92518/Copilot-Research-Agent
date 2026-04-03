jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../src/database/operations', () => ({
  getSchedulerConfig: jest.fn(),
  upsertSchedulerConfig: jest.fn(),
  setSchedulerEnabled: jest.fn(),
}));

jest.mock('../../src/services/scheduler', () => ({
  startGuildScheduler: jest.fn(),
  stopGuildScheduler: jest.fn(),
  isGuildSchedulerRunning: jest.fn(),
}));

jest.mock('node-cron', () => ({
  __esModule: true,
  default: {
    validate: jest.fn().mockReturnValue(true),
    schedule: jest.fn().mockReturnValue({ stop: jest.fn() }),
  },
}));

jest.mock('../../src/config/config', () => ({
  config: {
    paper: { defaultTopics: ['artificial intelligence', 'machine learning'] },
    github: { token: 'test-token', model: 'gpt-4.1' },
    discord: { token: '', clientId: '' },
    database: { path: ':memory:' },
    logging: { level: 'info', dir: './logs' },
    openAlex: { email: '', maxResults: 10, apiUrl: 'https://api.openalex.org' },
    nodeEnv: 'test',
    isDevelopment: false,
  },
}));

import cron from 'node-cron';
import scheduleCommand from '../../src/commands/schedule';
import * as dbOps from '../../src/database/operations';
import * as schedulerSvc from '../../src/services/scheduler';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInteraction(
  subcommand: string,
  overrides: {
    guildId?: string | null;
    getChannel?: jest.Mock;
    getString?: jest.Mock;
    getInteger?: jest.Mock;
  } = {},
) {
  return {
    guildId: overrides.guildId !== undefined ? overrides.guildId : 'guild-1',
    user: { id: 'user-1' },
    client: {},
    options: {
      getSubcommand: jest.fn().mockReturnValue(subcommand),
      getChannel: overrides.getChannel ?? jest.fn().mockReturnValue({ id: 'ch-1' }),
      getString: overrides.getString ?? jest.fn().mockReturnValue(null),
      getInteger: overrides.getInteger ?? jest.fn().mockReturnValue(null),
    },
    reply: jest.fn().mockResolvedValue(undefined),
  };
}

const makeCfg = (overrides = {}) => ({
  guildId: 'guild-1',
  channelId: 'ch-1',
  cronExpression: '0 9 * * *',
  domains: ['AI'],
  papersPerBatch: 3,
  enabled: true,
  updatedAt: new Date('2026-04-03T09:00:00Z'),
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('/schedule command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (cron.validate as jest.Mock).mockReturnValue(true);
  });

  it('has name "schedule"', () => {
    expect(scheduleCommand.data.name).toBe('schedule');
  });

  // ── DM guard ────────────────────────────────────────────────────────────────
  it('replies with error when used outside a guild (DM)', async () => {
    const interaction = makeInteraction('enable', { guildId: null });
    await scheduleCommand.execute(interaction as never);

    const replyArg = (interaction.reply as jest.Mock).mock.calls[0][0];
    expect(replyArg.content).toMatch(/only be used inside a server/);
    expect(replyArg.ephemeral).toBe(true);
  });

  // ── enable ──────────────────────────────────────────────────────────────────
  describe('enable subcommand', () => {
    it('replies with error when cron expression is invalid', async () => {
      (cron.validate as jest.Mock).mockReturnValue(false);
      (dbOps.upsertSchedulerConfig as jest.Mock).mockReturnValue(makeCfg());

      const interaction = makeInteraction('enable', {
        getString: jest.fn().mockImplementation((name: string) =>
          name === 'cron' ? 'bad cron' : null,
        ),
      });
      await scheduleCommand.execute(interaction as never);

      const replyArg = (interaction.reply as jest.Mock).mock.calls[0][0];
      expect(replyArg.content).toMatch(/Invalid cron expression/);
      expect(dbOps.upsertSchedulerConfig).not.toHaveBeenCalled();
    });

    it('saves config and replies with embed on success', async () => {
      (dbOps.upsertSchedulerConfig as jest.Mock).mockReturnValue(makeCfg());

      const interaction = makeInteraction('enable');
      await scheduleCommand.execute(interaction as never);

      expect(dbOps.upsertSchedulerConfig).toHaveBeenCalledWith(
        expect.objectContaining({ guildId: 'guild-1', enabled: true }),
      );
      expect(schedulerSvc.startGuildScheduler).toHaveBeenCalledWith(
        interaction.client,
        'guild-1',
      );
      const replyArg = (interaction.reply as jest.Mock).mock.calls[0][0];
      expect(replyArg.ephemeral).toBe(true);
      expect(replyArg.embeds).toHaveLength(1);
    });

    it('uses default cron when none provided', async () => {
      (dbOps.upsertSchedulerConfig as jest.Mock).mockReturnValue(makeCfg());

      const interaction = makeInteraction('enable');
      await scheduleCommand.execute(interaction as never);

      expect(dbOps.upsertSchedulerConfig).toHaveBeenCalledWith(
        expect.objectContaining({ cronExpression: '0 9 * * *' }),
      );
    });

    it('uses custom domains when provided', async () => {
      (dbOps.upsertSchedulerConfig as jest.Mock).mockReturnValue(makeCfg());

      const interaction = makeInteraction('enable', {
        getString: jest.fn().mockImplementation((name: string) =>
          name === 'domains' ? 'NLP, robotics' : null,
        ),
      });
      await scheduleCommand.execute(interaction as never);

      expect(dbOps.upsertSchedulerConfig).toHaveBeenCalledWith(
        expect.objectContaining({ domains: ['NLP', 'robotics'] }),
      );
    });

    it('falls back to default topics when no domains provided', async () => {
      (dbOps.upsertSchedulerConfig as jest.Mock).mockReturnValue(makeCfg());

      const interaction = makeInteraction('enable');
      await scheduleCommand.execute(interaction as never);

      expect(dbOps.upsertSchedulerConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          domains: expect.arrayContaining(['artificial intelligence']),
        }),
      );
    });

    it('replies with error message when upsert throws', async () => {
      (dbOps.upsertSchedulerConfig as jest.Mock).mockImplementation(() => {
        throw new Error('DB error');
      });

      const interaction = makeInteraction('enable');
      await scheduleCommand.execute(interaction as never);

      const replyArg = (interaction.reply as jest.Mock).mock.calls[0][0];
      expect(replyArg.content).toMatch(/error occurred/i);
    });
  });

  // ── disable ─────────────────────────────────────────────────────────────────
  describe('disable subcommand', () => {
    it('warns when no config exists for the guild', async () => {
      (dbOps.setSchedulerEnabled as jest.Mock).mockReturnValue(false);

      const interaction = makeInteraction('disable');
      await scheduleCommand.execute(interaction as never);

      const replyArg = (interaction.reply as jest.Mock).mock.calls[0][0];
      expect(replyArg.content).toMatch(/No scheduler is configured/);
    });

    it('disables and stops the scheduler when config exists', async () => {
      (dbOps.setSchedulerEnabled as jest.Mock).mockReturnValue(true);

      const interaction = makeInteraction('disable');
      await scheduleCommand.execute(interaction as never);

      expect(dbOps.setSchedulerEnabled).toHaveBeenCalledWith('guild-1', false);
      expect(schedulerSvc.stopGuildScheduler).toHaveBeenCalledWith('guild-1');

      const replyArg = (interaction.reply as jest.Mock).mock.calls[0][0];
      expect(replyArg.content).toMatch(/disabled/i);
    });

    it('replies with error message when setSchedulerEnabled throws', async () => {
      (dbOps.setSchedulerEnabled as jest.Mock).mockImplementation(() => {
        throw new Error('DB error');
      });

      const interaction = makeInteraction('disable');
      await scheduleCommand.execute(interaction as never);

      const replyArg = (interaction.reply as jest.Mock).mock.calls[0][0];
      expect(replyArg.content).toMatch(/error occurred/i);
    });
  });

  // ── status ───────────────────────────────────────────────────────────────────
  describe('status subcommand', () => {
    it('replies with "not configured" when no config exists', async () => {
      (dbOps.getSchedulerConfig as jest.Mock).mockReturnValue(null);

      const interaction = makeInteraction('status');
      await scheduleCommand.execute(interaction as never);

      const replyArg = (interaction.reply as jest.Mock).mock.calls[0][0];
      expect(replyArg.content).toMatch(/No scheduler configured/);
    });

    it('replies with embed showing active status when scheduler is running', async () => {
      (dbOps.getSchedulerConfig as jest.Mock).mockReturnValue(makeCfg({ enabled: true }));
      (schedulerSvc.isGuildSchedulerRunning as jest.Mock).mockReturnValue(true);

      const interaction = makeInteraction('status');
      await scheduleCommand.execute(interaction as never);

      const replyArg = (interaction.reply as jest.Mock).mock.calls[0][0];
      expect(replyArg.ephemeral).toBe(true);
      expect(replyArg.embeds).toHaveLength(1);
      const embedJson = replyArg.embeds[0].toJSON();
      expect(embedJson.title).toContain('🟢');
    });

    it('replies with red embed when scheduler is disabled', async () => {
      (dbOps.getSchedulerConfig as jest.Mock).mockReturnValue(
        makeCfg({ enabled: false }),
      );
      (schedulerSvc.isGuildSchedulerRunning as jest.Mock).mockReturnValue(false);

      const interaction = makeInteraction('status');
      await scheduleCommand.execute(interaction as never);

      const replyArg = (interaction.reply as jest.Mock).mock.calls[0][0];
      const embedJson = replyArg.embeds[0].toJSON();
      expect(embedJson.title).toContain('🔴');
      expect(embedJson.color).toBe(0xed4245);
    });

    it('replies with error message when getSchedulerConfig throws', async () => {
      (dbOps.getSchedulerConfig as jest.Mock).mockImplementation(() => {
        throw new Error('DB error');
      });

      const interaction = makeInteraction('status');
      await scheduleCommand.execute(interaction as never);

      const replyArg = (interaction.reply as jest.Mock).mock.calls[0][0];
      expect(replyArg.content).toMatch(/error occurred/i);
    });
  });
});
