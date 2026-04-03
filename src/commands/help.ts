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
    name: '/fetch',
    description: [
      'Fetch and summarize academic papers from OpenAlex using GitHub Copilot.',
      '**Options:**',
      '`count` — Number of papers (1–10, default 5)',
      '`domain` — Keywords or research area (e.g. `multilabel classification`)',
      '`start_year` — Only papers published on or after this year',
      '`end_year` — Only papers published on or before this year',
      '`min_citations` — Only papers with at least this many citations',
      '',
      'Each paper gets an AI summary (full PDF text when available) and a 📄 PDF link.',
      'Already-recommended papers in this channel are automatically skipped.',
    ].join('\n'),
  },
  {
    name: '/list',
    description: 'Show the last 10 papers recommended in this channel.',
  },
  {
    name: '/favorites',
    description: 'Show your saved papers. React with ⭐ on any paper embed to save it; remove ⭐ to delete.',
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
