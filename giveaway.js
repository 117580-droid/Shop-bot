const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// ─── Consistent error logger ──────────────────────────────────────────────────
function logError(context, err) {
  console.error(`[ERROR] giveaway/${context}: ${err?.message ?? err}`);
}

// ─── Safe interaction reply ───────────────────────────────────────────────────
async function safeReply(interaction, payload) {
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch (err) {
    logError('safeReply', err);
  }
}

// ─── Duration parser ──────────────────────────────────────────────────────────
// Accepts formats like "30m", "2h", "1d", "1w".
// Returns milliseconds, or null if the string is invalid.
function parseDuration(str) {
  if (!str || typeof str !== 'string') return null;
  const match = str.trim().match(/^(\d+)(w|d|h|m)$/i);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  if (value <= 0) return null;
  const unit = match[2].toLowerCase();
  const multipliers = {
    w: 7 * 24 * 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    h: 60 * 60 * 1000,
    m: 60 * 1000,
  };
  return value * multipliers[unit];
}

// ─── Duration formatter ───────────────────────────────────────────────────────
// Converts milliseconds into a human-readable string like "2 hours", "30 minutes".
function formatDuration(ms) {
  const units = [
    { label: 'week',   ms: 7 * 24 * 60 * 60 * 1000 },
    { label: 'day',    ms: 24 * 60 * 60 * 1000 },
    { label: 'hour',   ms: 60 * 60 * 1000 },
    { label: 'minute', ms: 60 * 1000 },
  ];
  for (const unit of units) {
    if (ms >= unit.ms) {
      const count = Math.floor(ms / unit.ms);
      return `${count} ${unit.label}${count !== 1 ? 's' : ''}`;
    }
  }
  return 'less than a minute';
}

// ─── Active giveaways store ───────────────────────────────────────────────────
// Key: message ID (string)
// Value: {
//   messageId, channelId, guildId, prize, winnersCount,
//   durationMs, startTime, endTime, hostedBy, timeoutId
// }
const activeGiveaways = new Map();

// ─── Build giveaway embed ─────────────────────────────────────────────────────
function buildGiveawayEmbed(giveaway) {
  const endTimestamp = Math.floor(giveaway.endTime / 1000);
  return new EmbedBuilder()
    .setColor(0xFEE75C)
    .setTitle('🎉 GIVEAWAY 🎉')
    .setDescription(
      `**Prize:** ${giveaway.prize}\n\n` +
      `React with 🎉 to enter!\n\n` +
      `**Ends:** <t:${endTimestamp}:R> (<t:${endTimestamp}:F>)`
    )
    .addFields(
      { name: '🏆 Winners',  value: `${giveaway.winnersCount}`,          inline: true },
      { name: '⏱️ Duration', value: formatDuration(giveaway.durationMs), inline: true },
      { name: '🎟️ Hosted by', value: `<@${giveaway.hostedBy}>`,          inline: true },
    )
    .setFooter({ text: `Giveaway ID: ${giveaway.messageId}` })
    .setTimestamp(giveaway.endTime);
}

// ─── Build ended giveaway embed ───────────────────────────────────────────────
function buildEndedEmbed(giveaway, winners) {
  const winnerText = winners.length
    ? winners.map(id => `<@${id}>`).join(', ')
    : 'No valid entries — no winners this time.';

  return new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('🎉 GIVEAWAY ENDED 🎉')
    .setDescription(
      `**Prize:** ${giveaway.prize}\n\n` +
      `**Winner${winners.length !== 1 ? 's' : ''}:** ${winnerText}`
    )
    .addFields(
      { name: '🏆 Winners',   value: `${giveaway.winnersCount}`,          inline: true },
      { name: '⏱️ Duration',  value: formatDuration(giveaway.durationMs), inline: true },
      { name: '🎟️ Hosted by', value: `<@${giveaway.hostedBy}>`,           inline: true },
    )
    .setFooter({ text: `Giveaway ID: ${giveaway.messageId}` })
    .setTimestamp();
}

// ─── Pick random winners from a reaction ─────────────────────────────────────
// Fetches all users who reacted with 🎉, excludes bots, then picks up to
// `count` unique winners at random.
async function pickWinners(message, count, client) {
  let reaction;
  try {
    reaction = message.reactions.cache.get('🎉');
    if (!reaction) return [];
    // Fetch all users who reacted (Discord paginates at 100 per call)
    await reaction.users.fetch();
  } catch (err) {
    logError('pickWinners: fetch reactions', err);
    return [];
  }

  const eligible = reaction.users.cache
    .filter(u => !u.bot)
    .map(u => u.id);

  if (!eligible.length) return [];

  // Fisher-Yates shuffle then take the first `count` entries
  const shuffled = [...eligible];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count);
}

// ─── End a giveaway (shared logic for timeout + /giveaway end) ───────────────
async function concludeGiveaway(giveaway, client) {
  // Remove from active map first so no double-end can occur
  activeGiveaways.delete(giveaway.messageId);

  let channel;
  try {
    channel = await client.channels.fetch(giveaway.channelId);
  } catch (err) {
    logError(`concludeGiveaway: fetch channel [${giveaway.channelId}]`, err);
    return;
  }

  let message;
  try {
    message = await channel.messages.fetch(giveaway.messageId);
  } catch (err) {
    logError(`concludeGiveaway: fetch message [${giveaway.messageId}]`, err);
    return;
  }

  const winners = await pickWinners(message, giveaway.winnersCount, client);

  // Update the original embed to show it has ended
  try {
    await message.edit({ embeds: [buildEndedEmbed(giveaway, winners)] });
  } catch (err) {
    logError('concludeGiveaway: edit message', err);
  }

  // Announce winners in the same channel
  try {
    if (winners.length) {
      const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
      await channel.send({
        content: `🎉 Congratulations ${winnerMentions}! You won **${giveaway.prize}**!`,
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('🏆 Giveaway Winners!')
            .setDescription(
              `**Prize:** ${giveaway.prize}\n` +
              `**Winner${winners.length !== 1 ? 's' : ''}:** ${winnerMentions}`
            )
            .setFooter({ text: `Giveaway ID: ${giveaway.messageId}` })
            .setTimestamp(),
        ],
      });
    } else {
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('🎉 Giveaway Ended')
            .setDescription(
              `The giveaway for **${giveaway.prize}** has ended, but nobody entered.\n` +
              `No winners were selected.`
            )
            .setFooter({ text: `Giveaway ID: ${giveaway.messageId}` })
            .setTimestamp(),
        ],
      });
    }
  } catch (err) {
    logError('concludeGiveaway: send winner announcement', err);
  }
}

// ─── Slash command definitions ────────────────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Manage giveaways')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription('Create a new giveaway')
        .addStringOption(o =>
          o.setName('duration')
            .setDescription('How long the giveaway lasts, e.g. 30m, 2h, 1d, 1w')
            .setRequired(true)
        )
        .addIntegerOption(o =>
          o.setName('winners')
            .setDescription('Number of winners to pick')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(20)
        )
        .addStringOption(o =>
          o.setName('prize')
            .setDescription('What the winner(s) will receive')
            .setRequired(true)
        )
        .addChannelOption(o =>
          o.setName('channel')
            .setDescription('Channel to host the giveaway in')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('edit')
        .setDescription('Edit an active giveaway')
        .addStringOption(o =>
          o.setName('message_id')
            .setDescription('Message ID of the giveaway to edit')
            .setRequired(true)
        )
        .addStringOption(o =>
          o.setName('duration')
            .setDescription('New duration from now, e.g. 30m, 2h, 1d')
        )
        .addIntegerOption(o =>
          o.setName('winners')
            .setDescription('New number of winners')
            .setMinValue(1)
            .setMaxValue(20)
        )
        .addStringOption(o =>
          o.setName('prize')
            .setDescription('New prize description')
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('delete')
        .setDescription('Delete an active giveaway without picking winners')
        .addStringOption(o =>
          o.setName('message_id')
            .setDescription('Message ID of the giveaway to delete')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('end')
        .setDescription('End a giveaway early and pick winners now')
        .addStringOption(o =>
          o.setName('message_id')
            .setDescription('Message ID of the giveaway to end')
            .setRequired(true)
        )
    ),
];

// ─── Command handler ──────────────────────────────────────────────────────────
async function handleGiveaway(interaction, client) {
  const sub = interaction.options.getSubcommand();

  try {
    // ── /giveaway create ────────────────────────────────────────────────────
    if (sub === 'create') {
      const durationStr  = interaction.options.getString('duration');
      const winnersCount = interaction.options.getInteger('winners');
      const prize        = (interaction.options.getString('prize') ?? '').trim().slice(0, 256);
      const channel      = interaction.options.getChannel('channel');

      if (!prize) {
        return await safeReply(interaction, {
          content: '❌ Prize cannot be empty.',
          ephemeral: true,
        });
      }

      const durationMs = parseDuration(durationStr);
      if (durationMs === null) {
        return await safeReply(interaction, {
          content: '❌ Invalid duration format. Use a number followed by `w`, `d`, `h`, or `m` — e.g. `30m`, `2h`, `1d`.',
          ephemeral: true,
        });
      }

      // Verify the target channel is a text-based channel the bot can send to
      if (!channel.isTextBased()) {
        return await safeReply(interaction, {
          content: '❌ The selected channel must be a text channel.',
          ephemeral: true,
        });
      }

      const now     = Date.now();
      const endTime = now + durationMs;

      // Build a temporary giveaway object (no messageId yet)
      const giveawayData = {
        messageId:    null,
        channelId:    channel.id,
        guildId:      interaction.guild.id,
        prize,
        winnersCount,
        durationMs,
        startTime:    now,
        endTime,
        hostedBy:     interaction.user.id,
        timeoutId:    null,
      };

      // Send the giveaway embed to the target channel
      let giveawayMessage;
      try {
        giveawayMessage = await channel.send({ embeds: [buildGiveawayEmbed({ ...giveawayData, messageId: 'pending' })] });
      } catch (err) {
        logError('create: send giveaway message', err);
        return await safeReply(interaction, {
          content: `❌ Failed to send the giveaway message to ${channel}. Make sure I have permission to send messages there.`,
          ephemeral: true,
        });
      }

      // Now we have the real message ID — update the embed with it
      giveawayData.messageId = giveawayMessage.id;
      try {
        await giveawayMessage.edit({ embeds: [buildGiveawayEmbed(giveawayData)] });
      } catch (err) {
        logError('create: edit embed with real message ID', err);
      }

      // Add the entry reaction so users can click it
      try {
        await giveawayMessage.react('🎉');
      } catch (err) {
        logError('create: add reaction', err);
      }

      // Schedule automatic conclusion
      const timeoutId = setTimeout(() => {
        concludeGiveaway(giveawayData, client).catch(err =>
          logError(`auto-conclude [${giveawayData.messageId}]`, err)
        );
      }, durationMs);

      giveawayData.timeoutId = timeoutId;
      activeGiveaways.set(giveawayMessage.id, giveawayData);

      console.log(`[INFO] Giveaway created: messageId=${giveawayMessage.id} prize="${prize}" winners=${winnersCount} duration=${formatDuration(durationMs)} channel=${channel.id}`);

      return await safeReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('✅ Giveaway Created!')
            .setDescription(`Your giveaway for **${prize}** has started in ${channel}!`)
            .addFields(
              { name: '🏆 Winners',   value: `${winnersCount}`,          inline: true },
              { name: '⏱️ Duration',  value: formatDuration(durationMs), inline: true },
              { name: '🆔 Message ID', value: giveawayMessage.id,        inline: true },
            )
            .setTimestamp(),
        ],
        ephemeral: true,
      });
    }

    // ── /giveaway edit ──────────────────────────────────────────────────────
    if (sub === 'edit') {
      const messageId    = (interaction.options.getString('message_id') ?? '').trim();
      const durationStr  = interaction.options.getString('duration');
      const newWinners   = interaction.options.getInteger('winners');
      const newPrize     = interaction.options.getString('prize')?.trim().slice(0, 256) ?? null;

      if (!messageId) {
        return await safeReply(interaction, {
          content: '❌ Please provide a valid giveaway message ID.',
          ephemeral: true,
        });
      }

      const giveaway = activeGiveaways.get(messageId);
      if (!giveaway) {
        return await safeReply(interaction, {
          content: `❌ No active giveaway found with message ID \`${messageId}\`. It may have already ended or been deleted.`,
          ephemeral: true,
        });
      }

      // Require at least one field to edit
      if (!durationStr && newWinners === null && !newPrize) {
        return await safeReply(interaction, {
          content: '❌ Please provide at least one field to edit: `duration`, `winners`, or `prize`.',
          ephemeral: true,
        });
      }

      // Parse new duration if provided
      let newDurationMs = null;
      if (durationStr) {
        newDurationMs = parseDuration(durationStr);
        if (newDurationMs === null) {
          return await safeReply(interaction, {
            content: '❌ Invalid duration format. Use a number followed by `w`, `d`, `h`, or `m` — e.g. `30m`, `2h`, `1d`.',
            ephemeral: true,
          });
        }
      }

      // Apply edits
      if (newPrize)        giveaway.prize        = newPrize;
      if (newWinners)      giveaway.winnersCount  = newWinners;
      if (newDurationMs) {
        // Cancel the existing timeout and schedule a new one
        clearTimeout(giveaway.timeoutId);
        const now         = Date.now();
        giveaway.durationMs = newDurationMs;
        giveaway.endTime    = now + newDurationMs;
        giveaway.timeoutId  = setTimeout(() => {
          concludeGiveaway(giveaway, client).catch(err =>
            logError(`auto-conclude [${giveaway.messageId}]`, err)
          );
        }, newDurationMs);
      }

      // Fetch and update the original embed
      try {
        const channel = await client.channels.fetch(giveaway.channelId);
        const message = await channel.messages.fetch(giveaway.messageId);
        await message.edit({ embeds: [buildGiveawayEmbed(giveaway)] });
      } catch (err) {
        logError('edit: update embed', err);
        return await safeReply(interaction, {
          content: '❌ Failed to update the giveaway embed. The giveaway data has been updated internally.',
          ephemeral: true,
        });
      }

      const changedFields = [];
      if (newPrize)      changedFields.push(`**Prize** → ${newPrize}`);
      if (newWinners)    changedFields.push(`**Winners** → ${newWinners}`);
      if (newDurationMs) changedFields.push(`**Duration** → ${formatDuration(newDurationMs)} (restarted from now)`);

      console.log(`[INFO] Giveaway edited: messageId=${messageId} changes=[${changedFields.join(', ')}]`);

      return await safeReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('✏️ Giveaway Updated')
            .setDescription(`Giveaway \`${messageId}\` has been updated:\n${changedFields.join('\n')}`)
            .setTimestamp(),
        ],
        ephemeral: true,
      });
    }

    // ── /giveaway delete ────────────────────────────────────────────────────
    if (sub === 'delete') {
      const messageId = (interaction.options.getString('message_id') ?? '').trim();

      if (!messageId) {
        return await safeReply(interaction, {
          content: '❌ Please provide a valid giveaway message ID.',
          ephemeral: true,
        });
      }

      const giveaway = activeGiveaways.get(messageId);
      if (!giveaway) {
        return await safeReply(interaction, {
          content: `❌ No active giveaway found with message ID \`${messageId}\`. It may have already ended or been deleted.`,
          ephemeral: true,
        });
      }

      // Cancel the scheduled timeout
      clearTimeout(giveaway.timeoutId);
      activeGiveaways.delete(messageId);

      // Delete the Discord message
      try {
        const channel = await client.channels.fetch(giveaway.channelId);
        const message = await channel.messages.fetch(giveaway.messageId);
        await message.delete();
      } catch (err) {
        logError('delete: remove message', err);
        // Non-fatal — the giveaway is already removed from the active map
      }

      console.log(`[INFO] Giveaway deleted: messageId=${messageId} prize="${giveaway.prize}" by ${interaction.user.id}`);

      return await safeReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('🗑️ Giveaway Deleted')
            .setDescription(`The giveaway for **${giveaway.prize}** has been cancelled and removed.`)
            .setFooter({ text: `Deleted by ${interaction.user.username}` })
            .setTimestamp(),
        ],
        ephemeral: true,
      });
    }

    // ── /giveaway end ───────────────────────────────────────────────────────
    if (sub === 'end') {
      const messageId = (interaction.options.getString('message_id') ?? '').trim();

      if (!messageId) {
        return await safeReply(interaction, {
          content: '❌ Please provide a valid giveaway message ID.',
          ephemeral: true,
        });
      }

      const giveaway = activeGiveaways.get(messageId);
      if (!giveaway) {
        return await safeReply(interaction, {
          content: `❌ No active giveaway found with message ID \`${messageId}\`. It may have already ended or been deleted.`,
          ephemeral: true,
        });
      }

      // Cancel the scheduled timeout — concludeGiveaway will handle cleanup
      clearTimeout(giveaway.timeoutId);

      await safeReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle('⏩ Ending Giveaway Early…')
            .setDescription(`Picking winners for **${giveaway.prize}** now…`)
            .setTimestamp(),
        ],
        ephemeral: true,
      });

      console.log(`[INFO] Giveaway ended early: messageId=${messageId} prize="${giveaway.prize}" by ${interaction.user.id}`);

      // concludeGiveaway removes the entry from activeGiveaways internally
      await concludeGiveaway(giveaway, client);
    }

  } catch (err) {
    logError(`handleGiveaway [${sub}]`, err);
    await safeReply(interaction, {
      content: '❌ An unexpected error occurred while processing the giveaway command. Please try again.',
      ephemeral: true,
    });
  }
}

// ─── Reaction entry handler ───────────────────────────────────────────────────
// Called from bot.js on every messageReactionAdd event.
// Silently ignores reactions that are not on active giveaway messages.
async function handleGiveawayReaction(reaction, user) {
  // Ignore bot reactions
  if (user.bot) return;

  // Only care about the 🎉 emoji on active giveaway messages
  if (reaction.emoji.name !== '🎉') return;
  if (!activeGiveaways.has(reaction.message.id)) return;

  // The reaction is already recorded by Discord — nothing extra to store.
  // This hook exists so future extensions (e.g. role requirements, coin cost)
  // can be added here without touching bot.js.
}

module.exports = { commands, handleGiveaway, handleGiveawayReaction, activeGiveaways };
