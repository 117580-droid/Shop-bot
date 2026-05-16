const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

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
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
];

// ─── Command handler ──────────────────────────────────────────────────────────
async function handleLottery(interaction, db, client, updateBalance) {
  try {
    const participants = getLotteryParticipants(db);

    if (!participants.length) {
      return await safeReply(interaction, {
        content: '🎡 The lottery wheel is empty — nobody has bought a **50 WIN LOTTERY** ticket yet!',
        ephemeral: true,
      });
    }

    // Pick a random entry (weighted by ticket count naturally, since each
    // purchase inserts a separate row).
    const winnerEntry = participants[Math.floor(Math.random() * participants.length)];
    const winnerId    = winnerEntry.user_id;

    // Award 50 coins to the winner.
    updateBalance(winnerId, 50);

    // Resolve the winner's username for display.
    let winnerTag = `<@${winnerId}>`;
    try {
      const winnerUser = await client.users.fetch(winnerId);
      winnerTag = `${winnerUser.username} (<@${winnerId}>)`;
    } catch {
      // Non-fatal — fall back to mention only
    }

    // Count unique participants and total tickets for the result embed.
    const totalTickets  = participants.length;
    const uniqueEntries = new Set(participants.map(p => p.user_id)).size;

    // Clear the wheel now that a winner has been chosen.
    clearLottery(db);

    // Build the public result embed.
    const resultEmbed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('🎡 Lottery Wheel Spun!')
      .setDescription(`🎉 **${winnerTag}** has won the lottery!`)
      .addFields(
        { name: '🪙 Prize',           value: '50 coins',              inline: true },
        { name: '🎟️ Total Tickets',   value: `${totalTickets}`,       inline: true },
        { name: '👥 Unique Entrants', value: `${uniqueEntries}`,      inline: true },
      )
      .setFooter({ text: 'The wheel has been cleared. Buy a new ticket to enter the next round!' })
      .setTimestamp();

    await safeReply(interaction, { embeds: [resultEmbed] });

    // DM the winner to notify them.
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
