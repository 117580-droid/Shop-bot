const { EmbedBuilder } = require('discord.js');

// ─── Logging ──────────────────────────────────────────────────────────────────
function logError(context, err) {
  console.error(`[ERROR] text-commands/${context}: ${err?.message ?? err}`);
}

// ─── Safe reply helper ─────────────────────────────────────────────────────────
async function safeReply(message, payload) {
  try {
    await message.reply(payload);
  } catch (err) {
    logError('safeReply', err);
  }
}

// ─── Text command handlers ─────────────────────────────────────────────────────

async function handleTextCommands(message, db, client, gameModule, alertBothUsers) {
  const PREFIX = '!';
  
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args[0].toLowerCase();

  try {
    // ── !guess ─────────────────────────────────────────────────────────────────
    if (command === 'guess') {
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

      const validPois = FORTNITE_POIS.map(p => p.name.toLowerCase());
      if (!validPois.includes(guess.toLowerCase())) {
        return await safeReply(message, {
          content: `❌ **${guess}** is not a valid POI name. Please guess a real Fortnite location.`,
        });
      }

      if (guess.toLowerCase() === poi.name.toLowerCase()) {
        setCooldown(user.id);
        const newPoi = newRandomPoi();

        await alertBothUsers(
          client,
          '🎯 Someone Found Madmotherflupa!',
          `**${user.username}** found Madmotherflupa at **${poi.name}**!\nNew hiding spot: **${newPoi.name}**`,
          0x57F287,
        );

        return await safeReply(message, {
          embeds: [
            new EmbedBuilder()
              .setColor(0x57F287)
              .setTitle('🎉 Correct!')
              .setThumbnail(poi.image)
              .setDescription(
                `🪙 1 point **${user.username}** found Madmotherflupa in **${poi.name}**\n\nDM <@1249146669061115904> (Sam), <@1253458483240763434> (Foxyboy3), or <@1347396372688797811> (Emily) to claim your points!`
              )
              .setFooter({ text: poi.name })
              .setTimestamp()
          ],
        });
      } else {
        const revealedPoi = poi;
        setCooldown(user.id);
        newRandomPoi();

        await alertBothUsers(
          client,
          '❌ Wrong Guess!',
          `**${user.username}** guessed **${guess}** but Madmotherflupa was at **${revealedPoi.name}**.\nNew hiding spot: **${gameModule.currentPoi.name}**`,
          0xED4245,
        );

        return await safeReply(message, {
          embeds: [
            new EmbedBuilder()
              .setColor(0xED4245)
              .setTitle('❌ Wrong Guess!')
              .setThumbnail(revealedPoi.image)
              .setDescription(
                `**${user.username}** guessed **${guess}**, but Madmotherflupa was hiding at **${revealedPoi.name}**!`
              )
              .setFooter({ text: revealedPoi.name })
              .setTimestamp()
          ],
        });
      }
    }

    // ── !gems ──────────────────────────────────────────────────────────────────
    if (command === 'bank') {
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

    // ── !addgem ────────────────────────────────────────────────────────────────
    if (command === 'addgem') {
      const target = message.mentions.users.first();
      const amount = parseInt(args[2]);

      if (!target || isNaN(amount) || amount <= 0) {
        return await safeReply(message, {
          content: '❌ Usage: `!addgem @user <amount>`\nExample: `!addgem @John 5`',
        });
      }

      const row = db.prepare('SELECT gems FROM user_xp WHERE user_id = ?').get(target.id);
      const currentGems = row ? row.gems : 0;
      const newGems = currentGems + amount;

      db.prepare('INSERT INTO user_xp (user_id, gems) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET gems = ?')
        .run(target.id, newGems, newGems);

      return await safeReply(message, {
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('✅ Gems Added')
            .setDescription(`Added **${amount}** gem${amount !== 1 ? 's' : ''} to **${target.username}**\n\nNew balance: **${newGems}** gems`)
            .setTimestamp(),
        ],
      });
    }

    // ── !removegem ─────────────────────────────────────────────────────────────
    if (command === 'removegem') {
      const target = message.mentions.users.first();
      const amount = parseInt(args[2]);

      if (!target || isNaN(amount) || amount <= 0) {
        return await safeReply(message, {
          content: '❌ Usage: `!removegem @user <amount>`\nExample: `!removegem @John 5`',
        });
      }

      const row = db.prepare('SELECT gems FROM user_xp WHERE user_id = ?').get(target.id);
      const currentGems = row ? row.gems : 0;
      const newGems = Math.max(0, currentGems - amount);

      db.prepare('INSERT INTO user_xp (user_id, gems) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET gems = ?')
        .run(target.id, newGems, newGems);

      return await safeReply(message, {
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('✅ Gems Removed')
            .setDescription(`Removed **${amount}** gem${amount !== 1 ? 's' : ''} from **${target.username}**\n\nNew balance: **${newGems}** gems`)
            .setTimestamp(),
        ],
      });
    }

    // ── !xp ────────────────────────────────────────────────────────────────────
    if (command === 'xp') {
      const target = message.mentions.users.first() ?? message.author;
      const row = db.prepare('SELECT level, current_xp, lifetime_xp FROM user_xp WHERE user_id = ?').get(target.id);
      
      const level = row ? row.level : 0;
      const currentXp = row ? row.current_xp : 0;
      const lifetimeXp = row ? row.lifetime_xp : 0;
      const xpNeededPerLevel = 100;
      const xpNeeded = xpNeededPerLevel - currentXp;
      const progressPercent = Math.round((currentXp / xpNeededPerLevel) * 100);

      return await safeReply(message, {
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`⭐ XP Stats - ${target.username}`)
            .addFields(
              {
                name: '📊 Current Level',
                value: `**${level}**`,
                inline: true,
              },
              {
                name: '✨ Lifetime XP',
                value: `**${lifetimeXp.toLocaleString()}** XP`,
                inline: true,
              },
              {
                name: '💫 Progress to Next Level',
                value: `**${currentXp}** / **${xpNeededPerLevel}** XP`,
                inline: false,
              },
              {
                name: '🎯 XP Needed to Level Up',
                value: `**${xpNeeded}** XP`,
                inline: true,
              },
              {
                name: '📈 Progress Bar',
                value: `${'█'.repeat(Math.floor(progressPercent / 5))}${'░'.repeat(20 - Math.floor(progressPercent / 5))} **${progressPercent}%**`,
                inline: false,
              }
            )
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

    // ── !clans ─────────────────────────────────────────────────────────────────
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

    // ── !xpleaderboard ────────────────────────────────────────────────────────
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

    // ── !help ──────────────────────────────────────────────────────────────────
    if (command === 'redeem') {
      return await safeReply(message, {
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🎟️ Lottery Tickets')
            .setDescription('Buy lottery tickets to enter the **50 WIN LOTTERY** wheel draw!')
            .addFields(
              {
                name: '🎰 How It Works',
                value: 'Each ticket costs **50 gems**. Buy as many as you want for better odds!',
                inline: false,
              },
              {
                name: '🏆 Prize',
                value: 'Win **1,000 gems** when your ticket is drawn!',
                inline: false,
              },
              {
                name: '📝 How to Buy',
                value: 'Use `/buy <amount>` to purchase lottery tickets\nExample: `/buy 5` = 5 tickets for 250 gems',
                inline: false,
              },
            )
            .setFooter({ text: 'Use /buy <amount> to purchase tickets' })
            .setTimestamp(),
        ],
      });
    }

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
                value: '`!guess <poi-name>` - Guess where Madmotherflupa is hiding (channel restricted)\n`/spin` - Spin the POI wheel\n`/daily-hint` - Get a daily hint',
                inline: false,
              },
              {
                name: '💰 Economy Commands',
                value: '`!bank [@user]` - Check your or another player\'s gem balance\n`!shop` - Open the shop to buy items\n`!addgem @user <amount>` - Add gems to a user\n`!removegem @user <amount>` - Remove gems from a user',
                inline: false,
              },
              {
                name: '⭐ XP & Levels',
                value: '`!xp [@user]` - Check your or another player\'s XP, level, and progress\n`/level` - Check your XP and level info\n`!xpleaderboard` - View top 10 players by XP',
                inline: false,
              },
              {
                name: '🏰 Clan Commands',
                value: '`/clan create <name>` - Create a new clan\n`/clan delete` - Delete your clan\n`/clan invite <user>` - Invite a user to your clan\n`/clan info` - View your clan info\n`!clans` - View clan leaderboard (top 10)',
                inline: false,
              },
              {
                name: '🎰 Other Commands',
                value: '`!redeem` - Buy lottery tickets\n`/spin-wheel` - Spin the wheel\n`/giveaway` - Create a giveaway\n`!help` - Show this help menu',
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

