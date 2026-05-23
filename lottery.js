const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// ─── Wheel graphic constants ──────────────────────────────────────────────────

// Spinning emoji sequence cycled through during the animation.
// Discord renders these reliably inside embeds.
const WHEEL_SEGMENTS = ['🎡', '🎢', '🎠', '🎪', '🎭', '🎨', '🎬', '🎤'];

/**
 * Build a simple emoji-based spinning wheel embed for the lottery.
 *
 * Uses only Discord-safe emoji characters — no box-drawing or special Unicode
 * that embeds can't render.  The spinning emoji cycles through WHEEL_SEGMENTS
 * so viewers see clear motion, and the currently selected participant name is
 * shown prominently so the spin is easy to follow.
 *
 * @param {string}  selectedName   Participant name currently at the top.
 * @param {boolean} isSpinning     true → spinning state; false → landed state.
 * @param {number}  rotationOffset How many positions the ring has rotated.
 * @returns {EmbedBuilder}
 */
function generateLotteryWheelEmbed(selectedName, isSpinning, rotationOffset = 0) {
  // ── Pick the current spinning emoji from the sequence ────────────────────
  const spinEmoji = WHEEL_SEGMENTS[rotationOffset % WHEEL_SEGMENTS.length];

  // ── Status line ──────────────────────────────────────────────────────────
  const statusLine = isSpinning
    ? `🌀  **Spinning…**  🌀`
    : `🎯  **LANDED ON:**  🎯`;

  // ── Name display ─────────────────────────────────────────────────────────
  const nameDisplay = isSpinning
    ? `> 🎰  **${selectedName}**`
    : `> ✨  **${selectedName}**  ✨`;

  // ── Pointer arrow ─────────────────────────────────────────────────────────
  const pointer = isSpinning ? '⬇️' : '🎯';

  // ── Assemble description ─────────────────────────────────────────────────
  // Simple layout: spinning emoji row → pointer → participant name → status.
  // Every character here is a standard emoji or plain text — fully visible
  // in Discord embeds on all platforms.
  const wheelRow = `${spinEmoji} ${spinEmoji} ${spinEmoji} ${spinEmoji} ${spinEmoji}`;

  const description = [
    wheelRow,
    `${pointer}  ${pointer}  ${pointer}`,
    nameDisplay,
    '',
    statusLine,
  ].join('\n');

  // Embed colour: blue while spinning, gold when landed.
  const color = isSpinning ? 0x5865F2 : 0xFEE75C;

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(isSpinning ? '🎡 Spinning the Lottery Wheel…' : '🎯 The Wheel Has Landed!')
    .setDescription(description)
    .setFooter({ text: isSpinning ? 'Spinning…' : `Winner: ${selectedName}` })
    .setTimestamp();
}

// ─── Consistent error logger ──────────────────────────────────────────────────
function logError(context, err) {
  console.error(`[ERROR] lottery/${context}: ${err?.message ?? err}`);
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

    // ── Step 0: Resolve display names ─────────────────────────────────────────
    const nameMap = new Map(); // userId → display name
    await Promise.all(
      uniqueUserIds.map(async uid => {
        const name = await resolveUsername(client, uid);
        nameMap.set(uid, name ?? `<@${uid}>`);
      })
    );

    // ── Step 1: @everyone ping + initial countdown embed ─────────────────────
    const countdownEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🎡 The Lottery Wheel is About to Spin!')
      .setDescription(
        `@everyone\n\n` +
        `The wheel will spin in **3 minutes**! 🕐\n\n` +
        `Get ready — a winner is about to be chosen from the **50 WIN LOTTERY**!`
      )
      .addFields(
        { name: '🎟️ Total Tickets',   value: `${totalTickets}`,  inline: true },
        { name: '👥 Unique Entrants', value: `${uniqueEntries}`, inline: true },
      )
      .setFooter({ text: 'Spinning soon…' })
      .setTimestamp();

    // Defer the reply so we have time for the full countdown sequence.
    // If the interaction was already replied to (e.g. triggered from /buy),
    // skip deferReply and send the countdown as a followUp instead.
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply();
      await interaction.editReply({
        content: '@everyone',
        embeds: [countdownEmbed],
      });
    } else {
      await interaction.followUp({
        content: '@everyone',
        embeds: [countdownEmbed],
      });
    }

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

    // ── Step 3: Visual spinning wheel animation ───────────────────────────────
    // Deceleration schedule (ms per frame) — mirrors the POI game wheel.
    // Total duration ≈ 5.4 s across 14 intermediate frames.
    //   Frames 1-5  → 150 ms  (fast spin)
    //   Frames 6-9  → 400 ms  (slowing down)
    //   Frames 10-12 → 750 ms (crawling)
    //   Frames 13-14 → 1 000 ms (dramatic pause before landing)
    const spinDelays = [
      150, 150, 150, 150, 150,   // frames 1-5  (fast)
      400, 400, 400, 400,        // frames 6-9  (medium)
      750, 750, 750,             // frames 10-12 (slow)
      1000, 1000,                // frames 13-14 (very slow / dramatic)
    ];

    // Build a flat array of display names (one entry per unique participant)
    // so the wheel cycles through real entrant names while spinning.
    const participantNames = uniqueUserIds.map(uid => nameMap.get(uid) ?? `<@${uid}>`);

    // Pick a random name that differs from the previously shown one.
    function pickRandomName(excludeName) {
      const pool = participantNames.filter(n => n !== excludeName);
      // Fall back to the full list if there is only one participant.
      const source = pool.length ? pool : participantNames;
      return source[Math.floor(Math.random() * source.length)];
    }

    let spinMsg;
    let rotation = 0;

    // Send the initial wheel message (frame 0 — already spinning).
    try {
      spinMsg = await channel.send({
        embeds: [generateLotteryWheelEmbed(pickRandomName(null), true, rotation)],
      });
    } catch (err) {
      logError('handleLottery: spin message send', err);
    }

    if (spinMsg) {
      let lastShownName = null;

      for (let i = 0; i < spinDelays.length; i++) {
        await sleep(spinDelays[i]);

        const isLastFrame = i === spinDelays.length - 1;

        // On the very last intermediate frame we still show a random name —
        // the actual winner is revealed in Step 5 via a separate edit.
        const frameName = pickRandomName(lastShownName);
        lastShownName   = frameName;

        // Advance the ring rotation: fast frames jump 3 positions, slow frames 1.
        const jump = i < 5 ? 3 : i < 9 ? 2 : 1;
        rotation   = (rotation + jump) % WHEEL_SEGMENTS.length;

        try {
          await spinMsg.edit({
            embeds: [generateLotteryWheelEmbed(frameName, !isLastFrame, rotation)],
          });
        } catch (err) {
          logError('handleLottery: spin frame edit', err);
          // Non-fatal — continue the animation even if one frame fails.
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

    // ── Step 5: Wheel lands — show the visual "landed" state ─────────────────
    // Edit the spinning wheel message to its final "landed" state, showing the
    // winner's name under the 🎯 pointer with the gold colour.
    const landedEmbed = generateLotteryWheelEmbed(winnerDisplayName, false, rotation);

    // Append the full participant list as a field so viewers can see all entrants.
    const wheelLines = uniqueUserIds.map(uid => {
      const name     = nameMap.get(uid) ?? `<@${uid}>`;
      const tickets  = participants.filter(p => p.user_id === uid).length;
      const isWinner = uid === winnerId;
      return isWinner
        ? `🏆 **${name}** ← WINNER! (${tickets} ticket${tickets !== 1 ? 's' : ''})`
        : `▫️ ${name} (${tickets} ticket${tickets !== 1 ? 's' : ''})`;
    });

    landedEmbed
      .addFields(
        { name: '🎟️ Total Tickets',   value: `${totalTickets}`,  inline: true },
        { name: '👥 Unique Entrants', value: `${uniqueEntries}`, inline: true },
        { name: '🏅 Entrants',        value: wheelLines.join('\n') || '—', inline: false },
      )
      .setFooter({ text: 'The wheel has been cleared. Buy a new ticket to enter the next round!' });

    try {
      if (spinMsg) {
        await spinMsg.edit({ embeds: [landedEmbed] });
      } else {
        await channel.send({ embeds: [landedEmbed] });
      }
    } catch (err) {
      logError('handleLottery: wheel result edit', err);
      try { await channel.send({ embeds: [landedEmbed] }); } catch { /* non-fatal */ }
    }

    // ── Step 6: Final winner announcement ────────────────────────────────────
    const resultEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('🎉 We Have a Winner!')
      .setDescription(
        `🏆 Congratulations to **${winnerTag}** for winning the **50 WIN LOTTERY**!`
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
          `**🪙 50 coins** have been added to your balance.`
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

module.exports = { commands, handleLottery, initLotteryTable, addToLottery, getLotteryParticipants, clearLottery };
