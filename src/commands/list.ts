import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import type { Command } from './types';
import { getRecommendationsByChannel, getPaperById } from '../database/operations';
import logger from '../utils/logger';

/** Maximum number of recent recommendations to display. */
const LIST_LIMIT = 10;

const listCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('list')
    .setDescription(`Show the last ${LIST_LIMIT} papers recommended in this channel`),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const channelId = interaction.channelId;

    try {
      const recs = getRecommendationsByChannel(channelId).slice(0, LIST_LIMIT);

      if (recs.length === 0) {
        await interaction.reply({
          content:
            '📭 No papers have been recommended in this channel yet. Use `/fetch` to get started!',
          ephemeral: true,
        });
        return;
      }

      // Build one embed field per recommendation
      const fields = recs
        .map((rec, i) => {
          const paper = getPaperById(rec.paperId);
          if (!paper) return null;

          const meta: string[] = [];
          if (paper.publicationYear) meta.push(`📅 ${paper.publicationYear}`);
          if (paper.citedByCount !== undefined)
            meta.push(`📊 ${paper.citedByCount} citations`);
          const metaStr = meta.length ? `  •  ${meta.join('  •  ')}` : '';

          const link = paper.url ? `[View paper](${paper.url})` : '*(no link)*';
          const relativeTime = `<t:${Math.floor(rec.recommendedDate.getTime() / 1000)}:R>`;

          return {
            name: `${i + 1}. ${paper.title.slice(0, 200)}`,
            value: `${link}${metaStr}\nRecommended ${relativeTime}`,
          };
        })
        .filter((f): f is { name: string; value: string } => f !== null);

      if (fields.length === 0) {
        await interaction.reply({
          content: '⚠️ Recommendation records exist but the papers could not be loaded.',
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`📋 Recent Papers — ${interaction.guild?.name ?? 'this channel'}`)
        .setColor(0x5865f2)
        .setDescription(
          `Showing the last **${fields.length}** recommendation(s). React with ⭐ on any paper to save it.\n\u200b`,
        )
        .addFields(fields)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      logger.error('Error in /list command', { error });
      await interaction.reply({
        content: '❌ An error occurred while loading recommendations.',
        ephemeral: true,
      });
    }
  },
};

export default listCommand;
