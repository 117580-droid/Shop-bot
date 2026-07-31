const { EmbedBuilder } = require('discord.js');

// ─── Logging ──────────────────────────────────────────────────────────────────
function logError(context, err) {
  console.error(`[ERROR] text-commands/${context}: ${err?.message ?? err}`);
  if (err?.stack) console.error(err.stack);
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

async function handleTextCommands(message, db, client, gameModule, alertBothUsers, guessedPois) {
  const PREFIX = '!';
  const OWNER_ID = process.env.OWNER_ID;
  const GUESS_CHANNEL_ID = '1529364927415062618';
  
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args[0].toLowerCase();

  try {
    // ── !help ──────────────────────────────────────────────────────────────────
    if (command === 'help') {
      return await safeReply(message, {
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('📖 Available Commands')
            .addFields(
              { name: '🎮 Guess Game', value: 'Find Madmotherflupa on the Fortnite map!', inline: false },
              { name: '`!guess <poi>`', value: `Guess a POI location. Only works in <#${GUESS_CHANNEL_ID}>. 120-minute cooldown on wrong guesses.`, inline: false },
              { name: '`!hints`', value: `Show the pixelated location and all guessed POIs with similarity scores. Only works in <#${GUESS_CHANNEL_ID}>.`, inline: false },
              { name: '', value: '', inline: false },
              { name: '💎 Gem & Economy Commands', value: '`!bank [@user]` - Check gem balance\n`!addgem @user <amount>` - Add gems to a user (Owner only)\n`!removegem @user <amount>` - Remove gems from a user (Owner only)\n`!shop` - View shop items\n`!redeem <item name>` - Buy an item from the shop\n`!additem <name> <price>` - Add item to shop (Owner only)\n`!removeitem <name>` - Remove item from shop (Owner only)', inline: false },
              { name: '⭐ Leveling & Stats', value: '`!xp [@user]` - Check XP and level stats\n`!xpleaderboard` - View top 10 players by XP\n`!gemleaderboard` - View top 15 players by gems', inline: false },
              { name: '🏰 Clan Commands', value: '`!clans` - View server clan leaderboard', inline: false },
              { name: '🎯 Game Commands (Slash)', value: '`/currentpoi` - See current POI and game info\n`/guess <poi>` - Guess via slash command\n`/skipcooldown <player>` - Admin: Skip player cooldown\n`/setitem` - Admin: Set current item\n`/additemhint` - Admin: Add hint to item\n`/guessitem` - Guess an item', inline: false },
              { name: '👥 Clan Commands (Slash)', value: '`/clan create <name>` - Create a clan\n`/clan delete` - Delete your clan\n`/clan invite <user>` - Invite user to clan\n`/clan info` - View clan information\n`/level` - Check your level and XP', inline: false },
              { name: '🎰 Lottery Commands (Slash)', value: '`/spinwheel` - Spin the wheel for rewards', inline: false },
              { name: '🎁 Giveaway Commands (Slash)', value: '`/giveaway create` - Start a new giveaway\n`/giveaway edit` - Edit giveaway settings\n`/giveaway delete` - Delete a giveaway\n`/giveaway end` - End giveaway early\n`/giveaway reroll` - Reroll giveaway winners', inline: false },
              { name: '📋 Server Commands (Slash)', value: '`/server-rules` - View server rules', inline: false }
            )
            .setFooter({ text: 'Use !help to see this message again' })
        ]
      });
    }

    // ── !guess ─────────────────────────────────────────────────────────────────
    if (command === 'guess') {
      if (message.channelId !== GUESS_CHANNEL_ID) {
        return await safeReply(message, {
          content: `❌ You can only use !guess in <#${GUESS_CHANNEL_ID}>`,
        });
      }

      const { getCurrentPoi, newRandomPoi, getCooldownRemaining, setCooldown, formatMs, FORTNITE_POIS } = gameModule;
      
      // Safety check: ensure all required functions exist
      if (!getCurrentPoi || !newRandomPoi || !getCooldownRemaining || !setCooldown || !formatMs || !FORTNITE_POIS) {
        logError('guess', 'Missing required gameModule properties');
        return await safeReply(message, {
          content: '❌ Game module not properly initialized. Please try again later.',
        });
      }
      
      const poi = getCurrentPoi();
      
      if (!poi) {
        logError('guess', 'getCurrentPoi() returned null/undefined');
        return await safeReply(message, {
          content: '❌ Could not get current POI. Please try again later.',
        });
      }
      
      const { author: user } = message;

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
              .setDescription(`You found Madmotherflupa at **${poi.name}**!\n\n🎯 New POI: **${newPoi.name}**`)
              .setFooter({ text: newPoi.name }),
          ],
        });
      } else {
        return await safeReply(message, {
          content: `❌ Wrong! Madmotherflupa is hiding at **${poi.name}**, not **${guess}**.`,
        });
      }
    }

    // ── !hints ─────────────────────────────────────────────────────────────────
    if (command === 'hints') {
      if (message.channelId !== GUESS_CHANNEL_ID) {
        return await safeReply(message, {
          content: `❌ You can only use !hints in <#${GUESS_CHANNEL_ID}>`,
        });
      }

      const { getCurrentPoi, FORTNITE_POIS, calculateSimilarity, getCurrentBlurLevel } = gameModule;
      
      // Safety check
      if (!getCurrentPoi || !FORTNITE_POIS || !calculateSimilarity || !getCurrentBlurLevel) {
        logError('hints', 'Missing required gameModule properties');
        return await safeReply(message, {
          content: '❌ Game module not properly initialized. Please try again later.',
        });
      }

      const correctPoi = getCurrentPoi();
      if (!correctPoi) {
        logError('hints', 'getCurrentPoi() returned null/undefined');
        return await safeReply(message, {
          content: '❌ Could not get current POI. Please try again later.',
        });
      }

      // Build hints text showing similarity score and blur level for guessed POIs only
      const guessedPoisList = Array.from(guessedPois || []);
      
      if (guessedPoisList.length === 0) {
        return await safeReply(message, {
          content: '📭 No POIs have been guessed yet! Guess one with `!guess <poi-name>` first.',
        });
      }
      
      const hintsLines = guessedPoisList.map(poiName => {
        const similarity = calculateSimilarity(correctPoi.name, poiName);
        const blur = getCurrentBlurLevel(poiName);
        const blurStatus = blur > 0 ? `(${blur}px blurred)` : '(clear)';
        return `**${poiName}** — Similarity: ${similarity}/100 ${blurStatus}`;
      });

      // Split into multiple embeds if needed (Discord has 4096 char limit per embed description)
      const embedChunks = [];
      let currentChunk = [];
      let currentLength = 0;
      const maxLength = 4000;

      for (const line of hintsLines) {
        const lineLength = line.length + 1; // +1 for newline
        if (currentLength + lineLength > maxLength && currentChunk.length > 0) {
          embedChunks.push(currentChunk.join('\n'));
          currentChunk = [line];
          currentLength = lineLength;
        } else {
          currentChunk.push(line);
          currentLength += lineLength;
        }
      }
      if (currentChunk.length > 0) {
        embedChunks.push(currentChunk.join('\n'));
      }

      // Build embeds - first embed includes the blurred image
      const embeds = embedChunks.map((chunk, index) => {
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle(index === 0 ? '🔍 Pixelated Location' : '📊 Guessed POIs – Hints (continued)')
          .setDescription(chunk)
          .setFooter({ text: `Showing ${guessedPoisList.length} guessed POIs | Higher similarity = closer to the answer` });
        
        // Add the blurred image to the first embed
        if (index === 0) {
          embed.setImage(correctPoi.image);
        }
        
        return embed;
      });

      // Send embeds
      for (const embed of embeds) {
        await safeReply(message, { embeds: [embed] });
      }
    }
  } catch (err) {
    logError(`handleTextCommands [${command}]`, err);
  }
}

module.exports = { handleTextCommands };

