// ─── Anti-Spam / Anti-Harassment Protection ───────────────────────────────────
// Monitors all messages for repeated mentions of the protected user and
// automatically mutes offenders with escalating durations.

const { ChannelType } = require('discord.js');

// The Discord user ID that is protected from mention spam.
const PROTECTED_USER_ID = '1417947408691757226';

// Escalating mute durations in minutes:
// 1st offence → 10 min, 2nd → 20 min, 3rd → 30 min,
// 4th → 40 min, 5th → 50 min, 6th+ → 300 min (5 hours)
const MUTE_DURATIONS = [10, 20, 30, 40, 50, 300];

// Tracks per-user mention counts.
// Key: userId  →  Value: { count: number, lastMentionTime: timestamp }
const mentionCounts = new Map();

// Tracks users who are currently muted by the anti-spam system.
// Stores user IDs as strings.
const mutedUsers = new Set();

// ─── Internal helpers ─────────────────────────────────────────────────────────

function log(level, message) {
  const ts = new Date().toISOString();
  const out = `[${ts}] [${level}] [antispam] ${message}`;
  if (level === 'ERROR' || level === 'WARN') {
    console.error(out);
  } else {
    console.log(out);
  }
}

// ─── muteUser ─────────────────────────────────────────────────────────────────

/**
 * Mute a user in all text channels of the guild by denying SendMessages via
 * permission overwrites (consistent with the existing moderation system in
 * bot.js).  Schedules an automatic unmute after durationMinutes.
 *
 * @param {import('discord.js').Guild} guild
 * @param {string} userId
 * @param {number} durationMinutes
 * @returns {Promise<boolean>} true on success, false on failure
 */
async function muteUser(guild, userId, durationMinutes) {
  try {
    const member = await guild.members.fetch(userId);

    const textChannels = guild.channels.cache.filter(
      ch => ch.type === ChannelType.GuildText
    );

    let mutedCount = 0;
    await Promise.all(
      textChannels.map(async ch => {
        try {
          await ch.permissionOverwrites.edit(member, { SendMessages: false }, {
            reason: `Anti-spam: repeated mentions of protected user`,
          });
          mutedCount++;
        } catch {
          // Skip channels where the bot lacks Manage Channel permission
        }
      })
    );

    if (mutedCount === 0) {
      log('WARN', `Could not apply mute overwrites for ${userId} in guild ${guild.id} — bot may lack Manage Channels permission.`);
      return false;
    }

    mutedUsers.add(userId);
    log('INFO', `Muted user ${userId} in guild ${guild.id} for ${durationMinutes} minute(s) (anti-spam).`);

    // Schedule automatic unmute
    const durationMs = durationMinutes * 60 * 1000;
    setTimeout(async () => {
      await unmuteUser(guild, userId);
    }, durationMs);

    return true;
  } catch (err) {
    log('ERROR', `muteUser(${userId}): ${err?.message ?? err}`);
    return false;
  }
}

// ─── unmuteUser ───────────────────────────────────────────────────────────────

/**
 * Remove the SendMessages denial from all text channels for the user, clear
 * them from the muted set, and reset their mention count.
 *
 * @param {import('discord.js').Guild} guild
 * @param {string} userId
 */
async function unmuteUser(guild, userId) {
  try {
    const member = await guild.members.fetch(userId);

    const textChannels = guild.channels.cache.filter(
      ch => ch.type === ChannelType.GuildText
    );

    await Promise.all(
      textChannels.map(ch =>
        ch.permissionOverwrites.edit(member, { SendMessages: null })
          .catch(() => {}) // ignore channels where we lack permission
      )
    );

    mutedUsers.delete(userId);
    mentionCounts.delete(userId);
    log('INFO', `Unmuted user ${userId} in guild ${guild.id} and reset their mention count (anti-spam).`);
  } catch (err) {
    log('ERROR', `unmuteUser(${userId}): ${err?.message ?? err}`);
  }
}

// ─── checkMentions ────────────────────────────────────────────────────────────

/**
 * Inspect an incoming message for mentions of the protected user.  If found,
 * increment the author's mention count and apply an escalating mute.
 *
 * @param {import('discord.js').Message} message
 * @param {import('discord.js').Client} client
 */
async function checkMentions(message, client) {
  try {
    // Only act on guild messages from real users
    if (!message.guild || message.author?.bot) return;

    // Check whether the protected user is mentioned in this message
    const mentionsProtected = message.mentions.users.has(PROTECTED_USER_ID);
    if (!mentionsProtected) return;

    const authorId = message.author.id;

    // Don't stack mutes — if the user is already muted, ignore further mentions
    // until the mute expires and their count is reset.
    if (mutedUsers.has(authorId)) return;

    // Increment mention count for this author
    const existing = mentionCounts.get(authorId) ?? { count: 0, lastMentionTime: 0 };
    const newCount = existing.count + 1;
    mentionCounts.set(authorId, { count: newCount, lastMentionTime: Date.now() });

    // Determine mute duration based on warning level (0-indexed)
    const warningLevel = newCount - 1; // 1st mention → level 0
    const durationMinutes = warningLevel >= MUTE_DURATIONS.length
      ? MUTE_DURATIONS[MUTE_DURATIONS.length - 1]  // cap at 300 min
      : MUTE_DURATIONS[warningLevel];

    const warningDisplay = Math.min(newCount, 6); // display cap at 6

    // Format duration for the public message
    const durationText = durationMinutes >= 60
      ? `${durationMinutes / 60} hour${durationMinutes / 60 !== 1 ? 's' : ''}`
      : `${durationMinutes} minute${durationMinutes !== 1 ? 's' : ''}`;

    // Apply the mute
    const success = await muteUser(message.guild, authorId, durationMinutes);

    if (success) {
      try {
        await message.channel.send(
          `⚠️ **${message.author.username}** has been muted for ${durationText} for spamming mentions of <@${PROTECTED_USER_ID}>. (Warning ${warningDisplay}/6)`
        );
      } catch (err) {
        log('WARN', `checkMentions: could not send warning message in channel ${message.channel.id}: ${err?.message ?? err}`);
      }
    }
  } catch (err) {
    log('ERROR', `checkMentions: ${err?.message ?? err}`);
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = { checkMentions, muteUser, unmuteUser };
