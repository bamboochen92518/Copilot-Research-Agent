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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCommand(name: string): Command {
  return {
    data: { name, toJSON: () => ({ name }) } as never,
    execute: jest.fn(),
  };
}

// Helper to build a minimal ChatInputCommandInteraction mock
function makeInteraction(commandName: string) {
  return {
    commandName,
    isChatInputCommand: () => true,
    createdTimestamp: Date.now(),
    client: { ws: { ping: 42 } },
    reply: jest.fn().mockResolvedValue({
      interaction: { createdTimestamp: Date.now() + 50 },
    }),
    editReply: jest.fn().mockResolvedValue(undefined),
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
});
