const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// ─── Webhook helper ───────────────────────────────────────────────────────────

/**
 * Send a JSON payload to the wheel website webhook.
 *
 * The webhook URL is read from the WHEEL_WEBSITE_WEBHOOK environment variable.
 * If the variable is not set, or if the request fails for any reason, the error
 * is logged and execution continues — the webhook is entirely optional.
 *
 * @param {object} payload - Data to POST as JSON.
 */
async function sendWebhook(payload) {
  const webhookUrl = process.env.WHEEL_WEBSITE_WEBHOOK;
  if (!webhookUrl) return; // Webhook not configured — skip silently.

  try {
    await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
  } catch (err) {
    logError('sendWebhook', err);
  }
}

// ─── Wheel graphic constants ──────────────────────────────────────────────────

// Number of named slots around the wheel.  Must stay at 8 so the ASCII art
// positions (top, top-right, right, bottom-right, bottom, bottom-left, left,
// top-left) map 1-to-1 onto the SLOT_* layout constants below.
const WHEEL_SLOTS = 8;

// Decorative centre icons that cycle while the wheel is spinning.
const CENTER_ICONS = ['🎰', '🌀', '💫', '⭐', '🌟', '✨', '🎲', '🎯'];

// Divider lines used inside the wheel ring to suggest segment boundaries.
// Each entry is one of four diagonal/straight spoke characters.
const SPOKES = ['╱', '│', '╲', '─', '╱', '│', '╲', '─'];

/**
 * Truncate a display name so it fits inside a wheel slot without breaking the
 * layout.  Slots have a maximum of 10 visible characters.
 */
function truncateName(name, max = 10) {
  if (name.length <= max) return name;
  return name.slice(0, max - 1) + '…';
}

/**
 * Pad a name to exactly `width` characters (centred) using spaces.
 * Used to keep the wheel ring columns aligned.
 */
function padCenter(str, width) {
  const pad = Math.max(0, width - str.length);
  const left  = Math.floor(pad / 2);
  const right = pad - left;
  return ' '.repeat(left) + str + ' '.repeat(right);
}

/**
 * Build a real ASCII roulette-wheel embed.
 *
 * The wheel has 8 named slots arranged around a circle.  The `rotationOffset`
 * parameter shifts which participant name appears in each slot, creating the
 * illusion of the wheel rotating.  A fixed ▼ pointer sits above the top slot
 * so viewers can see which name is "under the needle".
 *
 * Layout (code-block, monospace):
 *
 *              ▼  ← pointer (fixed)
 *        ┌─────────────┐
 *   [TL] │  [T]  │  [TR] │
 *        │───────┼───────│
 *   [L]  │  [C]  │  [R]  │
 *        │───────┼───────│
 *   [BL] │  [B]  │  [BR] │
 *        └─────────────┘
 *
 * @param {string[]} participantNames  All unique participant display names.
 * @param {string}   selectedName      Name currently under the pointer (top slot).
 * @param {boolean}  isSpinning        true → spinning; false → landed.
 * @param {number}   rotationOffset    How many slots the wheel has rotated.
 * @returns {EmbedBuilder}
 */
function generateLotteryWheelEmbed(participantNames, selectedName, isSpinning, rotationOffset = 0) {
  const total = participantNames.length;

  // ── Build the 8-slot ring ─────────────────────────────────────────────────
  // Slot indices (clockwise from top):
  //   0 = top, 1 = top-right, 2 = right, 3 = bottom-right,
  //   4 = bottom, 5 = bottom-left, 6 = left, 7 = top-left
  //
  // We rotate the participant list by `rotationOffset` so slot 0 always shows
  // the "current" name under the pointer.
  const slots = Array.from({ length: WHEEL_SLOTS }, (_, i) => {
    if (total === 0) return '———';
    const nameIdx = (rotationOffset + i) % total;
    return truncateName(participantNames[nameIdx], 10);
  });

  // Slot aliases for readability
  const [sTop, sTR, sRight, sBR, sBot, sBL, sLeft, sTL] = slots;

  // ── Centre icon ───────────────────────────────────────────────────────────
  const centerIcon = isSpinning
    ? CENTER_ICONS[rotationOffset % CENTER_ICONS.length]
    : '🏆';

  // ── Spoke character (rotates to suggest motion) ───────────────────────────
  const spoke = SPOKES[rotationOffset % SPOKES.length];

  // ── Highlight the top slot (under the pointer) ────────────────────────────
  const topLabel    = isSpinning ? `◀ ${padCenter(sTop, 10)} ▶` : `★ ${padCenter(sTop, 10)} ★`;
  const tlLabel     = padCenter(sTL,    10);
  const trLabel     = padCenter(sTR,    10);
  const leftLabel   = padCenter(sLeft,  10);
  const rightLabel  = padCenter(sRight, 10);
  const blLabel     = padCenter(sBL,    10);
  const brLabel     = padCenter(sBR,    10);
  const botLabel    = padCenter(sBot,   10);

  // ── Assemble the wheel as a monospace code block ──────────────────────────
  //
  // The wheel is drawn as a 7-row ASCII diagram inside a Discord code block.
  // Each row is exactly the same width so the circle looks round.
  //
  //   Row 0:          ▼  (pointer, centred above top slot)
  //   Row 1:    ╭──────────────────────────╮
  //   Row 2:    │  [TL]   [TOP]   [TR]     │
  //   Row 3:    │  [L]   [icon]   [R]      │
  //   Row 4:    │  [BL]   [BOT]   [BR]     │
  //   Row 5:    ╰──────────────────────────╯
  //
  // We use a fixed-width inner area of 34 chars so names up to 10 chars each
  // fit comfortably with separators.

  const W = 36; // inner width of the wheel (between the │ borders)

  function row(...cols) {
    // Join columns with a spoke separator and pad the whole row to W chars.
    const inner = cols.join(` ${spoke} `);
    const padded = inner.padEnd(W);
    return `│${padded}│`;
  }

  const topBorder = `╭${'─'.repeat(W)}╮`;
  const midDiv    = `├${'─'.repeat(W)}┤`;
  const botBorder = `╰${'─'.repeat(W)}╯`;

  // Pointer line — centred over the top-slot column (roughly col 2 of 3).
  // The top slot is in the middle column, so we offset the pointer accordingly.
  const pointerOffset = Math.floor(W / 2);
  const pointerLine   = ' '.repeat(pointerOffset) + '▼';

  const wheelLines = [
    pointerLine,
    topBorder,
    row(tlLabel, topLabel, trLabel),
    midDiv,
    row(leftLabel, ` ${centerIcon} `.padEnd(12), rightLabel),
    midDiv,
    row(blLabel, botLabel, brLabel),
    botBorder,
  ];

  // ── Status line ───────────────────────────────────────────────────────────
  const statusLine = isSpinning
    ? `🌀  **Spinning…**`
    : `🎯  **LANDED ON:  ${selectedName}**`;

  // ── Current selection callout ─────────────────────────────────────────────
  const selectionLine = isSpinning
    ? `**Under the pointer →** ${selectedName}`
    : `🏆  **${selectedName}**  🏆`;

  // ── Full description ──────────────────────────────────────────────────────
  const description = [
    '```',
    ...wheelLines,
    '```',
    '',
    selectionLine,
    statusLine,
  ].join('\n');

  // Embed colour: blurple while spinning, gold when landed.
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

    // Build the flat display-name array here so it is available for both the
    // early 'start' webhook call and the spin animation later.
    const participantNames = participants.map(p => nameMap.get(p.user_id) ?? `<@${p.user_id}>`);

    // ── Step 1: @everyone ping + initial countdown embed ─────────────────────
    // Derive the base website URL by stripping the /api/spin suffix from the
    // webhook URL so we can include a clickable link in the countdown embed.
    const webhookUrl  = process.env.WHEEL_WEBSITE_WEBHOOK ?? '';
    const websiteBase = webhookUrl.replace(/\/api\/spin\/?$/, '');

    const countdownEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🎡 The Lottery Wheel is About to Spin!')
      .setDescription(
        `@everyone\n\n` +
        `The wheel will spin in **3 minutes**! 🕐\n\n` +
        `Get ready — a winner is about to be chosen from the **50 WIN LOTTERY**!` +
        (websiteBase ? `\n\n🌐 Watch live: [Lottery Wheel](${websiteBase})` : '')
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

    // ── Webhook: countdown start ──────────────────────────────────────────────
    // Notify the website immediately so it can display a synchronised 3-minute
    // countdown timer and automatically trigger the spin animation when it
    // reaches zero.  Fire-and-forget — failure must not block the Discord flow.
    await sendWebhook({
      action:         'start',
      participants:   participantNames,
      totalTickets,
      uniqueEntrants: uniqueEntries,
      timerSeconds:   180,
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
        embeds: [generateLotteryWheelEmbed(participantNames, pickRandomName(null), true, rotation)],
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
        // Modulo by the number of participants (min 1) so the index stays in range.
        const jump = i < 5 ? 3 : i < 9 ? 2 : 1;
        rotation   = (rotation + jump) % Math.max(participantNames.length, 1);

        try {
          await spinMsg.edit({
            embeds: [generateLotteryWheelEmbed(participantNames, frameName, !isLastFrame, rotation)],
          });
        } catch (err) {
          logError('handleLottery: spin frame edit', err);
          // Non-fatal — continue the animation even if one frame fails.
        }

        // ── Webhook: frame update ───────────────────────────────────────────
        // Send the current rotation state so the website can mirror each frame.
        await sendWebhook({
          action:      'frame',
          currentName: frameName,
          rotation,
        });

      }
    }

    // ── Step 4: Pick the winner ───────────────────────────────────────────────
    const winnerEntry = participants[Math.floor(Math.random() * participants.length)];
    const winnerId    = winnerEntry.user_id;

    // Award 50 coins to the winner.
    updateBalance(winnerId, 50);

    const winnerDisplayName = nameMap.get(winnerId) ?? `<@${winnerId}>`;
    const winnerTag = `${winnerDisplayName} (<@${winnerId}>)`;

    // ── Step 5: Wheel lands — show the visual "landed" state ─────────────────
    // Edit the spinning wheel message to its final "landed" state, showing the
    // winner's name under the 🎯 pointer with the gold colour.
    const landedEmbed = generateLotteryWheelEmbed(participantNames, winnerDisplayName, false, rotation);


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
      .setFooter({ text: 'Buy a ticket to enter the next round!' });

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

    // ── Webhook: spin end ─────────────────────────────────────────────────────
    // Tell the website the wheel has landed and who won so it can display the
    // final result.  Fire-and-forget — failure must not affect the Discord flow.
    await sendWebhook({
      action:   'end',
      winner:   winnerDisplayName,
      rotation,
    });

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

    // ── Clear current round from DB ───────────────────────────────────────────
    // Participants are kept in the database throughout the entire spin so that
    // the website can display all names while the wheel is running.  Only now
    // that the spin is fully complete (winner announced, DM sent) do we clear
    // the table.  Any tickets purchased during the spin are part of this round;
    // the next round starts with a clean slate from this point forward.
    clearLottery(db);
    await sendWebhook({ action: 'reset' });

  } catch (err) {
    logError('handleLottery', err);
    await safeReply(interaction, {
      content: '❌ An unexpected error occurred while spinning the wheel. Please try again.',
      ephemeral: true,
    });
  }
}

module.exports = { commands, handleLottery, initLotteryTable, addToLottery, getLotteryParticipants, clearLottery };
