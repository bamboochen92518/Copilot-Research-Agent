import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import type { Command } from './types';
import { getUserFavorites } from '../database/operations';
import logger from '../utils/logger';

/** Discord caps embed fields at 25. */
const FAVORITES_LIMIT = 25;

const favoritesCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('favorites')
    .setDescription('Show your saved papers'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;

    try {
      const papers = getUserFavorites(userId).slice(0, FAVORITES_LIMIT);

      if (papers.length === 0) {
        await interaction.reply({
          content:
            "⭐ You haven't saved any papers yet. React with ⭐ on a paper embed to save it!",
          ephemeral: true,
        });
        return;
      }

      const fields = papers.map((paper, i) => {
        const meta: string[] = [];

        if (paper.authors.length > 0) {
          const authorStr =
            paper.authors.length > 2
              ? `${paper.authors.slice(0, 2).join(', ')} et al.`
              : paper.authors.join(', ');
          meta.push(`👥 ${authorStr}`);
        }
        if (paper.publicationYear) meta.push(`📅 ${paper.publicationYear}`);
        if (paper.citedByCount !== undefined)
          meta.push(`📊 ${paper.citedByCount} citations`);

        const metaStr = meta.join('  |  ');
        const link = paper.url ? `[View paper](${paper.url})` : '*(no link)*';

        return {
          name: `${i + 1}. ${paper.title.slice(0, 200)}`,
          value: `${link}\n${metaStr}`,
        };
      });

      const embed = new EmbedBuilder()
        .setTitle('⭐ Your Saved Papers')
        .setColor(0xffd700)
        .setDescription(`You have **${papers.length}** saved paper(s).\n\u200b`)
        .addFields(fields)
        .setFooter({
          text: 'React ⭐ on a paper embed to add  •  Remove the ⭐ reaction to delete',
        })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      logger.error('Error in /favorites command', { error });
      await interaction.reply({
        content: '❌ An error occurred while loading your favorites.',
        ephemeral: true,
      });
    }
  },
};

export default favoritesCommand;
