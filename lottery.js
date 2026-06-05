const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// ─── Webhook helper ───────────────────────────────────────────────────────────

/**
 * POST a JSON payload to the wheel website's /api/spin endpoint.
 *
 * The base URL is derived from WHEEL_WEBSITE_WEBHOOK (strips any trailing
 * /api/spin path so we can append it cleanly).  If the variable is not set,
 * or if the request fails for any reason, the error is logged and execution
 * continues — the webhook is entirely optional.
 *
 * @param {object} payload - Data to POST as JSON.
 */
async function sendWebhook(payload) {
  let webhookUrl = (process.env.WHEEL_WEBSITE_WEBHOOK ?? '').trim();
  if (!webhookUrl) return; // Webhook not configured — skip silently.

  // Normalise: always target the /api/spin endpoint.
  if (!webhookUrl.endsWith('/api/spin')) {
    webhookUrl = webhookUrl.replace(/\/+$/, '') + '/api/spin';
  }

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
//
// Flow:
//   1. Countdown (3 min) with periodic Discord messages.
//   2. Send ONE Discord message: "🌀 Spinning the wheel on the website…"
//   3. POST a 'spin' webhook to the website with all participants + a callback URL.
//   4. Website animates the wheel smoothly (HTML5 canvas, no Discord rate limits).
//   5. Website POSTs the winner back to the bot's /api/result endpoint.
//   6. Bot edits the Discord message to show the winner and announces the result.
//
// The `waitForResult` parameter is an async function injected by bot.js that
// returns a Promise which resolves to { winner: string } when the website
// calls back, or rejects after a timeout.
//
async function handleLottery(interaction, db, client, updateBalance, targetGuild, waitForResult) {
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

    // Flat display-name array (one entry per ticket, preserving duplicates so
    // the wheel gives each ticket equal weight on the website too).
    const participantNames = participants.map(p => nameMap.get(p.user_id) ?? `<@${p.user_id}>`);

    // ── Step 1: @everyone ping + initial countdown embed ─────────────────────
    // Derive the base website URL from the webhook env var.
    const webhookEnv  = (process.env.WHEEL_WEBSITE_WEBHOOK ?? '').trim();
    const websiteBase = webhookEnv.replace(/\/api\/spin\/?$/, '').replace(/\/+$/, '');

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
    // Tell the website a spin is coming so it can show the countdown timer.
    await sendWebhook({
      action:         'start',
      participants:   participantNames,
      totalTickets,
      uniqueEntrants: uniqueEntries,
      timerSeconds:   180,
    });

    // Resolve the channel we'll post into.
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

    const guild = targetGuild ?? interaction.guild ?? null;

    // ── Step 2: Countdown messages ────────────────────────────────────────────
    const countdownSteps = [
      { waitMs: 60_000, label: '2 minutes'  },
      { waitMs: 60_000, label: '1 minute'   },
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

    await sleep(1_000);

    // ── Step 3: Send the "spinning on website" Discord message ────────────────
    // This is the ONE message that will later be edited to show the winner.
    let spinMsg;
    try {
      spinMsg = await channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🌀 Spinning the Wheel…')
            .setDescription(
              `The wheel is spinning on the website right now!\n\n` +
              (websiteBase ? `🌐 **[Watch the live spin here](${websiteBase})**\n\n` : '') +
              `The winner will be announced here in a few seconds…`
            )
            .setFooter({ text: 'Smooth animation powered by the website — no Discord lag!' })
            .setTimestamp(),
        ],
      });
    } catch (err) {
      logError('handleLottery: spin message send', err);
    }

    // ── Step 4: POST 'spin' webhook to website ────────────────────────────────
    // Include a callbackUrl so the website knows where to POST the result back.
    // The bot's HTTP server listens on BOT_CALLBACK_PORT (default 3000).
    const callbackPort = process.env.BOT_CALLBACK_PORT ?? '3000';
    const callbackHost = process.env.BOT_CALLBACK_HOST ?? `http://localhost:${callbackPort}`;
    const callbackUrl  = `${callbackHost}/api/result`;

    await sendWebhook({
      action:       'spin',
      participants: participantNames,
      totalTickets,
      callbackUrl,
    });

    // ── Step 5: Wait for the website to POST the winner back ──────────────────
    // waitForResult() is injected by bot.js.  It resolves to { winner } when
    // the website calls /api/result, or resolves to null after a 30-second
    // timeout (so the bot can fall back to picking a winner itself).
    let websiteWinner = null;
    if (typeof waitForResult === 'function') {
      try {
        const result = await waitForResult(30_000);
        if (result?.winner) {
          websiteWinner = result.winner;
        }
      } catch (err) {
        logError('handleLottery: waitForResult', err);
      }
    }

    // ── Step 6: Determine the winner ─────────────────────────────────────────
    // Prefer the name returned by the website (it ran the animation and picked
    // the slot the wheel landed on).  Fall back to a random pick if the website
    // didn't respond in time or isn't configured.
    let winnerId;
    let winnerDisplayName;

    if (websiteWinner) {
      // The website returns a display name.  Find the matching participant entry.
      const matchEntry = participants.find(p =>
        (nameMap.get(p.user_id) ?? `<@${p.user_id}>`).toLowerCase() === websiteWinner.toLowerCase()
      );
      if (matchEntry) {
        winnerId           = matchEntry.user_id;
        winnerDisplayName  = nameMap.get(winnerId) ?? `<@${winnerId}>`;
      }
    }

    // Fallback: pick randomly from the DB entries.
    if (!winnerId) {
      const winnerEntry  = participants[Math.floor(Math.random() * participants.length)];
      winnerId           = winnerEntry.user_id;
      winnerDisplayName  = nameMap.get(winnerId) ?? `<@${winnerId}>`;
    }

    // Award 50 points to the winner.
    updateBalance(winnerId, 50);

    const winnerTag = `${winnerDisplayName} (<@${winnerId}>)`;

    // ── Step 7: Edit the "spinning" message to show the winner ────────────────
    const entrantLines = uniqueUserIds.map(uid => {
      const name     = nameMap.get(uid) ?? `<@${uid}>`;
      const tickets  = participants.filter(p => p.user_id === uid).length;
      const isWinner = uid === winnerId;
      return isWinner
        ? `🏆 **${name}** ← WINNER! (${tickets} ticket${tickets !== 1 ? 's' : ''})`
        : `▫️ ${name} (${tickets} ticket${tickets !== 1 ? 's' : ''})`;
    });

    const landedEmbed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('🎯 The Wheel Has Landed!')
      .setDescription(`🏆  **${winnerDisplayName}**  🏆\n\n🎯  **LANDED ON: ${winnerDisplayName}**`)
      .addFields(
        { name: '🎟️ Total Tickets',   value: `${totalTickets}`,  inline: true },
        { name: '👥 Unique Entrants', value: `${uniqueEntries}`, inline: true },
        { name: '🏅 Entrants',        value: entrantLines.join('\n') || '—', inline: false },
      )
      .setFooter({ text: 'Buy a ticket to enter the next round!' })
      .setTimestamp();

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
    await sendWebhook({
      action: 'end',
      winner: winnerDisplayName,
    });

    // ── Step 8: Final winner announcement ────────────────────────────────────
    const resultEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('🎉 We Have a Winner!')
      .setDescription(
        `🏆 Congratulations to **${winnerTag}** for winning the **50 WIN LOTTERY**!`
      )
      .addFields(
        { name: '🪙 Prize',           value: '50 points',            inline: true },
        { name: '🎟️ Winning Ticket',  value: `1 of ${totalTickets}`, inline: true },
      )
      .setTimestamp();

    try {
      await channel.send({ content: `🎉 <@${winnerId}>`, embeds: [resultEmbed] });
    } catch (err) {
      logError('handleLottery: final announcement (main channel)', err);
    }

    // ── Step 9: Broadcast result to #announcements and #general ──────────────
    if (guild) {
      const announcementsChannel = findChannelByName(guild, 'announcements');
      const generalChannel       = findChannelByName(guild, 'general');

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

    // ── Step 10: DM the winner ────────────────────────────────────────────────
    try {
      const winnerUser = await client.users.fetch(winnerId);
      const dmEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🎉 You Won the Lottery!')
        .setDescription(
          `Congratulations! You were picked as the winner of the **50 WIN LOTTERY** wheel!\n\n` +
          `**🪙 50 points** have been added to your balance.`
        )
        .setTimestamp();

      await winnerUser.send({ embeds: [dmEmbed] });
    } catch (err) {
      logError('handleLottery: DM winner', err);
      // Non-fatal — points were still awarded and result posted publicly.
    }

    // ── Clear current round from DB ───────────────────────────────────────────
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
