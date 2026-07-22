const { EmbedBuilder } = require('discord.js');

// ─── Logging ──────────────────────────────────────────────────────────────────
function logError(context, err) {
  console.error(`[ERROR] text-commands/${context}: ${err?.message ?? err}`);
}

// ─── Safe reply helper ─────────────────────────────────────────────────────────
async function safeReply(message, payload) {
  try {
    await message.reply(payload);
    // ── !help ─────────────────────────────────────────────────────────────────
    if (command === 'help') {
      return await safeReply(message, {
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('📖 Command Help')
            .setDescription('Here are all the commands you can use:')
            .addFields(
              {
                name: '🎯 Game Commands',
                value: '`!guess <poi-name>` - Guess where Messi is hiding (channel restricted)\n`/spin` - Spin the POI wheel\n`/daily-hint` - Get a daily hint',
                inline: false,
              },
              {
                name: '💰 Economy Commands',
                value: '`!gems [@user]` - Check your or another player's gem balance\n`!shop` - Open the shop to buy items\n`/points [@user]` - Check your or another player's points',
                inline: false,
              },
              {
                name: '⭐ XP & Levels',
                value: '`/level` - Check your XP and level info\n`!xpleaderboard` - View top 10 players by XP',
                inline: false,
              },
              {
                name: '🏰 Clan Commands',
                value: '`/clan create <name>` - Create a new clan\n`/clan delete` - Delete your clan\n`/clan invite <user>` - Invite a user to your clan\n`/clan info` - View your clan info\n`!clans` - View clan leaderboard (top 10)',
                inline: false,
              },
              {
                name: '🎰 Other Commands',
                value: '`/buy` - Buy lottery tickets\n`/spin-wheel` - Spin the wheel\n`/giveaway` - Create a giveaway\n`!help` - Show this help menu',
                inline: false,
              }
            )
            .setFooter({ text: 'Prefix: ! for text commands, / for slash commands' })
            .setTimestamp(),
        ],
      });
    }
  } catch (err) {
    logError('safeReply', err);
  }
}

// ─── Text command handlers ─────────────────────────────────────────────────────

/**
 * Handle text commands with ! prefix
 * @param {Message} message - Discord message object
 * @param {Database} db - SQLite database instance
 * @param {Client} client - Discord client
 * @param {Function} getCurrentPoi - Get current POI function from game.js
 * @param {Function} getCooldownRemaining - Get cooldown function from game.js
 * @param {Function} setCooldown - Set cooldown function from game.js
 * @param {Function} newRandomPoi - Get new random POI function from game.js
 * @param {Function} formatMs - Format milliseconds function
 */
async function handleTextCommands(message, db, client, gameModule, alertBothUsers) {
  const PREFIX = '!';
  
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args[0].toLowerCase();

  try {
    // ── !guess ─────────────────────────────────────────────────────────────────
    if (command === 'guess') {
      // Check channel restriction
      const GUESS_CHANNEL_ID = '1529364927415062618';
      if (message.channelId !== GUESS_CHANNEL_ID) {
        return await safeReply(message, {
          content: `❌ You can only use !guess in <#${GUESS_CHANNEL_ID}>`,
        });
      }

      const { getCurrentPoi, newRandomPoi, getCooldownRemaining, setCooldown, formatMs, FORTNITE_POIS } = gameModule;
      const poi = getCurrentPoi();
      const { user } = message;

      const remaining = getCooldownRemaining(user.id);
      if (remaining > 0) {
        return await safeReply(message, {
          content: `⏳ You guessed recently! You can guess again in **${formatMs(remaining)}**.`,
        });
      }

      const guess = args.slice(1).join(' ').trim();
      if (!guess) {
        return await safeReply(message, {
          content: '❌ Please provide a POI name to guess.\nUsage: `!guess <poi-name>`',
        });
      }

      // Validate that the guess is a real POI name
      const validPois = FORTNITE_POIS.map(p => p.name.toLowerCase());
      if (!validPois.includes(guess.toLowerCase())) {
        return await safeReply(message, {
          content: `❌ **${guess}** is not a valid POI name. Please guess a real Fortnite location.`,
        });
      }

      if (guess.toLowerCase() === poi.name.toLowerCase()) {
        // ✅ Correct!
        setCooldown(user.id);
        const newPoi = newRandomPoi();

        await alertBothUsers(
          client,
          '🎯 Someone Found Messi!',
          `**${user.username}** found Messi at **${poi.name}**!\nNew hiding spot: **${newPoi.name}**`,
          0x57F287,
        );

        return await safeReply(message, {
          embeds: [
            new EmbedBuilder()
              .setColor(0x57F287)
              .setTitle('🎉 Correct!')
              .setThumbnail(poi.image)
              .setDescription(
                `🪙 1 point **${user.username}** found Messi in **${poi.name}**\n\nDM <@1249146669061115904> (Sam), <@1253458483240763434> (Foxyboy3), or <@1347396372688797811> (Emily) to claim your points!`
              )
              .setFooter({ text: poi.name })
              .setTimestamp()
          ],
        });
      } else {
        // ❌ Wrong guess
        const revealedPoi = poi;
        setCooldown(user.id);
        newRandomPoi();

        await alertBothUsers(
          client,
          '❌ Wrong Guess!',
          `**${user.username}** guessed **${guess}** but Messi was at **${revealedPoi.name}**.\nNew hiding spot: **${gameModule.currentPoi.name}**`,
          0xED4245,
        );

        return await safeReply(message, {
          embeds: [
            new EmbedBuilder()
              .setColor(0xED4245)
              .setTitle('❌ Wrong Guess!')
              .setThumbnail(revealedPoi.image)
              .setDescription(
                `**${user.username}** guessed **${guess}**, but Messi was hiding at **${revealedPoi.name}**!`
              )
              .setFooter({ text: revealedPoi.name })
              .setTimestamp()
          ],
        });
      }
    }

    // ── !gems ──────────────────────────────────────────────────────────────────
    if (command === 'gems') {
      const target = message.mentions.users.first() ?? message.author;
      const row = db.prepare('SELECT gems FROM user_xp WHERE user_id = ?').get(target.id);
      const gems = row ? row.gems : 0;

      return await safeReply(message, {
        embeds: [
          new EmbedBuilder()
            .setColor(0xE91E63)
            .setTitle('💎 Gem Balance')
            .setDescription(`**${target.username}** has **${gems} gem${gems !== 1 ? 's' : ''}**.`)
            .setTimestamp(),
        ],
      });
    }

    // ── !shop ──────────────────────────────────────────────────────────────────
    if (command === 'shop') {
      return await safeReply(message, {
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🛍️ Shop')
            .setDescription('Shop is not yet configured. Check back later!')
            .setTimestamp(),
        ],
      });
    }

    // ── !clans ────────────────────────────────────────────────────────────────────
    if (command === 'clans') {
      if (!message.guild) {
        return await safeReply(message, {
          content: '❌ This command can only be used in a server.',
        });
      }

      const clans = db.prepare(`
        SELECT id, name, owner_id, xp, created_at FROM clans WHERE guild_id = ? ORDER BY xp DESC LIMIT 10
      `).all(message.guild.id);

      if (!clans.length) {
        return await safeReply(message, {
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865F2)
              .setTitle('🏰 Clan Leaderboard')
              .setDescription('No clans yet in this server!')
              .setTimestamp(),
          ],
        });
      }

      const clanLines = await Promise.all(
        clans.map(async (clan, i) => {
          let ownerName = 'Unknown User';
          try {
            const owner = await client.users.fetch(clan.owner_id);
            ownerName = owner.username;
          } catch {}
          return `**${i + 1}.** **${clan.name}** (👑 ${ownerName}) - ✨ ${clan.xp.toLocaleString()} XP`;
        })
      );

      return await safeReply(message, {
        embeds: [
          new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle('🏰 Clan Leaderboard')
            .setDescription(clanLines.join('\n'))
            .setFooter({ text: `Top 10 clans in ${message.guild.name}` })
            .setTimestamp(),
        ],
      });
    }

    // ── !xpleaderboard ─────────────────────────────────────────────────────────────
    if (command === 'xpleaderboard') {
      if (!message.guild) {
        return await safeReply(message, {
          content: '❌ This command can only be used in a server.',
        });
      }

      const players = db.prepare(`
        SELECT user_id, level, gems, lifetime_xp FROM user_xp ORDER BY lifetime_xp DESC LIMIT 10
      `).all();

      if (!players.length) {
        return await safeReply(message, {
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865F2)
              .setTitle('🏆 XP Leaderboard')
              .setDescription('No players yet!')
              .setTimestamp(),
          ],
        });
      }

      const playerLines = await Promise.all(
        players.map(async (player, i) => {
          let playerName = 'Unknown User';
          try {
            const user = await client.users.fetch(player.user_id);
            playerName = user.username;
          } catch {}
          return `**${i + 1}.** **${playerName}** - ⭐ Level ${player.level} | ✨ ${player.lifetime_xp.toLocaleString()} XP | 💎 ${player.gems} gems`;
        })
      );

      return await safeReply(message, {
        embeds: [
          new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('🏆 XP Leaderboard')
            .setDescription(playerLines.join('\n'))
            .setFooter({ text: 'Top 10 Players by Lifetime XP' })
            .setTimestamp(),
        ],
      });
    }

    // ── !help ─────────────────────────────────────────────────────────────────
    if (command === 'help') {
      return await safeReply(message, {
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('📖 Command Help')
            .setDescription('Here are all the commands you can use:')
            .addFields(
              {
                name: '🎯 Game Commands',
                value: '`!guess <poi-name>` - Guess where Messi is hiding (channel restricted)\n`/spin` - Spin the POI wheel\n`/daily-hint` - Get a daily hint',
                inline: false,
              },
              {
                name: '💰 Economy Commands',
                value: '`!gems [@user]` - Check your or another player's gem balance\n`!shop` - Open the shop to buy items\n`/points [@user]` - Check your or another player's points',
                inline: false,
              },
              {
                name: '⭐ XP & Levels',
                value: '`/level` - Check your XP and level info\n`!xpleaderboard` - View top 10 players by XP',
                inline: false,
              },
              {
                name: '🏰 Clan Commands',
                value: '`/clan create <name>` - Create a new clan\n`/clan delete` - Delete your clan\n`/clan invite <user>` - Invite a user to your clan\n`/clan info` - View your clan info\n`!clans` - View clan leaderboard (top 10)',
                inline: false,
              },
              {
                name: '🎰 Other Commands',
                value: '`/buy` - Buy lottery tickets\n`/spin-wheel` - Spin the wheel\n`/giveaway` - Create a giveaway\n`!help` - Show this help menu',
                inline: false,
              }
            )
            .setFooter({ text: 'Prefix: ! for text commands, / for slash commands' })
            .setTimestamp(),
        ],
      });
    }
  } catch (err) {
    logError(`handleTextCommands [${command}]`, err);
    await safeReply(message, {
      content: '❌ An error occurred while processing your command.',
    });
  }
}

module.exports = { handleTextCommands };

