import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import logger from './utils/logger';

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
client.once('ready', () => {
  logger.info(`✅ Bot is ready! Logged in as ${client.user?.tag}`);
  logger.info(`Bot is in ${client.guilds.cache.size} guilds`);
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
client.login(process.env.DISCORD_TOKEN).catch((error) => {
  logger.error('Failed to login to Discord:', error);
  process.exit(1);
});

export default client;
