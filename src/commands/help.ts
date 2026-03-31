import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import type { Command } from './types';

const COMMANDS_INFO = [
  {
    name: '/ping',
    description: 'Check bot latency and connection status.',
  },
  {
    name: '/help',
    description: 'Show this help message.',
  },
  {
    name: '/fetch <count> <domain>',
    description: 'Fetch *count* papers from *domain* and post AI summaries. *(coming soon)*',
  },
  {
    name: '/list',
    description: 'Show papers recently recommended in this channel. *(coming soon)*',
  },
  {
    name: '/favorites',
    description: 'Show your saved papers. React with ⭐ on any paper to save it. *(coming soon)*',
  },
  {
    name: '/schedule',
    description: 'Enable, disable, or configure automatic daily paper posts. *(coming soon)*',
  },
];

const help: Command = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all available commands'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const fields = COMMANDS_INFO.map(({ name, description }) => ({
      name,
      value: description,
    }));

    const embed = new EmbedBuilder()
      .setTitle('📚 Research Paper Agent — Commands')
      .setColor(0x5865f2)
      .setDescription(
        'I fetch, summarize, and organize academic papers from OpenAlex using GitHub Copilot.\n\u200b',
      )
      .addFields(fields)
      .setFooter({
        text: 'React with ⭐ on any paper embed to save it to your favorites.',
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export default help;
