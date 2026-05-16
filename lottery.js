const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

function logError(context, err) {
  console.error(`[ERROR] lottery/${context}: ${err?.message ?? err}`);
}

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

function initLotteryTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS lottery_participants (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT    NOT NULL,
      entered_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function addToLottery(db, userId) {
  db.prepare('INSERT INTO lottery_participants (user_id) VALUES (?)').run(userId);
}

function getLotteryParticipants(db) {
  return db.prepare('SELECT * FROM lottery_participants ORDER BY entered_at ASC').all();
}

function clearLottery(db) {
  db.prepare('DELETE FROM lottery_participants').run();
}

const commands = [
  new SlashCommandBuilder()
    .setName('spinwheel')
    .setDescription('Spin the lottery wheel and pick a random winner (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('wheelstatus')
    .setDescription('View who is currently on the lottery wheel'),
];

async function handleLottery(interaction, db, client, updateBalance) {
  const { commandName } = interaction;

  if (commandName === 'spinwheel') {
    return await handleSpinWheel(interaction, db, client, updateBalance);
  }

  if (commandName === 'wheelstatus') {
    return await handleWheelStatus(interaction, db, client);
  }
}

async function handleSpinWheel(interaction, db, client, updateBalance) {
  try {
    const participants = getLotteryParticipants(db);

    if (!participants.length) {
      return await safeReply(interaction, {
        content: '🎡 The lottery wheel is empty — nobody has bought a **50 WIN LOTTERY** ticket yet!',
        ephemeral: true,
      });
    }

    const winnerEntry = participants[Math.floor(Math.random() * participants.length)];
    const winnerId = winnerEntry.user_id;

    updateBalance(winnerId, 50);

    let winnerTag = `<@${winnerId}>`;
    try {
      const winnerUser = await client.users.fetch(winnerId);
      winnerTag = `${winnerUser.username} (<@${winnerId}>)`;
    } catch {
      // Non-fatal
    }

    const totalTickets = participants.length;
    const uniqueEntries = new Set(participants.map(p => p.user_id)).size;

    clearLottery(db);

    const resultEmbed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('🎡 Lottery Wheel Spun!')
      .setDescription(`🎉 **${winnerTag}** has won the lottery!`)
      .addFields(
        { name: '🪙 Prize', value: '50 coins', inline: true },
        { name: '🎟️ Total Tickets', value: `${totalTickets}`, inline: true },
        { name: '👥 Unique Entrants', value: `${uniqueEntries}`, inline: true },
      )
      .setFooter({ text: 'The wheel has been cleared. Buy a new ticket to enter the next round!' })
      .setTimestamp();

    await safeReply(interaction, { embeds: [resultEmbed] });

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
      logError('handleSpinWheel: DM winner', err);
    }

  } catch (err) {
    logError('handleSpinWheel', err);
    await safeReply(interaction, {
      content: '❌ An unexpected error occurred while spinning the wheel. Please try again.',
      ephemeral: true,
    });
  }
}

async function handleWheelStatus(interaction, db, client) {
  try {
    await interaction.deferReply();

    const participants = getLotteryParticipants(db);

    if (!participants.length) {
      return await interaction.editReply({
        content: '🎡 The lottery wheel is empty! Buy a **50 WIN LOTTERY** ticket to enter.',
      });
    }

    const ticketMap = new Map();
    for (const p of participants) {
      ticketMap.set(p.user_id, (ticketMap.get(p.user_id) ?? 0) + 1);
    }

    const entries = await Promise.all(
      Array.from(ticketMap.entries()).map(async ([userId, count]) => {
        let username = 'Unknown User';
        try {
          const user = await client.users.fetch(userId);
          username = user.username;
        } catch {
          // User may have left Discord
        }
        return `**${username}** — 🎟️ ${count} ticket${count !== 1 ? 's' : ''}`;
      })
    );

    const statusEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🎡 Lottery Wheel Status')
      .setDescription(entries.join('\n'))
      .addFields(
        { name: '👥 Unique Entrants', value: `${ticketMap.size}`, inline: true },
        { name: '🎟️ Total Tickets', value: `${participants.length}`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [statusEmbed] });

  } catch (err) {
    logError('handleWheelStatus', err);
    await safeReply(interaction, {
      content: '❌ An unexpected error occurred. Please try again.',
      ephemeral: true,
    });
  }
}

module.exports = { commands, handleLottery, initLotteryTable, addToLottery, getLotteryParticipants, clearLottery };
