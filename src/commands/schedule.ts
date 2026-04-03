import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import cron from 'node-cron';
import type { Command } from './types';
import {
  getSchedulerConfig,
  upsertSchedulerConfig,
  setSchedulerEnabled,
} from '../database/operations';
import {
  startGuildScheduler,
  stopGuildScheduler,
  isGuildSchedulerRunning,
} from '../services/scheduler';
import { config } from '../config/config';
import logger from '../utils/logger';

/** Default cron expression: every day at 09:00 server time. */
const DEFAULT_CRON = '0 9 * * *';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Converts a 5-field cron expression to a human-readable description. */
function cronToHuman(expression: string): string {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return expression;
  const [minute, hour, , , dayOfWeek] = parts;

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayLabel =
    dayOfWeek === '*'
      ? 'every day'
      : dayOfWeek
          .split(',')
          .map((d) => days[parseInt(d)] ?? d)
          .join(', ');

  if (minute === '*' || hour === '*') return expression;
  const h = hour.padStart(2, '0');
  const m = minute.padStart(2, '0');
  return `${dayLabel} at ${h}:${m}`;
}

// ─── Command definition ───────────────────────────────────────────────────────

const scheduleCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Manage automatic daily paper posting for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('enable')
        .setDescription('Enable automatic paper posting')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel to post papers in')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('cron')
            .setDescription(
              'Cron expression for the schedule (default: "0 9 * * *" = 9am daily)',
            )
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName('domains')
            .setDescription(
              'Comma-separated research domains to monitor (default: from server config)',
            )
            .setRequired(false),
        )
        .addIntegerOption((opt) =>
          opt
            .setName('count')
            .setDescription('Papers per batch per domain (1–10, default: 3)')
            .setMinValue(1)
            .setMaxValue(10)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('disable').setDescription('Disable automatic paper posting'),
    )
    .addSubcommand((sub) =>
      sub.setName('status').setDescription('Show the current scheduler status'),
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({
        content: '❌ This command can only be used inside a server.',
        ephemeral: true,
      });
      return;
    }

    const sub = interaction.options.getSubcommand();

    // ── /schedule enable ──────────────────────────────────────────────────────
    if (sub === 'enable') {
      const channel = interaction.options.getChannel('channel', true);
      const cronExpr = interaction.options.getString('cron') ?? DEFAULT_CRON;
      const domainsStr = interaction.options.getString('domains');
      const count = interaction.options.getInteger('count') ?? 3;

      // Validate cron expression before saving
      if (!cron.validate(cronExpr)) {
        await interaction.reply({
          content: [
            '❌ Invalid cron expression: `' + cronExpr + '`.',
            'Use 5-field format: `minute hour day month weekday`.',
            'Example: `0 9 * * *` = every day at 9am.',
          ].join('\n'),
          ephemeral: true,
        });
        return;
      }

      const domains = domainsStr
        ? domainsStr.split(',').map((d) => d.trim()).filter(Boolean)
        : config.paper.defaultTopics;

      try {
        upsertSchedulerConfig({
          guildId,
          channelId: channel.id,
          cronExpression: cronExpr,
          domains,
          papersPerBatch: count,
          enabled: true,
        });

        // (Re)start the cron task with the fresh config
        startGuildScheduler(interaction.client, guildId);

        const embed = new EmbedBuilder()
          .setTitle('✅ Scheduler Enabled')
          .setColor(0x57f287)
          .addFields(
            { name: '📢 Channel', value: `<#${channel.id}>`, inline: true },
            { name: '📅 Schedule', value: `\`${cronExpr}\`\n${cronToHuman(cronExpr)}`, inline: true },
            { name: '📦 Papers per domain', value: String(count), inline: true },
            { name: '🔍 Domains', value: domains.map((d) => `• ${d}`).join('\n') },
          )
          .setFooter({ text: 'Use /schedule disable to stop  •  /schedule status to check' })
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        logger.info(`Scheduler enabled for guild ${guildId} by user ${interaction.user.id}`);
      } catch (err) {
        logger.error('Error enabling scheduler', { err });
        await interaction.reply({
          content: '❌ An error occurred while enabling the scheduler. Please try again.',
          ephemeral: true,
        });
      }

    // ── /schedule disable ─────────────────────────────────────────────────────
    } else if (sub === 'disable') {
      try {
        const updated = setSchedulerEnabled(guildId, false);
        stopGuildScheduler(guildId);

        if (!updated) {
          await interaction.reply({
            content: '⚠️ No scheduler is configured for this server. Use `/schedule enable` first.',
            ephemeral: true,
          });
          return;
        }

        await interaction.reply({
          content: '✅ Automatic paper posting has been **disabled** for this server.',
          ephemeral: true,
        });
        logger.info(`Scheduler disabled for guild ${guildId} by user ${interaction.user.id}`);
      } catch (err) {
        logger.error('Error disabling scheduler', { err });
        await interaction.reply({
          content: '❌ An error occurred while disabling the scheduler. Please try again.',
          ephemeral: true,
        });
      }

    // ── /schedule status ──────────────────────────────────────────────────────
    } else if (sub === 'status') {
      try {
        const cfg = getSchedulerConfig(guildId);

        if (!cfg) {
          await interaction.reply({
            content:
              '📭 No scheduler configured for this server yet.\nUse `/schedule enable` to get started!',
            ephemeral: true,
          });
          return;
        }

        const isRunning = isGuildSchedulerRunning(guildId);
        const statusIcon = cfg.enabled && isRunning ? '🟢' : '🔴';
        const statusText = cfg.enabled && isRunning ? 'Active' : cfg.enabled ? 'Enabled (not running)' : 'Disabled';

        const embed = new EmbedBuilder()
          .setTitle(`${statusIcon} Scheduler Status`)
          .setColor(cfg.enabled && isRunning ? 0x57f287 : 0xed4245)
          .addFields(
            { name: 'Status', value: statusText, inline: true },
            { name: '📢 Channel', value: `<#${cfg.channelId}>`, inline: true },
            { name: '📅 Schedule', value: `\`${cfg.cronExpression}\`\n${cronToHuman(cfg.cronExpression)}`, inline: true },
            { name: '📦 Papers per domain', value: String(cfg.papersPerBatch), inline: true },
            { name: '🔍 Domains', value: cfg.domains.map((d) => `• ${d}`).join('\n') },
            {
              name: '🕐 Last updated',
              value: `<t:${Math.floor(cfg.updatedAt.getTime() / 1000)}:R>`,
              inline: true,
            },
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (err) {
        logger.error('Error fetching scheduler status', { err });
        await interaction.reply({
          content: '❌ An error occurred while fetching the scheduler status.',
          ephemeral: true,
        });
      }
    }
  },
};

export default scheduleCommand;
