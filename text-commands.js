const { EmbedBuilder } = require('discord.js');

// ─── Quest creation state tracker ──────────────────────────────────────────────
const questCreationState = new Map(); // userId -> { step, title, description, reward }

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
    // ── Check if user is in quest creation flow ────────────────────────────────
    if (questCreationState.has(message.author.id) && command !== 'addquest') {
      const state = questCreationState.get(message.author.id);
      const input = message.content.trim();

      if (state.step === 1) {
        // Collecting title
        state.title = input;
        state.step = 2;
        return await safeReply(message, {
          content: '✅ Title set: **' + input + '**\n\n📝 Now reply with the quest **description**',
        });
      } else if (state.step === 2) {
        // Collecting description
        state.description = input;
        state.step = 3;
        return await safeReply(message, {
          content: '✅ Description set\n\n💰 Now reply with the **reward amount** (any number)',
        });
      } else if (state.step === 3) {
        // Collecting reward - accept any integer
        const numStr = input.trim();
        const reward = parseInt(numStr);
        
        // If parseInt returns NaN, try to extract just the numeric part
        if (isNaN(reward)) {
          return await safeReply(message, {
            content: '❌ I could not read that as a number. Please reply with just a number (like `100` or `-50` or `0`).',
          });
        }

        // Create quests table if it doesn't exist
        db.prepare(`
          CREATE TABLE IF NOT EXISTS quests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            reward INTEGER NOT NULL,
            active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `).run();

        // Save the quest to database
        db.prepare('INSERT INTO quests (guild_id, title, description, reward, active) VALUES (?, ?, ?, ?, 1)')
          .run(message.guild.id, state.title, state.description, reward);

        // Clear the state
        questCreationState.delete(message.author.id);

        return await safeReply(message, {
          embeds: [
            new EmbedBuilder()
              .setColor(0x57F287)
              .setTitle('✅ Quest Created!')
              .addFields(
                { name: 'Title', value: state.title, inline: false },
                { name: 'Description', value: state.description, inline: false },
                { name: 'Reward', value: `💰 ${reward} XP`, inline: false }
              )
              .setTimestamp(),
          ],
        });
      }
    }

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
              { name: '⭐ Leveling & Stats', value: '`!xp [@user]` - Check XP and level stats\n`!xpleaderboard` - View top 10 players by XP\n`!gemleaderboard` - View top 15 players by gems\n`!addxp @user <amount>` - Add XP to a user (Owner only)\n`!removexp @user <amount>` - Remove XP from a user (Owner only)', inline: false },
              { name: '📋 Quest Commands', value: '`!addquest <title> | <description> | <reward>` - Create a new quest in one command (Owner only)\n`!endquest` - End the current quest (Owner only)', inline: false },
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

    // ── !addxp ────────────────────────────────────────────────────────────────
    if (command === 'addxp') {
      if (message.author.id !== OWNER_ID) {
        return await safeReply(message, {
          content: '❌ Only the bot owner can use this command.',
        });
      }

      const target = message.mentions.users.first();
      const amount = parseInt(args[2]);

      if (!target || isNaN(amount) || amount <= 0) {
        return await safeReply(message, {
          content: '❌ Usage: `!addxp @user <amount>`\nExample: `!addxp @John 100`',
        });
      }

      const row = db.prepare('SELECT current_xp, lifetime_xp, level FROM user_xp WHERE user_id = ?').get(target.id);
      const currentXp = row ? row.current_xp : 0;
      const lifetimeXp = row ? row.lifetime_xp : 0;
      const level = row ? row.level : 0;
      const xpNeededPerLevel = 100;

      let newCurrentXp = currentXp + amount;
      let newLevel = level;
      let newLifetimeXp = lifetimeXp + amount;

      // Check for level ups
      while (newCurrentXp >= xpNeededPerLevel) {
        newCurrentXp -= xpNeededPerLevel;
        newLevel += 1;
      }

      db.prepare('INSERT INTO user_xp (user_id, current_xp, lifetime_xp, level) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET current_xp = ?, lifetime_xp = ?, level = ?')
        .run(target.id, newCurrentXp, newLifetimeXp, newLevel, newCurrentXp, newLifetimeXp, newLevel);

      return await safeReply(message, {
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('✅ XP Added')
            .setDescription(`Added **${amount}** XP to **${target.username}**`)
            .addFields(
              { name: 'Level', value: `${level} → ${newLevel}`, inline: true },
              { name: 'Lifetime XP', value: `${lifetimeXp.toLocaleString()} → ${newLifetimeXp.toLocaleString()}`, inline: true },
              { name: 'Progress to Next Level', value: `${newCurrentXp}/${xpNeededPerLevel} XP`, inline: false }
            )
            .setTimestamp(),
        ],
      });
    }

    // ── !removexp ──────────────────────────────────────────────────────────────
    if (command === 'removexp') {
      if (message.author.id !== OWNER_ID) {
        return await safeReply(message, {
          content: '❌ Only the bot owner can use this command.',
        });
      }

      const target = message.mentions.users.first();
      const amount = parseInt(args[2]);

      if (!target || isNaN(amount) || amount <= 0) {
        return await safeReply(message, {
          content: '❌ Usage: `!removexp @user <amount>`\nExample: `!removexp @John 50`',
        });
      }

      const row = db.prepare('SELECT current_xp, lifetime_xp, level FROM user_xp WHERE user_id = ?').get(target.id);
      const currentXp = row ? row.current_xp : 0;
      const lifetimeXp = row ? row.lifetime_xp : 0;
      const level = row ? row.level : 0;
      const xpNeededPerLevel = 100;

      let newLifetimeXp = Math.max(0, lifetimeXp - amount);
      let newCurrentXp = currentXp;
      let newLevel = level;
      let remaining = amount;

      // Remove from current XP first
      if (remaining <= newCurrentXp) {
        newCurrentXp -= remaining;
        remaining = 0;
      } else {
        remaining -= newCurrentXp;
        newCurrentXp = 0;
      }

      // Remove from previous levels if needed
      while (remaining > 0 && newLevel > 0) {
        newLevel -= 1;
        remaining -= xpNeededPerLevel;
      }

      // If we had excess, add it back to current XP
      if (remaining < 0) {
        newCurrentXp = Math.abs(remaining);
      }

      db.prepare('INSERT INTO user_xp (user_id, current_xp, lifetime_xp, level) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET current_xp = ?, lifetime_xp = ?, level = ?')
        .run(target.id, newCurrentXp, newLifetimeXp, newLevel, newCurrentXp, newLifetimeXp, newLevel);

      return await safeReply(message, {
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('✅ XP Removed')
            .setDescription(`Removed **${amount}** XP from **${target.username}**`)
            .addFields(
              { name: 'Level', value: `${level} → ${newLevel}`, inline: true },
              { name: 'Lifetime XP', value: `${lifetimeXp.toLocaleString()} → ${newLifetimeXp.toLocaleString()}`, inline: true },
              { name: 'Progress to Next Level', value: `${newCurrentXp}/${xpNeededPerLevel} XP`, inline: false }
            )
            .setTimestamp(),
        ],
      });
    }

    // ── !addquest ──────────────────────────────────────────────────────────────
    if (command === 'addquest') {
      if (message.author.id !== OWNER_ID) {
        return await safeReply(message, {
          content: '❌ Only the bot owner can use this command.',
        });
      }

      // Create quests table if it doesn't exist
      db.prepare(`
        CREATE TABLE IF NOT EXISTS quests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          reward INTEGER NOT NULL,
          active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();

      // Get everything after !addquest
      const questContent = args.slice(1).join(' ');
      
      if (questContent.includes('|')) {
        // Parse the pipe-separated format: title | description | reward
        const parts = questContent.split('|').map(p => p.trim());
        
        if (parts.length !== 3) {
          return await safeReply(message, {
            content: '❌ Invalid format. Use: `!addquest <title> | <description> | <reward>`\nExample: `!addquest Find Treasure | Search the map for treasure | 100`',
          });
        }

        const [title, description, rewardStr] = parts;
        const reward = parseInt(rewardStr);

        if (!title || !description || isNaN(reward)) {
          return await safeReply(message, {
            content: '❌ Invalid input. Make sure title and description are not empty, and reward is a number.',
          });
        }

        // Save the quest to database
        db.prepare('INSERT INTO quests (guild_id, title, description, reward, active) VALUES (?, ?, ?, ?, 1)')
          .run(message.guild.id, title, description, reward);

        return await safeReply(message, {
          embeds: [
            new EmbedBuilder()
              .setColor(0x57F287)
              .setTitle('✅ Quest Created!')
              .addFields(
                { name: 'Title', value: title, inline: false },
                { name: 'Description', value: description, inline: false },
                { name: 'Reward', value: `💰 ${reward} XP`, inline: false }
              )
              .setTimestamp(),
          ],
        });
      } else {
        // Fall back to conversational mode
        questCreationState.set(message.author.id, { step: 1, title: '', description: '', reward: 0 });

        return await safeReply(message, {
          content: '🎯 **Quest Creation Started**\n\nReply with the quest **title** (one line)',
        });
      }
    }

    // ── !endquest ──────────────────────────────────────────────────────────────
    if (command === 'endquest') {
      if (message.author.id !== OWNER_ID) {
        return await safeReply(message, {
          content: '❌ Only the bot owner can use this command.',
        });
      }

      // Get active quest
      db.prepare(`
        CREATE TABLE IF NOT EXISTS quests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          reward INTEGER NOT NULL,
          active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();

      const quest = db.prepare('SELECT id, title FROM quests WHERE guild_id = ? AND active = 1 ORDER BY created_at DESC LIMIT 1')
        .get(message.guild.id);

      if (!quest) {
        return await safeReply(message, {
          content: '❌ No active quest found.',
        });
      }

      db.prepare('UPDATE quests SET active = 0 WHERE id = ?').run(quest.id);

      return await safeReply(message, {
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('✅ Quest Ended')
            .setDescription(`**${quest.title}** has been ended.`)
            .setTimestamp(),
        ],
      });
    }
  } catch (err) {
    logError(`handleTextCommands [${command}]`, err);
  }
}

module.exports = { handleTextCommands };

