const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// ─── Owner ────────────────────────────────────────────────────────────────────
// The bot owner's Discord user ID — cooldowns are bypassed for this user.
const OWNER_ID = '123456789012345678'; // ← replace with your Discord user ID

// ─── Constants ────────────────────────────────────────────────────────────────
const INVITE_COOLDOWN_MS  = 10.5 * 60 * 60 * 1000; // 10.5 hours
const DELETE_COOLDOWN_MS  = 7   * 24 * 60 * 60 * 1000; // 1 week
const XP_PER_MESSAGE      = 2;                       // XP gained per message
const XP_PER_LEVEL        = 100;                      // XP required to level up
const GEMS_PER_LEVEL      = 1;                        // Gems awarded per level (always 1)

// ─── Clan role colour palette ─────────────────────────────────────────────────
// Silver and a full rainbow spectrum so every clan role looks distinctive.
const CLAN_ROLE_COLORS = [
  0xC0C0C0, // Silver
  0xFFD700, // Gold
  0xFF0000, // Red
  0xFFA500, // Orange
  0xFFFF00, // Yellow
  0x00FF00, // Green
  0x00FFFF, // Cyan
  0x0000FF, // Blue
  0x800080, // Purple
  0xFF1493, // Pink
];

function getRandomClanColor() {
  return CLAN_ROLE_COLORS[Math.floor(Math.random() * CLAN_ROLE_COLORS.length)];
}

// ─── Consistent error logger ──────────────────────────────────────────────────
function logError(context, err) {
  console.error(`[ERROR] clan/${context}: ${err?.message ?? err}`);
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

// ─── Format milliseconds into a human-readable string ────────────────────────
function formatMs(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const days    = Math.floor(totalSeconds / 86400);
  const hours   = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];
  if (days)    parts.push(`${days}d`);
  if (hours)   parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds) parts.push(`${seconds}s`);
  return parts.length ? parts.join(' ') : '0s';
}

// ─── Database initialisation ──────────────────────────────────────────────────
// Called once from bot.js after the shared `db` instance is created.
function initClanTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clans (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      owner_id   TEXT    NOT NULL,
      guild_id   TEXT    NOT NULL,
      role_id    TEXT    NOT NULL,
      xp         INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clan_members (
      clan_id   INTEGER NOT NULL,
      user_id   TEXT    NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (clan_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS clan_cooldowns (
      user_id       TEXT NOT NULL,
      cooldown_type TEXT NOT NULL,
      expires_at    INTEGER NOT NULL,
      PRIMARY KEY (user_id, cooldown_type)
    );

    CREATE TABLE IF NOT EXISTS user_xp (
      user_id      TEXT    NOT NULL PRIMARY KEY,
      lifetime_xp  INTEGER NOT NULL DEFAULT 0,
      current_xp   INTEGER NOT NULL DEFAULT 0,
      level        INTEGER NOT NULL DEFAULT 0,
      gems         INTEGER NOT NULL DEFAULT 0
    );
  `);
}

// ─── Clan DB helpers ──────────────────────────────────────────────────────────

function getClanByOwner(db, ownerId, guildId) {
  return db.prepare('SELECT * FROM clans WHERE owner_id = ? AND guild_id = ?').get(ownerId, guildId);
}

function getClanByMember(db, userId, guildId) {
  return db.prepare(`
    SELECT c.* FROM clans c
    JOIN clan_members cm ON cm.clan_id = c.id
    WHERE cm.user_id = ? AND c.guild_id = ?
  `).get(userId, guildId);
}

function getClanById(db, clanId) {
  return db.prepare('SELECT * FROM clans WHERE id = ?').get(clanId);
}

function getClanMembers(db, clanId) {
  return db.prepare(`
    SELECT user_id, joined_at FROM clan_members WHERE clan_id = ? ORDER BY joined_at ASC
  `).all(clanId);
}

function getCooldown(db, userId, type) {
  const row = db.prepare(
    'SELECT expires_at FROM clan_cooldowns WHERE user_id = ? AND cooldown_type = ?'
  ).get(userId, type);
  if (!row) return 0;
  const remaining = row.expires_at - Date.now();
  return remaining > 0 ? remaining : 0;
}

function setCooldown(db, userId, type, durationMs) {
  db.prepare(`
    INSERT INTO clan_cooldowns (user_id, cooldown_type, expires_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, cooldown_type) DO UPDATE SET expires_at = excluded.expires_at
  `).run(userId, type, Date.now() + durationMs);
}

function clearCooldown(db, userId, type) {
  db.prepare('DELETE FROM clan_cooldowns WHERE user_id = ? AND cooldown_type = ?').run(userId, type);
}

// ─── User XP helpers ──────────────────────────────────────────────────────────

function getUserXpData(db, userId) {
  let row = db.prepare(`
    SELECT * FROM user_xp WHERE user_id = ?
  `).get(userId);
  
  if (!row) {
    db.prepare(`
      INSERT INTO user_xp (user_id, lifetime_xp, current_xp, level, gems)
      VALUES (?, 0, 0, 0, 0)
    `).run(userId);
    row = db.prepare(`SELECT * FROM user_xp WHERE user_id = ?`).get(userId);
  }
  
  return row;
}

function awardXp(db, userId, amount) {
  const user = getUserXpData(db, userId);
  const newCurrentXp = user.current_xp + amount;
  const newLifetimeXp = user.lifetime_xp + amount;
  
  let newLevel = user.level;
  let leveledUp = false;
  
  // Check if user leveled up (only award 1 gem per level, not per multiple levelups)
  if (newCurrentXp >= XP_PER_LEVEL) {
    const levelsGained = Math.floor(newCurrentXp / XP_PER_LEVEL);
    newLevel = user.level + levelsGained;
    leveledUp = levelsGained > 0;
  }
  
  const finalCurrentXp = newCurrentXp % XP_PER_LEVEL;
  
  // Award exactly 1 gem if they leveled up
  const newGems = leveledUp ? user.gems + GEMS_PER_LEVEL : user.gems;
  
  db.prepare(`
    UPDATE user_xp 
    SET lifetime_xp = ?, current_xp = ?, level = ?, gems = ?
    WHERE user_id = ?
  `).run(newLifetimeXp, finalCurrentXp, newLevel, newGems, userId);
  
  return {
    xpGained: amount,
    lifetimeXp: newLifetimeXp,
    currentXp: finalCurrentXp,
    level: newLevel,
    gems: newGems,
    leveledUp,
    previousLevel: user.level,
  };
}

// ─── Slash command definitions ────────────────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName('clan')
    .setDescription('Clan system commands')
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a new clan')
        .addStringOption(o =>
          o.setName('name')
            .setDescription('Clan name (max 50 characters)')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Delete your clan (sets a 1-week cooldown before you can create again)')
    )
    .addSubcommand(sub =>
      sub.setName('invite')
        .setDescription('Invite a user to your clan')
        .addUserOption(o =>
          o.setName('user')
            .setDescription('The user to invite')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('Show information about your clan')
    ),
  new SlashCommandBuilder()
    .setName('level')
    .setDescription('Check your XP and level information'),
];

// ─── Command handler ──────────────────────────────────────────────────────────
async function handleClan(interaction, db, client) {
  const sub     = interaction.options.getSubcommand();
  const { user, guild } = interaction;

  if (!guild) {
    return await safeReply(interaction, {
      content: '❌ Clan commands can only be used inside a server.',
      ephemeral: true,
    });
  }

  try {

    // ── /clan create ───────────────────────────────────────────────────────────
    if (sub === 'create') {
      // Check if user is already in a clan
      const existing = getClanByMember(db, user.id, guild.id);
      if (existing) {
        return await safeReply(interaction, {
          content: `❌ You are already in a clan (**${existing.name}**). Leave or delete it first.`,
          ephemeral: true,
        });
      }

      // Check delete cooldown (owner is exempt)
      if (user.id !== OWNER_ID) {
        const deleteCooldown = getCooldown(db, user.id, 'delete');
        if (deleteCooldown > 0) {
          return await safeReply(interaction, {
            content: `⏳ You recently deleted a clan. You can create a new one in **${formatMs(deleteCooldown)}**.`,
            ephemeral: true,
          });
        }
      }

      const rawName = interaction.options.getString('name') ?? '';
      const name    = rawName.trim().slice(0, 50);
      if (!name) {
        return await safeReply(interaction, {
          content: '❌ Clan name cannot be empty.',
          ephemeral: true,
        });
      }

      // Defer so we have time to create the Discord role
      await interaction.deferReply();

      // Create the Discord role
      let role;
      try {
        role = await guild.roles.create({
          name,
          color: getRandomClanColor(),
          reason: `Clan created by ${user.username}`,
        });
      } catch (err) {
        logError('create: guild.roles.create', err);
        return await safeReply(interaction, {
          content: '❌ Failed to create the clan role. Make sure the bot has the **Manage Roles** permission.',
          ephemeral: true,
        });
      }

      // Persist clan and add owner as first member in a transaction
      try {
        const insertClan = db.transaction(() => {
          const result = db.prepare(`
            INSERT INTO clans (name, owner_id, guild_id, role_id, xp)
            VALUES (?, ?, ?, ?, 0)
          `).run(name, user.id, guild.id, role.id);

          const clanId = result.lastInsertRowid;

          db.prepare(`
            INSERT INTO clan_members (clan_id, user_id) VALUES (?, ?)
          `).run(clanId, user.id);

          return clanId;
        });

        insertClan();
      } catch (err) {
        logError('create: DB insert', err);
        // Roll back the role if DB fails
        try { await role.delete('Clan DB insert failed'); } catch {}
        return await safeReply(interaction, {
          content: '❌ Failed to save clan to the database. The role has been removed.',
          ephemeral: true,
        });
      }

      // Assign the role to the creator
      try {
        const member = await guild.members.fetch(user.id);
        await member.roles.add(role);
      } catch (err) {
        logError('create: assign role to creator', err);
        // Non-fatal — clan still exists, just warn
      }

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🏰 Clan Created!')
        .addFields(
          { name: 'Clan Name', value: name,                inline: true },
          { name: 'Owner',     value: `<@${user.id}>`,     inline: true },
          { name: 'Role',      value: `<@&${role.id}>`,    inline: true },
        )
        .setFooter({ text: 'Use /clan invite <user> to grow your clan!' })
        .setTimestamp();

      return await safeReply(interaction, { embeds: [embed] });
    }

    // ── /clan delete ──────────────────────────────────────────────────────────
    if (sub === 'delete') {
      const clan = getClanByOwner(db, user.id, guild.id);
      if (!clan) {
        return await safeReply(interaction, {
          content: '❌ You do not own a clan in this server.',
          ephemeral: true,
        });
      }

      await interaction.deferReply();

      // Delete the Discord role
      try {
        const role = await guild.roles.fetch(clan.role_id);
        if (role) await role.delete(`Clan deleted by ${user.username}`);
      } catch (err) {
        logError('delete: role.delete', err);
        // Non-fatal — continue with DB cleanup
      }

      // Remove clan and all members from DB, then set cooldown
      try {
        db.transaction(() => {
          db.prepare('DELETE FROM clan_members WHERE clan_id = ?').run(clan.id);
          db.prepare('DELETE FROM clans WHERE id = ?').run(clan.id);
        })();
      } catch (err) {
        logError('delete: DB cleanup', err);
        return await safeReply(interaction, {
          content: '❌ Failed to delete clan from the database.',
          ephemeral: true,
        });
      }

      // Apply delete cooldown (owner is exempt)
      if (user.id !== OWNER_ID) {
        setCooldown(db, user.id, 'delete', DELETE_COOLDOWN_MS);
      }

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🗑️ Clan Deleted')
        .setDescription(`**${clan.name}** has been disbanded. You can create a new clan in **${user.id === OWNER_ID ? 'no time at all' : '1 week'}**.`)
        .setTimestamp();

      return await safeReply(interaction, { embeds: [embed] });
    }

    // ── /clan invite ──────────────────────────────────────────────────────────
    if (sub === 'invite') {
      const clan = getClanByOwner(db, user.id, guild.id);
      if (!clan) {
        return await safeReply(interaction, {
          content: '❌ You do not own a clan in this server. Only the clan owner can invite members.',
          ephemeral: true,
        });
      }

      const target = interaction.options.getUser('user');
      if (!target) {
        return await safeReply(interaction, {
          content: '❌ Could not resolve the target user.',
          ephemeral: true,
        });
      }

      if (target.id === user.id) {
        return await safeReply(interaction, {
          content: '❌ You cannot invite yourself.',
          ephemeral: true,
        });
      }

      if (target.bot) {
        return await safeReply(interaction, {
          content: '❌ You cannot invite bots to a clan.',
          ephemeral: true,
        });
      }

      // Check if target is already in a clan
      const targetClan = getClanByMember(db, target.id, guild.id);
      if (targetClan) {
        return await safeReply(interaction, {
          content: `❌ **${target.username}** is already in a clan (**${targetClan.name}**).`,
          ephemeral: true,
        });
      }

      // Check invite cooldown (owner is exempt)
      if (user.id !== OWNER_ID) {
        const inviteCooldown = getCooldown(db, user.id, 'invite');
        if (inviteCooldown > 0) {
          return await safeReply(interaction, {
            content: `⏳ You invited someone recently. You can invite again in **${formatMs(inviteCooldown)}**.`,
            ephemeral: true,
          });
        }
      }

      await interaction.deferReply();

      // Add to clan_members
      try {
        db.prepare(`
          INSERT INTO clan_members (clan_id, user_id) VALUES (?, ?)
        `).run(clan.id, target.id);
      } catch (err) {
        logError('invite: DB insert', err);
        return await safeReply(interaction, {
          content: '❌ Failed to add member to the database.',
          ephemeral: true,
        });
      }

      // Assign clan role to the new member
      try {
        const member = await guild.members.fetch(target.id);
        const role   = await guild.roles.fetch(clan.role_id);
        if (role) await member.roles.add(role);
      } catch (err) {
        logError('invite: assign role to new member', err);
        // Non-fatal
      }

      // Apply invite cooldown (owner is exempt)
      if (user.id !== OWNER_ID) {
        setCooldown(db, user.id, 'invite', INVITE_COOLDOWN_MS);
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📨 Member Invited!')
        .addFields(
          { name: 'Clan',       value: clan.name,           inline: true },
          { name: 'New Member', value: `<@${target.id}>`,   inline: true },
          { name: 'Invited by', value: `<@${user.id}>`,     inline: true },
        )
        .setFooter({ text: 'Use /clan invite to add more members!' })
        .setTimestamp();

      return await safeReply(interaction, { embeds: [embed] });
    }

    // ── /clan info ────────────────────────────────────────────────────────────
    if (sub === 'info') {
      const clan = getClanByMember(db, user.id, guild.id);
      if (!clan) {
        return await safeReply(interaction, {
          content: '❌ You are not in a clan. Ask a clan owner to invite you, or create one with `/clan create`.',
          ephemeral: true,
        });
      }

      const members = getClanMembers(db, clan.id);

      // Resolve usernames for each member
      const memberLines = await Promise.all(
        members.map(async (m, i) => {
          let username = 'Unknown User';
          try {
            const fetched = await client.users.fetch(m.user_id);
            username = fetched.username;
          } catch {}
          const isOwner = m.user_id === clan.owner_id;
          const joinDate = new Date(m.joined_at).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
          });
          return `${isOwner ? '👑' : `**${i + 1}.**`} <@${m.user_id}> (${username}) — joined ${joinDate}`;
        })
      );

      const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle(`🏰 ${clan.name}`)
        .addFields(
          { name: '👑 Owner',        value: `<@${clan.owner_id}>`,          inline: true },
          { name: '✨ Total XP',     value: `${clan.xp.toLocaleString()}`,   inline: true },
          { name: '👥 Members',      value: `${members.length}`,             inline: true },
          { name: '📋 Member List',  value: memberLines.join('\n') || 'None' },
        )
        .setFooter({ text: `Clan created ${new Date(clan.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}` })
        .setTimestamp();

      return await safeReply(interaction, { embeds: [embed] });
    }

  } catch (err) {
    logError(`handleClan [${sub}]`, err);
    await safeReply(interaction, {
      content: '❌ An unexpected error occurred. Please try again.',
      ephemeral: true,
    });
  }
}

// ─── Level command handler ────────────────────────────────────────────────────
async function handleLevel(interaction, db) {
  const { user } = interaction;

  try {
    const xpData = getUserXpData(db, user.id);
    const xpToNextLevel = XP_PER_LEVEL - xpData.current_xp;

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`📊 ${user.username}'s Level Info`)
      .addFields(
        { name: '⭐ Level', value: `${xpData.level}`, inline: true },
        { name: '💎 Gems', value: `${xpData.gems}`, inline: true },
        { name: '✨ Lifetime XP', value: `${xpData.lifetime_xp.toLocaleString()}`, inline: true },
        { name: '📈 Current XP Progress', value: `${xpData.current_xp}/${XP_PER_LEVEL}`, inline: true },
        { name: '🎯 XP to Next Level', value: `${xpToNextLevel}`, inline: true },
      )
      .setFooter({ text: `Gain 2 XP per message!` })
      .setTimestamp();

    return await safeReply(interaction, { embeds: [embed] });
  } catch (err) {
    logError('handleLevel', err);
    await safeReply(interaction, {
      content: '❌ An unexpected error occurred. Please try again.',
      ephemeral: true,
    });
  }
}

// ─── XP message handler ───────────────────────────────────────────────────────
// Call this from the bot's `messageCreate` event.
// This applies to ALL users, not just clan members
async function handleXp(message, db, client) {
  // Ignore bots and DMs
  if (message.author.bot || !message.guild) return;

  const userId = message.author.id;

  try {
    const result = awardXp(db, userId, XP_PER_MESSAGE);

    // If user leveled up, send a level-up message
    if (result.leveledUp) {
      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🎉 Level Up!')
        .addFields(
          { name: '⭐ New Level', value: `${result.level}`, inline: true },
          { name: '💎 New Balance', value: `${result.gems} gem${result.gems === 1 ? '' : 's'}`, inline: true },
          { name: '✨ Lifetime XP', value: `${result.lifetimeXp.toLocaleString()}`, inline: true },
          { name: '📈 Current XP', value: `${result.currentXp}/${XP_PER_LEVEL}`, inline: false },
        )
        .setThumbnail(message.author.displayAvatarURL())
        .setFooter({ text: `Keep chatting to level up more!` })
        .setTimestamp();

      try {
        await message.reply({ embeds: [embed] });
      } catch (err) {
        logError(`handleXp: failed to send level-up message`, err);
      }
    }
  } catch (err) {
    logError(`handleXp [user=${userId}]`, err);
  }
}

module.exports = { commands, handleClan, handleLevel, handleXp, initClanTables };

