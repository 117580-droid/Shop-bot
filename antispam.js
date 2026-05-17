// ─── Anti-Spam / Anti-Harassment Protection ───────────────────────────────────
// Monitors all messages for repeated mentions of the protected user and
// automatically mutes offenders with escalating durations and DM warnings.
// Mutes are applied via a pluggable executor registered by bot.js so that the
// anti-spam system uses the same /mute command logic as manual moderation.

const { EmbedBuilder } = require('discord.js');

// The Discord user ID that is protected from mention spam.
const PROTECTED_USER_ID = '1417947408691757226';

// Escalating mute durations in minutes:
// 1st offence → 10 min, 2nd → 20 min, 3rd → 30 min,
// 4th → 40 min, 5th → 50 min, 6th → 300 min (5 hours), 7th → 1440 min (1 day)
const MUTE_DURATIONS = [10, 20, 30, 40, 50, 300, 1440];

// ─── Embed colours per violation level ───────────────────────────────────────
// Transitions from green → yellow → orange → red as violations escalate.
const WARNING_COLORS = [
  0x57F287, // Level 0 — green
  0xFEE75C, // Level 1 — yellow
  0xE67E22, // Level 2 — orange
  0xE74C3C, // Level 3 — red
  0xC0392B, // Level 4 — dark red
  0x7B241C, // Level 5 — very dark red
  0x4A0000, // Level 6 — near black red (1-day ban)
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

  // Level 6 — seventh and final warning (1-day ban)
  'You have been issued a 1-day ban for repeated and severe harassment of Sam. This is the maximum automated penalty. Administrators have been notified and permanent action is imminent if this behaviour does not stop.',
];

// Tracks per-user mention counts.
// Key: userId  →  Value: { count: number, lastMentionTime: timestamp }
const mentionCounts = new Map();

// Tracks users who are currently muted by the anti-spam system.
// Stores user IDs as strings.
const mutedUsers = new Set();

// ─── Pluggable mute executor ──────────────────────────────────────────────────
// Set by bot.js via setMuteExecutor() once the Discord client is ready.
// Signature: (guild, userId, durationMinutes, warningLevel, client) => Promise<boolean>
let muteExecutor = null;

/**
 * Register the function that performs the actual channel-overwrite mute.
 * Must be called by bot.js before any messages are processed.
 *
 * @param {Function} fn - async (guild, userId, durationMinutes, warningLevel, client) => boolean
 */
function setMuteExecutor(fn) {
  muteExecutor = fn;
  log('INFO', 'Mute executor registered.');
}

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
 * Mute a user by delegating to the executor registered by bot.js (which uses
 * the same channel-overwrite logic as the /mute command), then send the user
 * a DM with an escalating warning embed.
 *
 * @param {import('discord.js').Guild}  guild           - The guild to mute in.
 * @param {string}                      userId          - The ID of the user to mute.
 * @param {number}                      durationMinutes - How long to mute (minutes).
 * @param {number}                      warningLevel    - 0-6 violation index for the DM.
 * @param {import('discord.js').Client} client          - The Discord client (for DMs).
 * @returns {Promise<boolean>} true on success, false on failure
 */
async function muteUser(guild, userId, durationMinutes, warningLevel, client) {
  // Clamp warningLevel to valid range
  const level = Math.max(0, Math.min(6, warningLevel));

  if (!muteExecutor) {
    log('WARN', `muteUser(${userId}): mute executor not yet registered — skipping mute.`);
    return false;
  }

  try {
    // Delegate the actual timeout mute to the executor provided by bot.js
    const success = await muteExecutor(guild, userId, durationMinutes, level, client);

    if (success) {
      mutedUsers.add(userId);
      log('INFO', `Muted user ${userId} in guild ${guild.id} for ${durationMinutes} minute(s) (warning level ${level + 1}/7).`);
    } else {
      log('WARN', `muteUser(${userId}): executor reported failure for guild ${guild.id} — timeout not applied, but warnings will still be sent.`);
    }

    return success;
  } catch (err) {
    log('ERROR', `muteUser(${userId}): ${err?.message ?? err}`);
    return false;
  }
}

// ─── sendWarningDM ────────────────────────────────────────────────────────────

/**
 * Send a DM warning embed to the offending user.  Called by checkMentions()
 * regardless of whether the timeout succeeded, so the user is always informed.
 *
 * @param {import('discord.js').Client} client
 * @param {string}  userId          - The ID of the user to DM.
 * @param {number}  level           - 0-6 violation index.
 * @param {number}  durationMinutes - Intended mute duration (shown in the DM).
 * @param {boolean} timeoutApplied  - Whether the Discord timeout actually succeeded.
 */
async function sendWarningDM(client, userId, level, durationMinutes, timeoutApplied) {
  try {
    const durationText = durationMinutes >= 60
      ? `${durationMinutes / 60} hour${durationMinutes / 60 !== 1 ? 's' : ''}`
      : `${durationMinutes} minute${durationMinutes !== 1 ? 's' : ''}`;

    const user = await client.users.fetch(userId);

    const footerText = timeoutApplied
      ? `You have been muted for ${durationText}. Please respect all server members.`
      : `A mute of ${durationText} was attempted but could not be applied (bot is missing the Moderate Members permission). You are still being monitored and this violation has been recorded.`;

    const embed = new EmbedBuilder()
      .setColor(WARNING_COLORS[level])
      .setTitle(`⚠️ Warning ${level + 1}/7`)
      .setDescription(WARNING_MESSAGES[level])
      .setFooter({ text: footerText })
      .setTimestamp();

    await user.send({ embeds: [embed] });
    log('INFO', `Sent warning DM to ${userId} (level ${level + 1}/7, timeout applied: ${timeoutApplied}).`);
  } catch {
    // DM failure (user has DMs disabled, etc.) must not interrupt the flow
    log('WARN', `Could not send warning DM to ${userId} — DMs may be disabled.`);
  }
}

// ─── unmuteUser ───────────────────────────────────────────────────────────────

/**
 * Remove the Discord native timeout from the user, clear them from the muted
 * set, and reset their mention count.
 *
 * @param {import('discord.js').Guild} guild
 * @param {string} userId
 */
async function unmuteUser(guild, userId) {
  try {
    const member = await guild.members.fetch(userId);

    // Remove the native Discord timeout (passing null clears it immediately)
    await member.timeout(null, 'Anti-spam unmute');

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

    // NOTE: No owner exemption — the bot owner is subject to the same anti-spam
    // rules as every other user.  If the owner mentions Sam 6+ times they will
    // be muted just like anyone else.  The OWNER_ID constant is intentionally
    // not referenced here.

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
    // the harshest mute immediately (level 6, 1440 minutes / 1 day) with a
    // public channel warning, then return — the cumulative path below is not
    // needed because the maximum penalty has already been applied.
    if (mentionCount > 5) {
      const maxLevel = 6;
      const maxDuration = MUTE_DURATIONS[maxLevel]; // 1440 minutes

      log('INFO', `User ${authorId} mentioned protected user ${mentionCount} times in one message — applying immediate max mute.`);
      log('INFO', `checkMentions: calling muteUser() for ${authorId} — immediate max mute (level ${maxLevel + 1}/7, ${maxDuration}m).`);

      const success = await muteUser(message.guild, authorId, maxDuration, maxLevel, client);

      log('INFO', `checkMentions: muteUser() for ${authorId} (immediate max) returned: ${success}.`);

      // Always send the channel warning, regardless of whether the timeout succeeded
      try {
        const channelMsg = success
          ? `⛔ **${message.author.username}** has been banned for 1 day for including an excessive number of mentions of <@${PROTECTED_USER_ID}> in a single message. (Warning 7/7)`
          : `⛔ **${message.author.username}** triggered an automatic ban for including an excessive number of mentions of <@${PROTECTED_USER_ID}> in a single message, but the mute could not be applied — the bot is missing the **Moderate Members** permission. (Warning 7/7)`;
        await message.channel.send(channelMsg);
      } catch (err) {
        log('WARN', `checkMentions: could not send warning message in channel ${message.channel.id}: ${err?.message ?? err}`);
      }

      // Always send the DM warning, noting whether the timeout was actually applied
      await sendWarningDM(client, authorId, maxLevel, maxDuration, success);

      // Return immediately — the maximum penalty has been applied; there is no
      // need to also run the cumulative escalating logic for this message.
      return;
    }

    // ── Normal escalating mute logic ──────────────────────────────────────────
    // Only mute once the author's cumulative mention count reaches 6 or more.
    // Below that threshold we track the count silently and wait.
    if (newCount < 6) {
      log('INFO', `checkMentions: ${authorId} has ${newCount} cumulative mention(s) — below threshold, no mute yet.`);
      return;
    }

    // Determine mute duration and warning level based on cumulative count (0-indexed).
    // 6 mentions → level 0 (Warning 1/7), 7 → level 1 (Warning 2/7), …, 12+ → level 6 (Warning 7/7)
    const warningLevel = Math.min(newCount - 6, 6); // 6th mention → level 0, cap at 6
    const durationMinutes = warningLevel >= MUTE_DURATIONS.length
      ? MUTE_DURATIONS[MUTE_DURATIONS.length - 1]  // cap at 1440 min
      : MUTE_DURATIONS[warningLevel];

    const warningDisplay = Math.min(newCount - 5, 7); // display: 6 mentions → 1/7, cap at 7

    // Format duration for the public channel message
    const durationText = durationMinutes >= 60
      ? `${durationMinutes / 60} hour${durationMinutes / 60 !== 1 ? 's' : ''}`
      : `${durationMinutes} minute${durationMinutes !== 1 ? 's' : ''}`;

    log('INFO', `checkMentions: ${authorId} has ${newCount} cumulative mention(s) — calling muteUser() (level ${warningLevel + 1}/7, ${durationMinutes}m).`);
    log('INFO', `checkMentions: muteExecutor registered = ${muteExecutor !== null}.`);

    // Apply the mute
    const success = await muteUser(message.guild, authorId, durationMinutes, warningLevel, client);

    log('INFO', `checkMentions: muteUser() for ${authorId} (cumulative) returned: ${success}.`);

    // Always send the channel warning, regardless of whether the timeout succeeded
    try {
      const channelMsg = success
        ? `⚠️ **${message.author.username}** has been muted for ${durationText} for spamming mentions of <@${PROTECTED_USER_ID}>. (Warning ${warningDisplay}/7)`
        : `⚠️ **${message.author.username}** triggered an automatic mute for spamming mentions of <@${PROTECTED_USER_ID}>, but the mute could not be applied — the bot is missing the **Moderate Members** permission. (Warning ${warningDisplay}/7)`;
      await message.channel.send(channelMsg);
    } catch (err) {
      log('WARN', `checkMentions: could not send warning message in channel ${message.channel.id}: ${err?.message ?? err}`);
    }

    // Always send the DM warning, noting whether the timeout was actually applied
    await sendWarningDM(client, authorId, warningLevel, durationMinutes, success);
  } catch (err) {
    log('ERROR', `checkMentions: ${err?.message ?? err}`);
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = { checkMentions, muteUser, unmuteUser, setMuteExecutor };
