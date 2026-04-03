import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  type SlashCommandOptionsOnlyBuilder,
  type SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';

/**
 * Every slash command must satisfy this interface.
 */
export interface Command {
  /** The slash-command definition used for registration with Discord. */
  data: SlashCommandBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'> | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
  /** Called by the interaction handler when this command is invoked. */
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}
