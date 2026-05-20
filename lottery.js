const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const crypto = require('crypto');

// ─── Consistent error logger ──────────────────────────────────────────────────
function logError(context, err) {
  console.error(`[ERROR] lottery/${context}: ${err?.message ?? err}`);
}

// ─── Spin server reference (injected via setSpinServer) ───────────────────────
let _spinServer = null;

/**
 * Inject the spinServer module so lottery.js can create sessions and push events.
 * Called once from bot.js after the spin server has started.
 * @param {object} spinServer - The spinServer module export.
 */
function setSpinServer(spinServer) {
  _spinServer = spinServer;
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

// ─── Database initialisation ──────────────────────────────────────────────────
// Called once from bot.js after the shared `db` instance is created.
function initLotteryTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS lottery_participants (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT    NOT NULL,
      entered_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// ─── Lottery DB helpers ───────────────────────────────────────────────────────

/**
 * Add a single entry for userId to the lottery wheel.
 * Buying multiple tickets calls this once per ticket, giving more entries.
 */
function addToLottery(db, userId) {
  db.prepare('INSERT INTO lottery_participants (user_id) VALUES (?)').run(userId);
}

/**
 * Return all current participant rows (one row per ticket purchased).
 */
function getLotteryParticipants(db) {
  return db.prepare('SELECT * FROM lottery_participants ORDER BY entered_at ASC').all();
}

/**
 * Clear the wheel after a spin.
 */
function clearLottery(db) {
  db.prepare('DELETE FROM lottery_participants').run();
}

// ─── Slash command definition ─────────────────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName('spinwheel')
    .setDescription('Spin the lottery wheel and pick a random winner (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(true)
    .addStringOption(o =>
      o.setName('server')
        .setDescription('Server name or ID to spin the wheel in (DM use only)')
        .setRequired(false)
        .setAutocomplete(true)
    ),
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve a Discord user's display name, falling back to a mention. */
async function resolveUsername(client, userId) {
  try {
    const user = await client.users.fetch(userId);
    return user.username;
  } catch {
    return null;
  }
}

/** Sleep for `ms` milliseconds. */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Multi-channel broadcast helper ──────────────────────────────────────────

/**
 * Find a channel by name (case-insensitive) in a guild that the bot can send to.
 * Returns the channel or null if not found / not sendable.
 * @param {import('discord.js').Guild} guild
 * @param {string} name - Channel name to search for (e.g. 'announcements', 'general')
 * @returns {import('discord.js').TextChannel|null}
 */
function findChannelByName(guild, name) {
  return (
    guild.channels.cache.find(c =>
      c.isTextBased() &&
      !c.isThread() &&
      c.name.toLowerCase() === name.toLowerCase() &&
      c.permissionsFor(guild.members.me)?.has('SendMessages')
    ) ?? null
  );
}

/**
 * Send a payload to a list of channels, silently skipping any that fail.
 * @param {Array<import('discord.js').TextChannel|null>} channels
 * @param {object} payload - discord.js send payload
 */
async function broadcastToChannels(channels, payload) {
  await Promise.allSettled(
    channels
      .filter(Boolean)
      .map(ch => ch.send(payload).catch(err => logError(`broadcastToChannels [${ch.id}]`, err)))
  );
}

// ─── Command handler ──────────────────────────────────────────────────────────
async function handleLottery(interaction, db, client, updateBalance, targetGuild) {
  try {
    const participants = getLotteryParticipants(db);

    if (!participants.length) {
      return await safeReply(interaction, {
        content: '🎡 The lottery wheel is empty — nobody has bought a **50 WIN LOTTERY** ticket yet!',
        ephemeral: true,
      });
    }

    const totalTickets  = participants.length;
    const uniqueUserIds = [...new Set(participants.map(p => p.user_id))];
    const uniqueEntries = uniqueUserIds.length;

    // ── Step 0: Create a live spin session ────────────────────────────────────
    // Generate a short unique ID for this spin so the URL stays clean.
    const spinId = crypto.randomBytes(6).toString('hex'); // e.g. "a3f9c2b1d4e5"

    // Resolve display names up-front so the web page can show them immediately.
    // We'll also use this map later for the Discord embeds.
    const nameMap = new Map(); // userId → display name
    await Promise.all(
      uniqueUserIds.map(async uid => {
        const name = await resolveUsername(client, uid);
        nameMap.set(uid, name ?? `<@${uid}>`);
      })
    );

    // Build the participant list for the web page.
    const webParticipants = uniqueUserIds.map(uid => ({
      userId:   uid,
      username: nameMap.get(uid) ?? uid,
      tickets:  participants.filter(p => p.user_id === uid).length,
    }));

    // Create the session and get the public URL (null if spin server not running).
    let spinUrl = null;
    if (_spinServer) {
      try {
        spinUrl = _spinServer.createSession(spinId, webParticipants);
      } catch (err) {
        logError('handleLottery: createSession', err);
      }
    }

    // ── Step 1: @everyone ping + initial countdown embed ─────────────────────
    const countdownEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🎡 The Lottery Wheel is About to Spin!')
      .setDescription(
        `@everyone\n\n` +
        `The wheel will spin in **3 minutes**! 🕐\n\n` +
        `Get ready — a winner is about to be chosen from the **50 WIN LOTTERY**!` +
        (spinUrl ? `\n\n🌐 **Watch live:** ${spinUrl}` : '')
      )
      .addFields(
        { name: '🎟️ Total Tickets',   value: `${totalTickets}`,  inline: true },
        { name: '👥 Unique Entrants', value: `${uniqueEntries}`, inline: true },
      )
      .setFooter({ text: 'Spinning soon…' })
      .setTimestamp();

    // Defer the reply so we have time for the full countdown sequence.
    await interaction.deferReply();
    await interaction.editReply({
      content: '@everyone',
      embeds: [countdownEmbed],
    });

    // When invoked from DMs with a target guild, find the first sendable text
    // channel in that guild; otherwise fall back to the interaction's channel.
    let channel = interaction.channel;
    if (targetGuild) {
      const guildChannel = targetGuild.channels.cache
        .filter(c =>
          c.isTextBased() &&
          !c.isThread() &&
          c.permissionsFor(targetGuild.members.me)?.has('SendMessages')
        )
        .sort((a, b) => a.rawPosition - b.rawPosition)
        .first();

      if (!guildChannel) {
        return await safeReply(interaction, {
          content: `❌ Could not find a sendable text channel in **${targetGuild.name}**.`,
          ephemeral: true,
        });
      }
      channel = guildChannel;
    }

    // Resolve the guild we're operating in (for multi-channel broadcast later).
    const guild = targetGuild ?? interaction.guild ?? null;

    // ── Step 2: Countdown messages ────────────────────────────────────────────
    // Schedule: 3 min → 2 min → 1 min → 30 s → 10 s → 5 s → 4 s → 3 s → 2 s → 1 s
    const countdownSteps = [
      { waitMs: 60_000, label: '2 minutes' },
      { waitMs: 60_000, label: '1 minute'  },
      { waitMs: 30_000, label: '30 seconds' },
      { waitMs: 20_000, label: '10 seconds' },
      { waitMs:  5_000, label: '5 seconds'  },
      { waitMs:  1_000, label: '4 seconds'  },
      { waitMs:  1_000, label: '3 seconds'  },
      { waitMs:  1_000, label: '2 seconds'  },
      { waitMs:  1_000, label: '1 second'   },
    ];

    for (const step of countdownSteps) {
      await sleep(step.waitMs);

      // Push countdown event to live web page
      if (_spinServer) {
        try { _spinServer.pushEvent(spinId, { type: 'countdown', label: step.label }); } catch { /* non-fatal */ }
      }

      try {
        await channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xEB459E)
              .setDescription(`⏳ The wheel spins in **${step.label}**!`),
          ],
        });
      } catch (err) {
        logError('handleLottery: countdown message', err);
      }
    }

    // Final 1-second pause before the spin animation begins.
    await sleep(1_000);

    // ── Step 3: Spinning wheel animation ─────────────────────────────────────
    // Notify the web page that the spin has started.
    if (_spinServer) {
      try { _spinServer.pushEvent(spinId, { type: 'spinning' }); } catch { /* non-fatal */ }
    }

    const spinFrames = ['🎡', '🎢', '🎠', '🎪', '🎭', '🎨', '🎬', '🎤', '🎧', '🎮'];
    const spinDurationMs = 3_000;
    const frameIntervalMs = 100;
    const totalFrames = spinDurationMs / frameIntervalMs; // 30 frames

    let spinMsg;
    try {
      spinMsg = await channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle('🎡 The Wheel is Spinning!')
            .setDescription(`${spinFrames[0]} **Spinning…**`),
        ],
      });
    } catch (err) {
      logError('handleLottery: spin message send', err);
    }

    if (spinMsg) {
      for (let i = 1; i <= totalFrames; i++) {
        await sleep(frameIntervalMs);
        const frame = spinFrames[i % spinFrames.length];
        // Only edit every other frame to stay well within Discord's rate limit
        // (5 edits / 5 s per message), while still looking animated.
        if (i % 2 === 0) {
          try {
            await spinMsg.edit({
              embeds: [
                new EmbedBuilder()
                  .setColor(0xFEE75C)
                  .setTitle('🎡 The Wheel is Spinning!')
                  .setDescription(`${frame} **Spinning…**`),
              ],
            });
          } catch (err) {
            logError('handleLottery: spin frame edit', err);
          }
        }
      }
    }

    // ── Step 4: Pick the winner ───────────────────────────────────────────────
    const winnerEntry = participants[Math.floor(Math.random() * participants.length)];
    const winnerId    = winnerEntry.user_id;

    // Award 50 coins to the winner.
    updateBalance(winnerId, 50);

    const winnerDisplayName = nameMap.get(winnerId) ?? `<@${winnerId}>`;
    const winnerTag = `${winnerDisplayName} (<@${winnerId}>)`;

    // Clear the wheel now that a winner has been chosen.
    clearLottery(db);

    // Push winner event to live web page
    if (_spinServer) {
      try {
        _spinServer.pushEvent(spinId, {
          type:     'winner',
          userId:   winnerId,
          username: winnerDisplayName,
        });
      } catch { /* non-fatal */ }
      // Schedule session cleanup after 5 minutes
      try { _spinServer.closeSession(spinId, 5 * 60 * 1000); } catch { /* non-fatal */ }
    }

    // ── Step 5: Live wheel display with all names + winner highlighted ────────
    const wheelLines = uniqueUserIds.map(uid => {
      const name    = nameMap.get(uid) ?? `<@${uid}>`;
      const tickets = participants.filter(p => p.user_id === uid).length;
      const isWinner = uid === winnerId;
      return isWinner
        ? `🏆 **${name}** ← WINNER! (${tickets} ticket${tickets !== 1 ? 's' : ''})`
        : `▫️ ${name} (${tickets} ticket${tickets !== 1 ? 's' : ''})`;
    });

    const wheelEmbed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('🎡 Lottery Wheel — Final Result')
      .setDescription(wheelLines.join('\n'))
      .addFields(
        { name: '🎟️ Total Tickets',   value: `${totalTickets}`,  inline: true },
        { name: '👥 Unique Entrants', value: `${uniqueEntries}`, inline: true },
      )
      .setFooter({ text: 'The wheel has been cleared. Buy a new ticket to enter the next round!' })
      .setTimestamp();

    try {
      if (spinMsg) {
        await spinMsg.edit({ embeds: [wheelEmbed] });
      } else {
        await channel.send({ embeds: [wheelEmbed] });
      }
    } catch (err) {
      logError('handleLottery: wheel result edit', err);
      try { await channel.send({ embeds: [wheelEmbed] }); } catch { /* non-fatal */ }
    }

    // ── Step 6: Final winner announcement ────────────────────────────────────
    const resultEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('🎉 We Have a Winner!')
      .setDescription(
        `🏆 Congratulations to **${winnerTag}** for winning the **50 WIN LOTTERY**!` +
        (spinUrl ? `\n\n🌐 **Full results:** ${spinUrl}` : '')
      )
      .addFields(
        { name: '🪙 Prize',           value: '50 coins',             inline: true },
        { name: '🎟️ Winning Ticket',  value: `1 of ${totalTickets}`, inline: true },
      )
      .setTimestamp();

    // Send the winner announcement to the main channel first.
    try {
      await channel.send({ content: `🎉 <@${winnerId}>`, embeds: [resultEmbed] });
    } catch (err) {
      logError('handleLottery: final announcement (main channel)', err);
    }

    // ── Step 7: Broadcast result to #announcements and #general ──────────────
    if (guild) {
      const announcementsChannel = findChannelByName(guild, 'announcements');
      const generalChannel       = findChannelByName(guild, 'general');

      // Collect channels that are different from the main channel (avoid duplicates).
      const broadcastTargets = [announcementsChannel, generalChannel].filter(
        ch => ch && ch.id !== channel.id
      );

      if (broadcastTargets.length) {
        await broadcastToChannels(broadcastTargets, {
          content: `🎉 <@${winnerId}>`,
          embeds:  [resultEmbed],
        });
      }
    }

    // ── Step 8: DM the winner ─────────────────────────────────────────────────
    try {
      const winnerUser = await client.users.fetch(winnerId);
      const dmEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🎉 You Won the Lottery!')
        .setDescription(
          `Congratulations! You were picked as the winner of the **50 WIN LOTTERY** wheel!\n\n` +
          `**🪙 50 coins** have been added to your balance.` +
          (spinUrl ? `\n\n🌐 **View the result:** ${spinUrl}` : '')
        )
        .setTimestamp();

      await winnerUser.send({ embeds: [dmEmbed] });
    } catch (err) {
      logError('handleLottery: DM winner', err);
      // Non-fatal — the coins were still awarded and the result was posted publicly
    }

  } catch (err) {
    logError('handleLottery', err);
    await safeReply(interaction, {
      content: '❌ An unexpected error occurred while spinning the wheel. Please try again.',
      ephemeral: true,
    });
  }
}

module.exports = { commands, handleLottery, initLotteryTable, addToLottery, getLotteryParticipants, clearLottery, setSpinServer };
