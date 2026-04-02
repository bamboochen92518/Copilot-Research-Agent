import { Client, GatewayIntentBits, Events, ChatInputCommandInteraction, Partials } from 'discord.js';
import dotenv from 'dotenv';
import logger from './utils/logger';
import { loadCommands, commandRegistry } from './commands/index';
import { getPaperByMessageId, addFavorite, removeFavorite } from './database/operations';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    logger.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    // MessageContent intent requires approval in Discord Developer Portal
    // Enable it under Bot > Privileged Gateway Intents > MESSAGE CONTENT INTENT
    GatewayIntentBits.MessageContent,
  ],
  // Partials are required to receive reaction events on messages that were
  // sent before the bot started (i.e. not in the client's cache).
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// Bot ready event
client.once('ready', async () => {
  logger.info(`✅ Bot is ready! Logged in as ${client.user?.tag}`);
  logger.info(`Bot is in ${client.guilds.cache.size} guilds`);
});

// Slash command handler
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commandRegistry.get(interaction.commandName);
  if (!command) {
    logger.warn(`Unknown command received: ${interaction.commandName}`);
    await interaction.reply({
      content: '❌ Unknown command. Use `/help` to see available commands.',
      ephemeral: true,
    });
    return;
  }

  try {
    await command.execute(interaction as ChatInputCommandInteraction);
  } catch (error) {
    logger.error(`Error executing command "${interaction.commandName}"`, { error });
    const errorMessage = '❌ An error occurred while executing this command. Please try again.';
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
});

// Error handling
client.on('error', (error) => {
  logger.error('Discord client error:', error);
});

// ─── ⭐ Reaction: add favorite ────────────────────────────────────────────────
const FAVORITE_EMOJI = '⭐';

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;
  if (reaction.emoji.name !== FAVORITE_EMOJI) return;

  // Fetch full objects if they arrived as partials
  if (reaction.partial) {
    try { await reaction.fetch(); } catch { return; }
  }

  const paper = getPaperByMessageId(reaction.message.id);
  if (!paper || paper.id === undefined) return;

  addFavorite({ userId: user.id, paperId: paper.id, favoritedDate: new Date() });
  logger.info(`User ${user.id} favorited paper ${paper.id} ("${paper.title}")`);
});

// ─── ⭐ Reaction: remove favorite ─────────────────────────────────────────────
client.on(Events.MessageReactionRemove, async (reaction, user) => {
  if (user.bot) return;
  if (reaction.emoji.name !== FAVORITE_EMOJI) return;

  if (reaction.partial) {
    try { await reaction.fetch(); } catch { return; }
  }

  const paper = getPaperByMessageId(reaction.message.id);
  if (!paper || paper.id === undefined) return;

  removeFavorite(user.id, paper.id);
  logger.info(`User ${user.id} un-favorited paper ${paper.id} ("${paper.title}")`);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

// Login to Discord
loadCommands()
  .then(() => {
    logger.info(`Loaded ${commandRegistry.size} command(s)`);
    return client.login(process.env.DISCORD_TOKEN);
  })
  .catch((error) => {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  });

export default client;
