/**
 * Registers (or refreshes) application slash commands with Discord.
 *
 * Run this script once whenever you add or update a command:
 *   npx ts-node scripts/register-commands.ts
 *
 * To register for a specific guild (instant, good for dev):
 *   DISCORD_GUILD_ID=<guild_id> npx ts-node scripts/register-commands.ts
 *
 * Without DISCORD_GUILD_ID the commands are registered globally
 * (takes up to 1 hour to propagate).
 */

import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { loadCommands, commandRegistry } from '../src/commands/index';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId) {
  console.error('❌  DISCORD_TOKEN and DISCORD_CLIENT_ID must be set in .env');
  process.exit(1);
}

async function main() {
  await loadCommands();

  const commandData = [...commandRegistry.values()].map((cmd) => cmd.data.toJSON());

  const rest = new REST({ version: '10' }).setToken(token!);

  try {
    console.log(`Refreshing ${commandData.length} application command(s)…`);

    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId!, guildId), {
        body: commandData,
      });
      console.log(`✅  Registered commands to guild ${guildId} (instant).`);
    } else {
      await rest.put(Routes.applicationCommands(clientId!), {
        body: commandData,
      });
      console.log('✅  Registered commands globally (may take up to 1 hour to propagate).');
    }
  } catch (err) {
    console.error('❌  Failed to register commands:', err);
    process.exit(1);
  }
}

main();
