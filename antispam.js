// ─── Anti-Spam / Anti-Harassment Protection ───────────────────────────────────
// Monitors all messages for repeated mentions of the protected user and
// automatically mutes offenders with escalating durations and DM warnings.

const { EmbedBuilder, ChannelType } = require('discord.js');

// The Discord user ID that is protected from mention spam.
const PROTECTED_USER_ID = '1417947408691757226';

// Escalating mute durations in minutes:
// 1st offence → 10 min, 2nd → 20 min, 3rd → 30 min,
// 4th → 40 min, 5th → 50 min, 6th+ → 300 min (5 hours)
const MUTE_DURATIONS = [10, 20, 30, 40, 50, 300];

// ─── Embed colours per violation level ───────────────────────────────────────
// Transitions from green → yellow → orange → red as violations escalate.
const WARNING_COLORS = [
  0x57F287, // Level 0 — green
  0xFEE75C, // Level 1 — yellow
  0xE67E22, // Level 2 — orange
  0xE74C3C, // Level 3 — red
  0xC0392B, // Level 4 — dark red
  0x7B241C, // Level 5 — very dark red
];

// ─── Warning messages (0-indexed, one per violation level) ───────────────────
// Each message is progressively stricter in tone.
const WARNING_MESSAGES = [
  // Level 0 — friendly first warning
  'Please stop mentioning Sam. This behaviour is not welcome here and has resulted in a short mute. Continued violations will lead to increasingly severe consequences.',

  // Level 1 — more serious second warning
  'This is your second warning. Repeatedly mentioning Sam is considered harassment and will not be tolerated. Your mute duration has been extended. Please take this seriously.',

  // Level 2 — stern third warning
  'Final warnings have been given and ignored. You are now receiving a significant mute for continuing to harass Sam. Further violations will result in very long mutes and potential permanent action.',

  // Level 3 — very serious fourth warning
  'You are being monitored closely. Your repeated harassment of Sam has escalated to a severe level. This mute reflects the gravity of your actions. One more violation will result in an extended ban-level mute.',

  // Level 4 — severe fifth warning
  'One more violation and permanent action will be taken. You have been warned multiple times and have continued to harass Sam. This is your final opportunity to stop before irreversible consequences are applied.',

  // Level 5 — harshest sixth warning
  'Permanent action will be taken if this behaviour continues. You have exhausted every warning. Your account is flagged for administrator review and any further harassment of Sam will result in an immediate and permanent ban.',
];

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
 * bot.js).  Schedules an automatic unmute after durationMinutes, then sends
 * the user a DM with an escalating warning embed.
 *
 * @param {import('discord.js').Guild}  guild          - The guild to mute in.
 * @param {string}                      userId         - The ID of the user to mute.
 * @param {number}                      durationMinutes - How long to mute (minutes).
 * @param {number}                      warningLevel   - 0-5 violation index for the DM.
 * @param {import('discord.js').Client} client         - The Discord client (for DMs).
 * @returns {Promise<boolean>} true on success, false on failure
 */
async function muteUser(guild, userId, durationMinutes, warningLevel, client) {
  // Clamp warningLevel to valid range
  const level = Math.max(0, Math.min(5, warningLevel));

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
            reason: `Anti-spam: repeated mentions of protected user (warning ${level + 1}/6)`,
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
    log('INFO', `Muted user ${userId} in guild ${guild.id} for ${durationMinutes} minute(s) (warning level ${level + 1}/6).`);

    // Schedule automatic unmute
    const durationMs = durationMinutes * 60 * 1000;
    setTimeout(async () => {
      await unmuteUser(guild, userId);
    }, durationMs);

    // ── Send DM warning ───────────────────────────────────────────────────────
    try {
      const durationText = durationMinutes >= 60
        ? `${durationMinutes / 60} hour${durationMinutes / 60 !== 1 ? 's' : ''}`
        : `${durationMinutes} minute${durationMinutes !== 1 ? 's' : ''}`;

      const user = await client.users.fetch(userId);

      const embed = new EmbedBuilder()
        .setColor(WARNING_COLORS[level])
        .setTitle(`⚠️ Warning ${level + 1}/6`)
        .setDescription(WARNING_MESSAGES[level])
        .setFooter({ text: `You have been muted for ${durationText}. Please respect all server members.` })
        .setTimestamp();

      await user.send({ embeds: [embed] });
      log('INFO', `Sent warning DM to ${userId} (level ${level + 1}/6).`);
    } catch {
      // DM failure (user has DMs disabled, etc.) must not interrupt the mute
      log('WARN', `Could not send warning DM to ${userId} — DMs may be disabled.`);
    }

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
 * increment the author's mention count and apply an escalating mute with a
 * DM warning.
 *
 * @param {import('discord.js').Message} message
 * @param {import('discord.js').Client} client
 */
async function checkMentions(message, client) {
  try {
    // Only act on guild messages from real users
    if (!message.guild || message.author?.bot) return;

    // Count how many times the protected user is mentioned in this message
    const mentionCount = message.mentions.users.filter(u => u.id === PROTECTED_USER_ID).size;
    if (mentionCount === 0) return;

    const authorId = message.author.id;

    // Increment mention count for this author by the number of mentions in this message
    const existing = mentionCounts.get(authorId) ?? { count: 0, lastMentionTime: 0 };
    const newCount = existing.count + mentionCount;
    mentionCounts.set(authorId, { count: newCount, lastMentionTime: Date.now() });

    // Don't stack mutes — if the user is already muted, count the mention but
    // don't apply another mute until the current one expires and count resets.
    if (mutedUsers.has(authorId)) return;

    // ── Immediate maximum penalty for 6+ mentions in one message ─────────────
    // If the author crammed more than 5 mentions into a single message, apply
    // the harshest mute immediately (level 5, 300 minutes / 5 hours) with a
    // public channel warning, then ALSO fall through to the normal escalating
    // logic below so both penalties are applied.
    if (mentionCount > 5) {
      const maxLevel = 5;
      const maxDuration = MUTE_DURATIONS[maxLevel]; // 300 minutes

      log('INFO', `User ${authorId} mentioned protected user ${mentionCount} times in one message — applying immediate max mute.`);

      const success = await muteUser(message.guild, authorId, maxDuration, maxLevel, client);

      if (success) {
        try {
          await message.channel.send(
            `⛔ **${message.author.username}** has been muted for 5 hours for including an excessive number of mentions of <@${PROTECTED_USER_ID}> in a single message. (Warning 6/6)`
          );
        } catch (err) {
          log('WARN', `checkMentions: could not send warning message in channel ${message.channel.id}: ${err?.message ?? err}`);
        }
      }

      // Do NOT return — fall through to the normal escalating logic so the
      // cumulative mute is also applied on top of the immediate max mute.
    }

    // ── Normal escalating mute logic ──────────────────────────────────────────
    // Determine mute duration and warning level based on violation count (0-indexed).
    // This runs for every offence, including those that already triggered the
    // immediate max mute above.
    const warningLevel = Math.min(newCount - 1, 5); // 1st mention → level 0, cap at 5
    const durationMinutes = warningLevel >= MUTE_DURATIONS.length
      ? MUTE_DURATIONS[MUTE_DURATIONS.length - 1]  // cap at 300 min
      : MUTE_DURATIONS[warningLevel];

    const warningDisplay = Math.min(newCount, 6); // display cap at 6

    // Format duration for the public channel message
    const durationText = durationMinutes >= 60
      ? `${durationMinutes / 60} hour${durationMinutes / 60 !== 1 ? 's' : ''}`
      : `${durationMinutes} minute${durationMinutes !== 1 ? 's' : ''}`;

    // Apply the mute and send the DM warning
    const success = await muteUser(message.guild, authorId, durationMinutes, warningLevel, client);

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
