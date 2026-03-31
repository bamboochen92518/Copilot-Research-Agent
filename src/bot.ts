import { Client, GatewayIntentBits, Events, ChatInputCommandInteraction } from 'discord.js';
import dotenv from 'dotenv';
import logger from './utils/logger';
import { loadCommands, commandRegistry } from './commands/index';

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
    // MessageContent intent requires approval in Discord Developer Portal
    // Enable it under Bot > Privileged Gateway Intents > MESSAGE CONTENT INTENT
    GatewayIntentBits.MessageContent,
  ],
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
