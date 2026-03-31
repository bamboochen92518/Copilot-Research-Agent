import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import type { Command } from './types';

const ping: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency and connection status'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const sent = await interaction.reply({
      content: 'Pinging…',
      fetchReply: true,
      withResponse: true,
    });

    const roundtripMs =
      sent.interaction.createdTimestamp - interaction.createdTimestamp;
    const wsHeartbeatMs = interaction.client.ws.ping;

    const embed = new EmbedBuilder()
      .setTitle('🏓 Pong!')
      .setColor(0x5865f2)
      .addFields(
        { name: 'Roundtrip latency', value: `${roundtripMs} ms`, inline: true },
        {
          name: 'WebSocket heartbeat',
          value: `${wsHeartbeatMs} ms`,
          inline: true,
        },
      )
      .setTimestamp();

    await interaction.editReply({ content: '', embeds: [embed] });
  },
};

export default ping;
