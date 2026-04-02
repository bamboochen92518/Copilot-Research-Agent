import {
  Collection,
} from 'discord.js';
import { Command } from './types';
import ping from './ping';
import help from './help';
import fetchCommand from './fetch';
import listCommand from './list';
import favoritesCommand from './favorites';

export type { Command };

/**
 * In-memory registry mapping command name → Command object.
 * Populated at startup by `loadCommands()`.
 */
export const commandRegistry = new Collection<string, Command>();

/**
 * Registers a command in the in-memory registry.
 * Throws if a command with the same name is already registered.
 */
export function registerCommand(command: Command): void {
  const name = command.data.name;
  if (commandRegistry.has(name)) {
    throw new Error(`Command "${name}" is already registered.`);
  }
  commandRegistry.set(name, command);
}

/**
 * Loads all built-in commands into the registry.
 * Call this once during bot initialisation.
 */
export async function loadCommands(): Promise<void> {
  // Add new command imports above and list them here as phases progress.
  const commands = [ping, help, fetchCommand, listCommand, favoritesCommand];
  for (const command of commands) {
    registerCommand(command);
  }
}
