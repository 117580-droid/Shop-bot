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

async function handleTextCommands(message, db, client, gameModule, alertBothUsers) {
  const PREFIX = '!';
  const OWNER_ID = process.env.OWNER_ID;
  
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
  } catch (err) {
    logError(`handleTextCommands [${command}]`, err);
  }
}

module.exports = { handleTextCommands };

