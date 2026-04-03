import {
  commandRegistry,
  registerCommand,
  Command,
} from '../../src/commands/index';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../src/services/openAlexFetcher');
jest.mock('../../src/services/copilotSummarizer');
jest.mock('../../src/database/operations', () => ({
  addPaper: jest.fn((p: unknown) => ({ ...(p as object), id: 1 })),
  addRecommendation: jest.fn(),
  addMessagePaper: jest.fn(),
  isPaperRecommended: jest.fn().mockReturnValue(false),
  getRecommendationsByChannel: jest.fn(),
  getPaperById: jest.fn(),
  getUserFavorites: jest.fn(),
}));
jest.mock('../../src/config/config', () => ({
  config: {
    paper: { defaultTopics: ['artificial intelligence'] },
    github: { token: 'test-token', model: 'gpt-4.1' },
    openAlex: { email: '', maxResults: 10, apiUrl: 'https://api.openalex.org' },
    discord: { token: '', clientId: '' },
    database: { path: ':memory:' },
    logging: { level: 'info', dir: './logs' },
    nodeEnv: 'test',
    isDevelopment: false,
  },
}));
jest.mock('../../src/utils/pdfFetcher', () => ({
  fetchPdfText: jest.fn().mockResolvedValue(null),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCommand(name: string): Command {
  return {
    data: { name, toJSON: () => ({ name }) } as never,
    execute: jest.fn(),
  };
}

// Helper to build a minimal ChatInputCommandInteraction mock
function makeInteraction(
  commandName: string,
  optionOverrides: {
    getInteger?: jest.Mock;
    getString?: jest.Mock;
  } = {},
) {
  return {
    commandName,
    isChatInputCommand: () => true,
    createdTimestamp: Date.now(),
    client: { ws: { ping: 42 } },
    channelId: 'channel-123',
    user: { id: 'user-456' },
    guild: { name: 'Test Server' },
    options: {
      getInteger: optionOverrides.getInteger ?? jest.fn().mockReturnValue(null),
      getString: optionOverrides.getString ?? jest.fn().mockReturnValue(null),
    },
    reply: jest.fn().mockResolvedValue({
      interaction: { createdTimestamp: Date.now() + 50 },
    }),
    editReply: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    replied: false,
    deferred: false,
  };
}

// ─── commandRegistry & registerCommand ───────────────────────────────────────

describe('commandRegistry', () => {
  beforeEach(() => {
    // Clear registry between tests
    commandRegistry.clear();
  });

  it('starts empty', () => {
    expect(commandRegistry.size).toBe(0);
  });

  it('registerCommand adds a command', () => {
    registerCommand(makeCommand('test'));
    expect(commandRegistry.has('test')).toBe(true);
  });

  it('registerCommand throws on duplicate name', () => {
    registerCommand(makeCommand('dup'));
    expect(() => registerCommand(makeCommand('dup'))).toThrow(
      'Command "dup" is already registered.',
    );
  });

  it('stores multiple commands independently', () => {
    registerCommand(makeCommand('cmd1'));
    registerCommand(makeCommand('cmd2'));
    expect(commandRegistry.size).toBe(2);
  });
});

// ─── /ping command ────────────────────────────────────────────────────────────

describe('/ping command', () => {
  let ping: Command;

  beforeEach(async () => {
    const mod = await import('../../src/commands/ping');
    ping = mod.default;
  });

  it('has the name "ping"', () => {
    expect(ping.data.name).toBe('ping');
  });

  it('replies and then edits with an embed', async () => {
    const interaction = makeInteraction('ping');
    await ping.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Pinging…' }),
    );
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([expect.anything()]),
      }),
    );
  });

  it('clears the content when editing with the embed', async () => {
    const interaction = makeInteraction('ping');
    await ping.execute(interaction as never);

    const editCall = (interaction.editReply as jest.Mock).mock.calls[0][0];
    expect(editCall.content).toBe('');
  });
});

// ─── /help command ────────────────────────────────────────────────────────────

describe('/help command', () => {
  let help: Command;

  beforeEach(async () => {
    const mod = await import('../../src/commands/help');
    help = mod.default;
  });

  it('has the name "help"', () => {
    expect(help.data.name).toBe('help');
  });

  it('replies ephemerally with an embed', async () => {
    const interaction = makeInteraction('help');
    await help.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        ephemeral: true,
        embeds: expect.arrayContaining([expect.anything()]),
      }),
    );
  });

  it('embed lists /ping and /fetch commands', async () => {
    const interaction = makeInteraction('help');
    await help.execute(interaction as never);

    const replyArg = (interaction.reply as jest.Mock).mock.calls[0][0];
    const embed = replyArg.embeds[0];
    const embedJson = embed.toJSON();

    const fieldNames = embedJson.fields.map((f: { name: string }) => f.name);
    expect(fieldNames).toContain('/ping');
    expect(fieldNames.some((n: string) => n.includes('/fetch'))).toBe(true);
  });
});

// ─── loadCommands ─────────────────────────────────────────────────────────────

describe('loadCommands', () => {
  beforeEach(() => {
    commandRegistry.clear();
  });

  it('registers ping and help', async () => {
    const { loadCommands } = await import('../../src/commands/index');
    await loadCommands();
    expect(commandRegistry.has('ping')).toBe(true);
    expect(commandRegistry.has('help')).toBe(true);
  });

  it('registers at least 2 commands', async () => {
    const { loadCommands } = await import('../../src/commands/index');
    await loadCommands();
    expect(commandRegistry.size).toBeGreaterThanOrEqual(2);
  });

  it('registers fetch, list, and favorites', async () => {
    const { loadCommands } = await import('../../src/commands/index');
    await loadCommands();
    expect(commandRegistry.has('fetch')).toBe(true);
    expect(commandRegistry.has('list')).toBe(true);
    expect(commandRegistry.has('favorites')).toBe(true);
  });
});

// ─── /fetch command ───────────────────────────────────────────────────────────

describe('/fetch command', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fetchMod: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let OpenAlexFetcher: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let CopilotSummarizer: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dbOps: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    fetchMod = await import('../../src/commands/fetch');
    OpenAlexFetcher = (await import('../../src/services/openAlexFetcher')).OpenAlexFetcher;
    CopilotSummarizer = (await import('../../src/services/copilotSummarizer')).CopilotSummarizer;
    dbOps = await import('../../src/database/operations');
  });

  it('has the name "fetch"', () => {
    expect(fetchMod.default.data.name).toBe('fetch');
  });

  it('exposes count (integer) and domain (string) options', () => {
    const json = fetchMod.default.data.toJSON();
    const optionNames = json.options.map((o: { name: string }) => o.name);
    expect(optionNames).toContain('count');
    expect(optionNames).toContain('domain');
  });

  it('defers reply before processing', async () => {
    // fetchPapers returns empty → command exits early after deferring
    OpenAlexFetcher.prototype.fetchPapers = jest.fn().mockResolvedValue([]);

    const interaction = makeInteraction('fetch');
    await fetchMod.default.execute(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalled();
  });

  it('editReplies with "no papers" when fetcher returns empty', async () => {
    OpenAlexFetcher.prototype.fetchPapers = jest.fn().mockResolvedValue([]);

    const interaction = makeInteraction('fetch');
    await fetchMod.default.execute(interaction as never);

    const calls = (interaction.editReply as jest.Mock).mock.calls.flat();
    expect(calls.some((c: string) => c.includes('No new papers found'))).toBe(true);
  });

  it('posts embeds for each summarized paper', async () => {
    const fakePaper = {
      title: 'Test Paper',
      authors: ['Alice'],
      abstract: 'An abstract.',
      url: 'https://example.com',
      citedByCount: 42,
      publicationYear: 2024,
      topics: ['AI'],
      fetchDate: new Date(),
    };

    OpenAlexFetcher.prototype.fetchPapers = jest.fn().mockResolvedValue([fakePaper]);
    CopilotSummarizer.prototype.summarizePapers = jest
      .fn()
      .mockResolvedValue([{ paper: fakePaper, summary: '**🔑 Key Findings:** ...' }]);    CopilotSummarizer.prototype.shutdown = jest.fn().mockResolvedValue(undefined);

    dbOps.addPaper.mockReturnValue({ ...fakePaper, id: 99 });

    const interaction = makeInteraction('fetch');
    await fetchMod.default.execute(interaction as never);

    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.arrayContaining([expect.anything()]) }),
    );
    expect(dbOps.addPaper).toHaveBeenCalled();
    expect(dbOps.addRecommendation).toHaveBeenCalled();
  });
});

// ─── /list command ────────────────────────────────────────────────────────────

describe('/list command', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let listMod: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dbOps: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    listMod = await import('../../src/commands/list');
    dbOps = await import('../../src/database/operations');
  });

  it('has the name "list"', () => {
    expect(listMod.default.data.name).toBe('list');
  });

  it('replies ephemerally with "no papers" when channel has no recommendations', async () => {
    dbOps.getRecommendationsByChannel.mockReturnValue([]);

    const interaction = makeInteraction('list');
    await listMod.default.execute(interaction as never);

    const replyArg = (interaction.reply as jest.Mock).mock.calls[0][0];
    expect(replyArg.ephemeral).toBe(true);
    expect(replyArg.content).toMatch(/No papers have been recommended/);
  });

  it('replies with an embed when recommendations exist', async () => {
    const fakePaper = {
      id: 1,
      title: 'A Great Paper',
      authors: ['Bob'],
      abstract: '',
      url: 'https://example.com',
      citedByCount: 10,
      publicationYear: 2023,
      topics: [],
      fetchDate: new Date(),
    };
    dbOps.getRecommendationsByChannel.mockReturnValue([
      { id: 1, paperId: 1, channelId: 'channel-123', recommendedDate: new Date() },
    ]);
    dbOps.getPaperById.mockReturnValue(fakePaper);

    const interaction = makeInteraction('list');
    await listMod.default.execute(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        ephemeral: true,
        embeds: expect.arrayContaining([expect.anything()]),
      }),
    );
  });
});

// ─── /favorites command ───────────────────────────────────────────────────────

describe('/favorites command', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let favoritesMod: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dbOps: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    favoritesMod = await import('../../src/commands/favorites');
    dbOps = await import('../../src/database/operations');
  });

  it('has the name "favorites"', () => {
    expect(favoritesMod.default.data.name).toBe('favorites');
  });

  it('replies ephemerally with "no favorites" when user has none', async () => {
    dbOps.getUserFavorites.mockReturnValue([]);

    const interaction = makeInteraction('favorites');
    await favoritesMod.default.execute(interaction as never);

    const replyArg = (interaction.reply as jest.Mock).mock.calls[0][0];
    expect(replyArg.ephemeral).toBe(true);
    expect(replyArg.content).toMatch(/haven't saved any papers/);
  });

  it('replies with a gold embed when user has favorites', async () => {
    const fakePaper = {
      id: 2,
      title: 'Favorite Paper',
      authors: ['Carol', 'Dave'],
      abstract: '',
      url: 'https://example.com/fav',
      citedByCount: 55,
      publicationYear: 2022,
      topics: ['NLP'],
      fetchDate: new Date(),
    };
    dbOps.getUserFavorites.mockReturnValue([fakePaper]);

    const interaction = makeInteraction('favorites');
    await favoritesMod.default.execute(interaction as never);

    const replyArg = (interaction.reply as jest.Mock).mock.calls[0][0];
    expect(replyArg.ephemeral).toBe(true);
    expect(replyArg.embeds).toHaveLength(1);
    // Gold color = 0xFFD700
    expect(replyArg.embeds[0].toJSON().color).toBe(0xffd700);
  });

  it('replies with error message when database throws', async () => {
    dbOps.getUserFavorites.mockImplementation(() => {
      throw new Error('DB crashed');
    });

    const interaction = makeInteraction('favorites');
    await favoritesMod.default.execute(interaction as never);

    const replyArg = (interaction.reply as jest.Mock).mock.calls[0][0];
    expect(replyArg.ephemeral).toBe(true);
    expect(replyArg.content).toMatch(/error occurred/i);
  });
});

// ─── buildPaperEmbed (fetch helper) ──────────────────────────────────────────

describe('buildPaperEmbed', () => {
  it('includes a PDF field when paper has pdfUrl', async () => {
    const { buildPaperEmbed } = await import('../../src/commands/fetch');
    const paper = {
      title: 'Test Paper',
      authors: ['Alice'],
      abstract: 'Abstract text.',
      url: 'https://example.com',
      pdfUrl: 'https://example.com/paper.pdf',
      citedByCount: 10,
      publicationYear: 2024,
      topics: [],
      fetchDate: new Date(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const embed = buildPaperEmbed(paper as any, 'Summary text');
    const json = embed.toJSON();

    const pdfField = (json.fields ?? []).find(
      (f: { name: string }) => f.name === '📄 Full PDF',
    );
    expect(pdfField).toBeDefined();
    expect(pdfField!.value).toContain('https://example.com/paper.pdf');
  });

  it('omits the PDF field when paper has no pdfUrl', async () => {
    const { buildPaperEmbed } = await import('../../src/commands/fetch');
    const paper = {
      title: 'Test Paper',
      authors: ['Alice'],
      abstract: 'Abstract text.',
      url: 'https://example.com',
      pdfUrl: undefined,
      citedByCount: 10,
      publicationYear: 2024,
      topics: [],
      fetchDate: new Date(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const embed = buildPaperEmbed(paper as any, 'Summary text');
    const json = embed.toJSON();

    const pdfField = (json.fields ?? []).find(
      (f: { name: string }) => f.name === '📄 Full PDF',
    );
    expect(pdfField).toBeUndefined();
  });
});

// ─── /fetch additional edge cases ────────────────────────────────────────────

describe('/fetch edge cases', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fetchMod: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let OpenAlexFetcher: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let CopilotSummarizer: any;

  const fakePaper = {
    title: 'Edge Case Paper',
    authors: ['Dave'],
    abstract: 'Abstract.',
    url: 'https://example.com/edge',
    citedByCount: 5,
    publicationYear: 2021,
    topics: ['AI'],
    fetchDate: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    fetchMod = await import('../../src/commands/fetch');
    OpenAlexFetcher = (await import('../../src/services/openAlexFetcher')).OpenAlexFetcher;
    CopilotSummarizer = (await import('../../src/services/copilotSummarizer')).CopilotSummarizer;
  });

  it('editReplies with failure message when summarizer returns empty results', async () => {
    OpenAlexFetcher.prototype.fetchPapers = jest.fn().mockResolvedValue([fakePaper]);
    CopilotSummarizer.prototype.summarizePapers = jest.fn().mockResolvedValue([]);
    CopilotSummarizer.prototype.shutdown = jest.fn().mockResolvedValue(undefined);

    const interaction = makeInteraction('fetch');
    await fetchMod.default.execute(interaction as never);

    const calls = (interaction.editReply as jest.Mock).mock.calls.flat();
    expect(calls.some((c: string) => c.includes('Failed to generate summaries'))).toBe(true);
  });

  it('editReplies with error message when fetchPapers throws', async () => {
    OpenAlexFetcher.prototype.fetchPapers = jest.fn().mockRejectedValue(new Error('timeout'));

    const interaction = makeInteraction('fetch');
    // Mark as deferred so the catch branch calls editReply instead of silently returning
    (interaction as never as { deferred: boolean }).deferred = true;
    await fetchMod.default.execute(interaction as never);

    const calls = (interaction.editReply as jest.Mock).mock.calls.flat();
    expect(calls.some((c: string) => c.includes('An error occurred'))).toBe(true);
  });

  it('includes year range label in reply when start_year is provided and papers are found', async () => {
    OpenAlexFetcher.prototype.fetchPapers = jest.fn().mockResolvedValue([fakePaper]);
    CopilotSummarizer.prototype.summarizePapers = jest
      .fn()
      .mockResolvedValue([{ paper: fakePaper, summary: '**🔑 Key Findings:** ...' }]);
    CopilotSummarizer.prototype.shutdown = jest.fn().mockResolvedValue(undefined);

    const interaction = makeInteraction('fetch', {
      getInteger: jest.fn().mockImplementation((name: string) => {
        if (name === 'count') return 5;
        if (name === 'start_year') return 2020;
        if (name === 'end_year') return 2023;
        return null;
      }),
    });
    await fetchMod.default.execute(interaction as never);

    const allReplies = [
      ...(interaction.editReply as jest.Mock).mock.calls.flat(),
    ];
    expect(allReplies.some((c: string) => c.includes('2020–2023'))).toBe(true);
  });
});

// ─── /list additional edge cases ─────────────────────────────────────────────

describe('/list edge cases', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let listMod: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dbOps: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    listMod = await import('../../src/commands/list');
    dbOps = await import('../../src/database/operations');
  });

  it('replies with warning when all recommendation papers are missing from DB', async () => {
    dbOps.getRecommendationsByChannel.mockReturnValue([
      { id: 1, paperId: 99, channelId: 'channel-123', recommendedDate: new Date() },
    ]);
    // Paper lookup returns null → all map entries become null → fields array empty
    dbOps.getPaperById.mockReturnValue(null);

    const interaction = makeInteraction('list');
    await listMod.default.execute(interaction as never);

    const replyArg = (interaction.reply as jest.Mock).mock.calls[0][0];
    expect(replyArg.ephemeral).toBe(true);
    expect(replyArg.content).toMatch(/could not be loaded/i);
  });

  it('replies with error message when database throws', async () => {
    dbOps.getRecommendationsByChannel.mockImplementation(() => {
      throw new Error('DB error');
    });

    const interaction = makeInteraction('list');
    await listMod.default.execute(interaction as never);

    const replyArg = (interaction.reply as jest.Mock).mock.calls[0][0];
    expect(replyArg.ephemeral).toBe(true);
    expect(replyArg.content).toMatch(/error occurred/i);
  });
});
