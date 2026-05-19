const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { commands: gameCommands, handleGame, checkCooldowns } = require('./game.js');
const { commands: clanCommands, handleClan, handleXp, initClanTables } = require('./clan.js');
const { commands: lotteryCommands, handleLottery, initLotteryTable, addToLottery } = require('./lottery.js');
const { commands: giveawayCommands, handleGiveaway, handleGiveawayReaction } = require('./giveaway.js');
const { checkMentions, unmuteUser, setMuteExecutor } = require('./antispam.js');

// ─── Process-level error handlers ────────────────────────────────────────────
// Must be registered before anything else so no rejection or exception slips
// through silently and crashes the process without a trace.
process.on('unhandledRejection', (reason, promise) => {
  log('ERROR', `Unhandled promise rejection: ${reason?.stack ?? reason}`);
});

process.on('uncaughtException', (err) => {
  log('ERROR', `Uncaught exception: ${err?.stack ?? err}`);
  process.exit(1);
});

// ─── Logging ──────────────────────────────────────────────────────────────────
function timestamp() {
  return new Date().toISOString();
}

function log(level, message) {
  const prefix = `[${timestamp()}] [${level}]`;
  if (level === 'ERROR' || level === 'WARN') {
    console.error(`${prefix} ${message}`);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

// ─── Config ───────────────────────────────────────────────────────────────────
const TOKEN = process.env.DISCORD_TOKEN;       // Your bot token
const CLIENT_ID = process.env.CLIENT_ID;       // Your bot's application/client ID
const OWNER_ID = process.env.OWNER_ID;         // Your personal Discord user ID

// Validate TOKEN: must be a non-empty string of at least 50 characters.
// Real Discord bot tokens are 70+ characters; this catches placeholder values.
if (!TOKEN || typeof TOKEN !== 'string' || TOKEN.trim().length < 50) {
  log('ERROR', 'DISCORD_TOKEN is missing or invalid. Ensure it is set to your full bot token (found in the Discord Developer Portal).');
  process.exit(1);
}

// Validate CLIENT_ID: Discord snowflakes are numeric strings of 17–20 digits.
if (!CLIENT_ID || !/^\d{17,20}$/.test(CLIENT_ID.trim())) {
  log('ERROR', 'CLIENT_ID is missing or invalid. It must be a numeric Discord snowflake (17–20 digits), found on your application page in the Discord Developer Portal.');
  process.exit(1);
}

// ─── Consistent error logger ──────────────────────────────────────────────────
function logError(context, err) {
  log('ERROR', `${context}: ${err?.message ?? err}`);
}

// ─── Safe interaction reply ───────────────────────────────────────────────────
// Handles the case where the interaction was already replied to or has expired.
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

// ─── Moderation Helpers ───────────────────────────────────────────────────────

/**
 * Parse a human-readable duration string into milliseconds.
 * Supported units: w (weeks), d (days), h (hours), m (minutes).
 * Returns null if the string is not a valid duration.
 *
 * Examples: "1w" → 604800000, "7d" → 604800000, "2h" → 7200000, "30m" → 1800000
 */
function parseTime(str) {
  if (!str || typeof str !== 'string') return null;
  const match = str.trim().match(/^(\d+)(w|d|h|m)$/i);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  if (value <= 0) return null;
  const unit = match[2].toLowerCase();
  const multipliers = { w: 7 * 24 * 60 * 60 * 1000, d: 24 * 60 * 60 * 1000, h: 60 * 60 * 1000, m: 60 * 1000 };
  return value * multipliers[unit];
}

/**
 * Format a millisecond duration into a readable string like "7 days", "2 hours", "30 minutes".
 */
function formatDuration(ms) {
  const units = [
    { label: 'week',   ms: 7 * 24 * 60 * 60 * 1000 },
    { label: 'day',    ms: 24 * 60 * 60 * 1000 },
    { label: 'hour',   ms: 60 * 60 * 1000 },
    { label: 'minute', ms: 60 * 1000 },
  ];
  for (const unit of units) {
    if (ms >= unit.ms) {
      const count = Math.floor(ms / unit.ms);
      return `${count} ${unit.label}${count !== 1 ? 's' : ''}`;
    }
  }
  return 'less than a minute';
}

// Scheduled unbans: key = `${guildId}:${userId}`, value = { guildId, userId, unbanAt }
const scheduledUnbans = new Map();

// Scheduled unmutes: key = `${guildId}:${userId}`, value = { guildId, userId, unmuteAt }
const scheduledUnmutes = new Map();

/**
 * Process any pending unbans and unmutes whose time has elapsed.
 * Called every minute from the main setInterval loop.
 */
async function processModerationSchedule(clientRef) {
  const now = Date.now();

  // ── Unbans ──────────────────────────────────────────────────────────────────
  for (const [key, entry] of scheduledUnbans) {
    if (now < entry.unbanAt) continue;
    scheduledUnbans.delete(key);
    try {
      const guild = await clientRef.guilds.fetch(entry.guildId);
      await guild.members.unban(entry.userId, 'Temporary ban duration expired');
      log('INFO', `Auto-unbanned user ${entry.userId} in guild ${entry.guildId}.`);
    } catch (err) {
      logError(`processModerationSchedule: unban [${key}]`, err);
    }
  }

  // ── Unmutes ─────────────────────────────────────────────────────────────────
  for (const [key, entry] of scheduledUnmutes) {
    if (now < entry.unmuteAt) continue;
    scheduledUnmutes.delete(key);
    try {
      const guild  = await clientRef.guilds.fetch(entry.guildId);
      const member = await guild.members.fetch(entry.userId);
      // Remove the native Discord timeout from this user.
      await member.timeout(null, 'Temporary mute duration expired');
      log('INFO', `Auto-unmuted user ${entry.userId} in guild ${entry.guildId}.`);
    } catch (err) {
      logError(`processModerationSchedule: unmute [${key}]`, err);
    }
  }
}

// ─── Database Setup ───────────────────────────────────────────────────────────
const DB_PATH = '/data/shop.db';
const DB_DIR  = path.dirname(DB_PATH);

// Ensure the data directory exists before opening the database. Without this
// the process crashes immediately when the volume hasn't been initialised yet.
try {
  fs.mkdirSync(DB_DIR, { recursive: true });
  log('INFO', `Database directory ensured: ${DB_DIR}`);
} catch (err) {
  log('ERROR', `Failed to create database directory ${DB_DIR}: ${err?.stack ?? err}`);
  process.exit(1);
}

let db;
try {
  db = new Database(DB_PATH);
  log('INFO', `Database opened: ${DB_PATH}`);
} catch (err) {
  log('ERROR', `Failed to open database at ${DB_PATH}: ${err?.stack ?? err}`);
  process.exit(1);
}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS shop_items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL UNIQUE,
      description  TEXT    NOT NULL,
      price        INTEGER NOT NULL,
      stock        INTEGER NOT NULL DEFAULT -1,  -- -1 = unlimited
      created_by   TEXT    NOT NULL,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_protected INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS user_balances (
      user_id TEXT PRIMARY KEY,
      balance INTEGER NOT NULL DEFAULT 0         -- Starting balance
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT    NOT NULL,
      item_id    INTEGER NOT NULL,
      quantity   INTEGER NOT NULL DEFAULT 1,
      total_cost INTEGER NOT NULL,
      bought_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inventories (
      user_id TEXT    NOT NULL,
      item_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS warnings (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      TEXT    NOT NULL,
      guild_id     TEXT    NOT NULL,
      moderator_id TEXT    NOT NULL,
      reason       TEXT    NOT NULL,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  log('INFO', 'Database schema initialised successfully.');
} catch (err) {
  log('ERROR', `Failed to initialise database schema: ${err?.stack ?? err}`);
  process.exit(1);
}

// ─── Clan Tables ──────────────────────────────────────────────────────────────
try {
  initClanTables(db);
  log('INFO', 'Clan tables initialised successfully.');
} catch (err) {
  log('ERROR', `Failed to initialise clan tables: ${err?.stack ?? err}`);
  process.exit(1);
}

// ─── Lottery Table ────────────────────────────────────────────────────────────
try {
  initLotteryTable(db);
  log('INFO', 'Lottery table initialised successfully.');
} catch (err) {
  log('ERROR', `Failed to initialise lottery table: ${err?.stack ?? err}`);
  process.exit(1);
}

// ─── Database Helpers ─────────────────────────────────────────────────────────
function getBalance(userId) {
  try {
    const row = db.prepare('SELECT balance FROM user_balances WHERE user_id = ?').get(userId);
    if (!row) {
      db.prepare('INSERT INTO user_balances (user_id, balance) VALUES (?, 0)').run(userId);
      return 0;
    }
    return row.balance;
  } catch (err) {
    logError(`getBalance(${userId})`, err);
    return 0;
  }
}

function updateBalance(userId, delta) {
  try {
    db.prepare(`
      INSERT INTO user_balances (user_id, balance) VALUES (?, 0 + ?)
      ON CONFLICT(user_id) DO UPDATE SET balance = balance + ?
    `).run(userId, delta, delta);
  } catch (err) {
    logError(`updateBalance(${userId}, ${delta})`, err);
  }
}

function getItem(nameOrId) {
  try {
    if (typeof nameOrId === 'number') {
      return db.prepare('SELECT * FROM shop_items WHERE id = ?').get(nameOrId);
    }
    return db.prepare('SELECT * FROM shop_items WHERE LOWER(name) = LOWER(?)').get(nameOrId);
  } catch (err) {
    logError(`getItem(${nameOrId})`, err);
    return null;
  }
}

function getAllItems() {
  try {
    return db.prepare('SELECT * FROM shop_items ORDER BY price ASC').all();
  } catch (err) {
    logError('getAllItems', err);
    return [];
  }
}

function getUserInventory(userId) {
  try {
    return db.prepare(`
      SELECT s.name, s.description, i.quantity
      FROM inventories i
      JOIN shop_items s ON s.id = i.item_id
      WHERE i.user_id = ?
      ORDER BY s.name
    `).all(userId);
  } catch (err) {
    logError(`getUserInventory(${userId})`, err);
    return [];
  }
}

// ─── Leaderboard Helpers ──────────────────────────────────────────────────────

// Tracks active leaderboard messages for background auto-refresh.
// Key: messageId  Value: { channelId, limit, lastUpdate }
const activeLeaderboards = new Map();

const LEADERBOARD_REFRESH_MS = 30 * 1000; // 30 seconds

async function buildLeaderboardEmbed(limit, clientRef) {
  let rows;
  try {
    rows = db.prepare(
      'SELECT user_id, balance FROM user_balances ORDER BY balance DESC LIMIT ?'
    ).all(limit);
  } catch (err) {
    logError('buildLeaderboardEmbed DB query', err);
    return null;
  }

  if (!rows.length) {
    return new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🏆 Coin Leaderboard')
      .setDescription('No users have any coins yet. Be the first!')
      .setTimestamp();
  }

  const medals = ['🥇', '🥈', '🥉'];

  const entries = await Promise.all(
    rows.map(async (row, index) => {
      let username = 'Unknown User';
      try {
        const fetched = await clientRef.users.fetch(row.user_id);
        username = fetched.username;
      } catch {
        // User may have left Discord or deleted their account
      }
      const medal = medals[index] ?? `**${index + 1}.**`;
      const rank  = index < 3 ? `${medal}` : `**#${index + 1}**`;
      return `${rank} ${username} — 🪙 ${row.balance.toLocaleString()} coins`;
    })
  );

  return new EmbedBuilder()
    .setColor(0xFEE75C)
    .setTitle('🏆 Coin Leaderboard')
    .setDescription(entries.join('\n'))
    .setFooter({ text: `Top ${rows.length} coin holder${rows.length === 1 ? '' : 's'} • Last updated` })
    .setTimestamp();
}

// ─── Background leaderboard refresh task ─────────────────────────────────────
async function refreshTrackedLeaderboards(clientRef) {
  const now = Date.now();
  for (const [messageId, meta] of activeLeaderboards) {
    try {
      const channel = await clientRef.channels.fetch(meta.channelId);
      const message = await channel.messages.fetch(messageId);
      const embed   = await buildLeaderboardEmbed(meta.limit, clientRef);
      if (!embed) continue;
      await message.edit({ embeds: [embed] });
      meta.lastUpdate = now;
    } catch (err) {
      logError(`refreshTrackedLeaderboards [msg=${messageId}]`, err);
      // Remove the entry so we stop trying to update a deleted/inaccessible message
      activeLeaderboards.delete(messageId);
    }
  }
}

// ─── Guild Resolver ───────────────────────────────────────────────────────────
/**
 * Resolve a server name or ID string to a Guild object from the client cache.
 * Matches by ID first, then by name (case-insensitive).
 * Returns the Guild on success, or null if not found.
 */
function resolveGuild(clientRef, serverArg) {
  if (!serverArg) return null;
  return (
    clientRef.guilds.cache.get(serverArg) ??
    clientRef.guilds.cache.find(g => g.name.toLowerCase() === serverArg.toLowerCase()) ??
    null
  );
}

// ─── Slash Commands Definition ────────────────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName('additem')
    .setDescription('Add a new item to the shop (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(true)
    .addStringOption(o => o.setName('name').setDescription('Item name').setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('Item description').setRequired(true))
    .addIntegerOption(o => o.setName('price').setDescription('Price in coins').setRequired(true).setMinValue(1))
    .addIntegerOption(o => o.setName('stock').setDescription('Stock quantity (-1 for unlimited)').setMinValue(-1))
    .addStringOption(o =>
      o.setName('server')
        .setDescription('Server name or ID to add the item to (DM use only)')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('removeitem')
    .setDescription('Remove an item from the shop (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('name').setDescription('Item name to remove').setRequired(true).setAutocomplete(true)),

  new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Browse the shop'),

  new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Purchase an item from the shop')
    .setDMPermission(true)
    .addStringOption(o => o.setName('item').setDescription('Name of the item to buy').setRequired(true).setAutocomplete(true))
    .addIntegerOption(o => o.setName('quantity').setDescription('How many to buy (default: 1)').setMinValue(1))
    .addStringOption(o =>
      o.setName('server')
        .setDescription('Server name or ID to buy in (DM use only)')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your coin balance'),

  new SlashCommandBuilder()
    .setName('givecoin')
    .setDescription('Give coins to a user (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(true)
    .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Amount of coins').setRequired(true))
    .addStringOption(o =>
      o.setName('server')
        .setDescription('Server name or ID (DM use only; used to log which server the coins were given in)')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the top coin holders')
    .addIntegerOption(o =>
      o.setName('limit')
        .setDescription('Number of users to show (default: 10, max: 25)')
        .setMinValue(1)
        .setMaxValue(25)
    ),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(o =>
      o.setName('user').setDescription('The user to ban').setRequired(true)
    )
    .addStringOption(o =>
      o.setName('time').setDescription('Duration of the ban, e.g. 7d, 2h, 30m, 1w (omit for permanent)')
    )
    .addStringOption(o =>
      o.setName('reason').setDescription('Reason for the ban')
    ),

  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute a user in all text channels')
    .addUserOption(o =>
      o.setName('user').setDescription('The user to mute').setRequired(true)
    )
    .addStringOption(o =>
      o.setName('duration').setDescription('How long to mute, e.g. 10m, 1h, 1d').setRequired(true)
    )
    .addStringOption(o =>
      o.setName('reason').setDescription('Reason for the mute')
    ),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(o =>
      o.setName('user').setDescription('The user to kick').setRequired(true)
    )
    .addStringOption(o =>
      o.setName('reason').setDescription('Reason for the kick')
    ),

  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue a warning to a user (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(o =>
      o.setName('user').setDescription('The user to warn').setRequired(true)
    )
    .addStringOption(o =>
      o.setName('reason').setDescription('Reason for the warning')
    ),

  new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Unmute a user')
    .addUserOption(o =>
      o.setName('user').setDescription('The user to unmute').setRequired(true)
    )
    .addStringOption(o =>
      o.setName('reason').setDescription('Reason for unmuting (optional)')
    ),

  new SlashCommandBuilder()
    .setName('shutdown')
    .setDescription('Shut down the bot (owner only)')
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName('restart')
    .setDescription('Restart the bot (owner only)')
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Send an announcement to one or all servers (owner only)')
    .setDMPermission(true)
    .addStringOption(o =>
      o.setName('message')
        .setDescription('The announcement text')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('server')
        .setDescription('Server name or ID to announce in (DM use only; omit to announce to all servers)')
        .setRequired(false)
    )
    .addStringOption(o =>
      o.setName('ping')
        .setDescription('Who to ping with the announcement (default: no ping)')
        .setRequired(false)
        .addChoices(
          { name: 'No ping',  value: 'none'     },
          { name: '@everyone', value: 'everyone' },
        )
    )
    .addUserOption(o =>
      o.setName('pinguser')
        .setDescription('Specific user to ping with the announcement')
        .setRequired(false)
    ),
];

// ─── Register Commands ─────────────────────────────────────────────────────────
const allCommands = [...commands, ...gameCommands, ...clanCommands, ...lotteryCommands, ...giveawayCommands];

async function registerCommands() {
  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    log('INFO', 'Registering slash commands...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: allCommands.map(c => c.toJSON()) });
    log('INFO', 'Slash commands registered successfully.');
  } catch (err) {
    log('ERROR', `Failed to register slash commands: ${err.message}`);
  }
}

// ─── Bot Client ───────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

// ─── Anti-spam mute executor ──────────────────────────────────────────────────
// Called by antispam.js when cumulative mention spam is detected.
// Uses Discord's native timeout feature (the same approach as the /mute command)
// and schedules an automatic unmute via the shared scheduledUnmutes map.
//
// NOTE: No owner exemption — OWNER_ID is deliberately not checked here.
// The bot owner is subject to the same anti-spam rules as every other user
// and can be muted by this executor just like anyone else.
async function executeMute(guild, userId, durationMinutes, warningLevel, clientRef) {
  const durationMs = durationMinutes * 60 * 1000;
  const reason     = 'Spamming mentions of Sam';

  let targetMember;
  try {
    targetMember = await guild.members.fetch(userId);
  } catch {
    log('WARN', `executeMute: could not fetch member ${userId} in guild ${guild.id}`);
    return false;
  }

  try {
    await targetMember.timeout(durationMs, `Anti-spam mute (warning ${warningLevel + 1}/6): ${reason}`);
  } catch (err) {
    log('WARN', `executeMute: could not apply timeout for ${userId} in guild ${guild.id}: ${err?.message ?? err}`);
    return false;
  }

  // Schedule automatic unmute via the shared map (picked up by processModerationSchedule)
  const key = `${guild.id}:${userId}`;
  scheduledUnmutes.set(key, {
    guildId:  guild.id,
    userId,
    unmuteAt: Date.now() + durationMs,
  });
  log('INFO', `Anti-spam: muted ${userId} in guild ${guild.id} for ${durationMinutes}m (warning ${warningLevel + 1}/6).`);

  return true;
}

client.once('ready', async () => {
  log('INFO', `Logged in as ${client.user.tag}`);

  // Register the mute executor so antispam.js can trigger mutes through the
  // same channel-overwrite mechanism used by the /mute command.
  setMuteExecutor(executeMute);
  log('INFO', 'Anti-spam mute executor registered.');

  await registerCommands();

  // Start the background task that keeps tracked leaderboard messages up to date,
  // notifies users when their guess cooldown expires, and processes scheduled
  // moderation actions (temporary bans and mutes).
  setInterval(() => {
    refreshTrackedLeaderboards(client).catch(err =>
      logError('leaderboard background refresh', err)
    );
    checkCooldowns(client).catch(err =>
      logError('cooldown expiry check', err)
    );
    processModerationSchedule(client).catch(err =>
      logError('moderation schedule check', err)
    );
  }, LEADERBOARD_REFRESH_MS);
  log('INFO', `Leaderboard auto-refresh, cooldown checker, and moderation scheduler started (every ${LEADERBOARD_REFRESH_MS / 1000}s).`);

  // ── Notify owner that the bot is online ──────────────────────────────────
  if (OWNER_ID) {
    try {
      const owner = await client.users.fetch(OWNER_ID);
      const readyEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Bot Online')
        .setDescription(`**${client.user.tag}** has connected to Discord and is ready.`)
        .addFields(
          { name: 'Logged in as', value: client.user.tag,          inline: true },
          { name: 'Servers',      value: `${client.guilds.cache.size}`, inline: true },
          { name: 'Timestamp',    value: `<t:${Math.floor(Date.now() / 1000)}:F>` },
        )
        .setTimestamp();
      await owner.send({ content: '🟢 **Bot is now online!**', embeds: [readyEmbed] });
      log('INFO', 'Sent startup notification DM to owner.');
    } catch (err) {
      logError('ready: DM owner startup notification', err);
    }
  }
});

// Surface Discord.js runtime errors (e.g. WebSocket disconnects) without
// crashing — the client's built-in reconnect logic will handle recovery.
client.on('error', (err) => {
  log('ERROR', `Discord client error: ${err.message}`);
});

// ─── Autocomplete Handler ─────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isAutocomplete()) return;

  if (interaction.commandName === 'removeitem') {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    try {
      const items = getAllItems();
      const choices = items
        .filter(item => item.name.toLowerCase().includes(focusedValue))
        .slice(0, 25)
        .map(item => ({ name: item.name, value: item.name }));
      await interaction.respond(choices);
    } catch (err) {
      logError('autocomplete [removeitem]', err);
      await interaction.respond([]);
    }
  }

  if (interaction.commandName === 'buy') {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    try {
      const items = getAllItems();
      const choices = items
        .filter(item => item.name.toLowerCase().includes(focusedValue))
        .slice(0, 25)
        .map(item => ({ name: `${item.name} — 🪙 ${item.price} coins`, value: item.name }));
      await interaction.respond(choices);
    } catch (err) {
      logError('autocomplete [buy]', err);
      await interaction.respond([]);
    }
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, user } = interaction;

  // ── Top-level guard: catch any unhandled error in any command ───────────────
  try {

    // ── Game commands ─────────────────────────────────────────────────────────
    if (['guess', 'currentpoi', 'skipcooldown', 'guessitem', 'setitem', 'additemhint'].includes(commandName)) {
      return await handleGame(interaction, updateBalance, client, () => {
        // Immediately push a fresh embed to all tracked leaderboard messages
        // so the new win is reflected without waiting for the next 30-second tick.
        refreshTrackedLeaderboards(client).catch(err =>
          logError('leaderboard post-win refresh', err)
        );
      });
    }

    // ── /spinwheel ────────────────────────────────────────────────────────────
    if (commandName === 'spinwheel') {
      // Owner-only guard
      if (!OWNER_ID || user.id !== OWNER_ID) {
        // Also allow server admins when used inside a guild
        const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
        if (!isAdmin) {
          return await safeReply(interaction, {
            content: '❌ Only the bot owner or a server administrator can use this command.',
            ephemeral: true,
          });
        }
      }

      // Resolve target guild: use current guild if in a server, otherwise
      // require the server param when invoked from DMs.
      let targetGuild = interaction.guild ?? null;
      if (!targetGuild) {
        const serverArg = (interaction.options.getString('server') ?? '').trim();
        if (!serverArg) {
          return await safeReply(interaction, {
            content: '❌ You must specify a **server** when using this command from DMs.\nExample: `/spinwheel server:My Server Name`',
            ephemeral: true,
          });
        }
        targetGuild = resolveGuild(client, serverArg);
        if (!targetGuild) {
          return await safeReply(interaction, {
            content: `❌ Could not find a server matching **${serverArg}**. Use the exact server name or its ID.`,
            ephemeral: true,
          });
        }
      }

      return await handleLottery(interaction, db, client, updateBalance, targetGuild);
    }

    // ── /giveaway ─────────────────────────────────────────────────────────────
    if (commandName === 'giveaway') {
      return await handleGiveaway(interaction, client);
    }

    // ── /additem ──────────────────────────────────────────────────────────────
    if (commandName === 'additem') {
      // Owner-only guard when used from DMs (no guild context means no member
      // permissions to check, so fall back to the OWNER_ID env var).
      if (!interaction.guild && (!OWNER_ID || user.id !== OWNER_ID)) {
        return await safeReply(interaction, {
          content: '❌ Only the bot owner can use this command from DMs.',
          ephemeral: true,
        });
      }

      // Resolve target guild: use current guild if in a server, otherwise
      // require the server param when invoked from DMs.
      let targetGuild = interaction.guild ?? null;
      if (!targetGuild) {
        const serverArg = (interaction.options.getString('server') ?? '').trim();
        if (!serverArg) {
          return await safeReply(interaction, {
            content: '❌ You must specify a **server** when using this command from DMs.\nExample: `/additem name:Item description:Desc price:10 server:My Server Name`',
            ephemeral: true,
          });
        }
        targetGuild = resolveGuild(client, serverArg);
        if (!targetGuild) {
          return await safeReply(interaction, {
            content: `❌ Could not find a server matching **${serverArg}**. Use the exact server name or its ID.`,
            ephemeral: true,
          });
        }
      }

      const name  = (interaction.options.getString('name') ?? '').trim().slice(0, 100);
      const desc  = (interaction.options.getString('description') ?? '').trim().slice(0, 500);
      const price = interaction.options.getInteger('price');
      const stock = interaction.options.getInteger('stock') ?? -1;

      if (!name || !desc) {
        return await safeReply(interaction, { content: '❌ Item name and description cannot be empty.', ephemeral: true });
      }

      if (getItem(name)) {
        return await safeReply(interaction, { content: `❌ An item called **${name}** already exists.`, ephemeral: true });
      }

      try {
        db.prepare(`
          INSERT INTO shop_items (name, description, price, stock, created_by, is_protected)
          VALUES (?, ?, ?, ?, ?, 1)
        `).run(name, desc, price, stock, user.id);
      } catch (err) {
        logError('additem DB insert', err);
        return await safeReply(interaction, { content: '❌ Failed to add item due to a database error.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Item Added to Shop')
        .addFields(
          { name: 'Item',        value: name,                                    inline: true },
          { name: 'Price',       value: `🪙 ${price} coins`,                     inline: true },
          { name: 'Stock',       value: stock === -1 ? 'Unlimited' : `${stock}`, inline: true },
          { name: 'Description', value: desc },
          { name: 'Server',      value: targetGuild.name,                        inline: true },
        )
        .setFooter({ text: `Added by ${user.username}` })
        .setTimestamp();

      return await safeReply(interaction, { embeds: [embed] });
    }

    // ── /removeitem ───────────────────────────────────────────────────────────
    if (commandName === 'removeitem') {
      const name = (interaction.options.getString('name') ?? '').trim().slice(0, 100);

      if (!name) {
        return await safeReply(interaction, { content: '❌ Item name cannot be empty.', ephemeral: true });
      }

      const item = getItem(name);

      if (!item) {
        return await safeReply(interaction, { content: `❌ No item found with name **${name}**.`, ephemeral: true });
      }

      if (item.is_protected === 1) {
        return await safeReply(interaction, { content: '❌ This item is protected and cannot be deleted.', ephemeral: true });
      }

      try {
        db.prepare('DELETE FROM shop_items WHERE id = ?').run(item.id);
      } catch (err) {
        logError('removeitem DB delete', err);
        return await safeReply(interaction, { content: '❌ Failed to remove item due to a database error.', ephemeral: true });
      }

      return await safeReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('🗑️ Item Removed')
            .setDescription(`**${item.name}** has been removed from the shop.`)
            .setTimestamp()
        ]
      });
    }

    // ── /shop ─────────────────────────────────────────────────────────────────
    if (commandName === 'shop') {
      const items = getAllItems();

      if (!items.length) {
        return await safeReply(interaction, { content: '🛒 The shop is currently empty.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🛍️  Shop')
        .setDescription('Use `/buy <item>` to purchase an item.')
        .setTimestamp();

      for (const item of items) {
        const stockText = item.stock === -1 ? 'Unlimited' : `${item.stock} left`;
        embed.addFields({
          name: `${item.name} — 🪙 ${item.price} coins`,
          value: `${item.description}\n📦 Stock: ${stockText}`,
        });
      }

      return await safeReply(interaction, { embeds: [embed] });
    }

    // ── /buy ──────────────────────────────────────────────────────────────────
    if (commandName === 'buy') {
      // Resolve target guild: use current guild if in a server, otherwise
      // require the server param when invoked from DMs.
      let buyGuild = interaction.guild ?? null;
      if (!buyGuild) {
        const serverArg = (interaction.options.getString('server') ?? '').trim();
        if (!serverArg) {
          return await safeReply(interaction, {
            content: '❌ You must specify a **server** when using this command from DMs.\nExample: `/buy item:50 WIN LOTTERY server:My Server Name`',
            ephemeral: true,
          });
        }
        buyGuild = resolveGuild(client, serverArg);
        if (!buyGuild) {
          return await safeReply(interaction, {
            content: `❌ Could not find a server matching **${serverArg}**. Use the exact server name or its ID.`,
            ephemeral: true,
          });
        }
      }

      const itemName = (interaction.options.getString('item') ?? '').trim().slice(0, 100);
      const quantity = interaction.options.getInteger('quantity') ?? 1;

      if (!itemName) {
        return await safeReply(interaction, { content: '❌ Please provide an item name.', ephemeral: true });
      }

      const item = getItem(itemName);

      if (!item) {
        return await safeReply(interaction, {
          content: `❌ Item **${itemName}** not found. Use \`/shop\` to see available items.`,
          ephemeral: true,
        });
      }

      // Stock check
      if (item.stock !== -1 && item.stock < quantity) {
        return await safeReply(interaction, {
          content: `❌ Not enough stock! Only **${item.stock}** of **${item.name}** remain.`,
          ephemeral: true,
        });
      }

      const totalCost = item.price * quantity;
      const balance   = getBalance(user.id);

      if (balance < totalCost) {
        return await safeReply(interaction, {
          content: `❌ You don't have enough coins!\n💰 You have: **${balance}** | 🏷️ Cost: **${totalCost}**`,
          ephemeral: true,
        });
      }

      // Process purchase in a transaction
      try {
        const purchase = db.transaction(() => {
          updateBalance(user.id, -totalCost);

          if (item.stock !== -1) {
            db.prepare('UPDATE shop_items SET stock = stock - ? WHERE id = ?').run(quantity, item.id);
          }

          db.prepare(`
            INSERT INTO purchases (user_id, item_id, quantity, total_cost)
            VALUES (?, ?, ?, ?)
          `).run(user.id, item.id, quantity, totalCost);

          db.prepare(`
            INSERT INTO inventories (user_id, item_id, quantity) VALUES (?, ?, ?)
            ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = quantity + ?
          `).run(user.id, item.id, quantity, quantity);
        });

        purchase();
      } catch (err) {
        logError('buy DB transaction', err);
        return await safeReply(interaction, { content: '❌ Purchase failed due to a database error. No coins were deducted.', ephemeral: true });
      }

      // Add to lottery if buying "50 WIN LOTTERY"
      if (itemName.toUpperCase() === '50 WIN LOTTERY') {
        for (let i = 0; i < quantity; i++) {
          addToLottery(db, user.id);
        }
      }

      const newBalance = getBalance(user.id);

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🎉 Purchase Successful!')
        .addFields(
          { name: 'Item',              value: item.name,              inline: true },
          { name: 'Quantity',          value: `${quantity}`,          inline: true },
          { name: 'Total Cost',        value: `🪙 ${totalCost} coins`, inline: true },
          { name: 'Remaining Balance', value: `🪙 ${newBalance} coins` },
        )
        .setFooter({ text: `Purchased by ${user.username}` })
        .setTimestamp();

      // ── Ping the owner via DM ────────────────────────────────────────────────
      if (OWNER_ID) {
        try {
          const owner = await client.users.fetch(OWNER_ID);
          const ownerEmbed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle('🛒 New Purchase Alert!')
            .addFields(
              { name: 'Buyer',      value: `${user.username} (<@${user.id}>)`,  inline: true },
              { name: 'Item',       value: item.name,                            inline: true },
              { name: 'Quantity',   value: `${quantity}`,                        inline: true },
              { name: 'Total Cost', value: `🪙 ${totalCost} coins`,             inline: true },
              { name: 'Server',     value: buyGuild?.name ?? 'Unknown', inline: true },
            )
            .setTimestamp();

          await owner.send({ content: '🔔 **Someone just bought something!**', embeds: [ownerEmbed] });
        } catch (err) {
          logError('buy: DM owner', err);
        }
      }

      return await safeReply(interaction, { embeds: [embed] });
    }

    // ── /balance ──────────────────────────────────────────────────────────────
    if (commandName === 'balance') {
      const balance = getBalance(user.id);
      return await safeReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle('💰 Your Balance')
            .setDescription(`You have **${balance} coins**.`)
            .setTimestamp()
        ]
      });
    }

    // ── /givecoin ─────────────────────────────────────────────────────────────
    if (commandName === 'givecoin') {
      // Owner-only guard when used from DMs (no guild context means no member
      // permissions to check, so fall back to the OWNER_ID env var).
      if (!interaction.guild && (!OWNER_ID || user.id !== OWNER_ID)) {
        return await safeReply(interaction, {
          content: '❌ Only the bot owner can use this command from DMs.',
          ephemeral: true,
        });
      }

      // Resolve target guild for the server label in the response.
      // When used in a server, use that guild; from DMs, use the server param.
      let giveGuild = interaction.guild ?? null;
      if (!giveGuild) {
        const serverArg = (interaction.options.getString('server') ?? '').trim();
        if (!serverArg) {
          return await safeReply(interaction, {
            content: '❌ You must specify a **server** when using this command from DMs.\nExample: `/givecoin user:@Someone amount:100 server:My Server Name`',
            ephemeral: true,
          });
        }
        giveGuild = resolveGuild(client, serverArg);
        if (!giveGuild) {
          return await safeReply(interaction, {
            content: `❌ Could not find a server matching **${serverArg}**. Use the exact server name or its ID.`,
            ephemeral: true,
          });
        }
      }

      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');

      if (!target) {
        return await safeReply(interaction, { content: '❌ Could not resolve the target user.', ephemeral: true });
      }

      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount === 0) {
        return await safeReply(interaction, { content: '❌ Please provide a valid non-zero coin amount.', ephemeral: true });
      }

      updateBalance(target.id, amount);
      const newBal = getBalance(target.id);

      return await safeReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('🪙 Coins Given')
            .setDescription(`Gave **${amount} coins** to ${target}. They now have **${newBal} coins**.`)
            .addFields({ name: 'Server', value: giveGuild.name, inline: true })
            .setTimestamp()
        ]
      });
    }

    // ── /leaderboard ──────────────────────────────────────────────────────────
    if (commandName === 'leaderboard') {
      const limit = interaction.options.getInteger('limit') ?? 10;

      const embed = await buildLeaderboardEmbed(limit, client);
      if (!embed) {
        return await safeReply(interaction, { content: '❌ Failed to fetch leaderboard data.', ephemeral: true });
      }

      // Send the embed and then track the resulting message for auto-refresh.
      await safeReply(interaction, { embeds: [embed] });
      try {
        const sent = await interaction.fetchReply();
        activeLeaderboards.set(sent.id, {
          channelId:  sent.channelId,
          limit,
          lastUpdate: Date.now(),
        });
        log('INFO', `Tracking leaderboard message ${sent.id} in channel ${sent.channelId} (limit=${limit}).`);
      } catch (err) {
        logError('leaderboard: fetchReply for tracking', err);
      }
      return;
    }

    // ── /clan ─────────────────────────────────────────────────────────────────
    if (commandName === 'clan') {
      return await handleClan(interaction, db, client);
    }

    // ── /ban ──────────────────────────────────────────────────────────────────
    if (commandName === 'ban') {
      // Must be used inside a guild
      if (!interaction.guild) {
        return await safeReply(interaction, { content: '❌ This command can only be used inside a server.', ephemeral: true });
      }

      const target    = interaction.options.getUser('user');
      const timeStr   = interaction.options.getString('time');
      const reason    = (interaction.options.getString('reason') ?? '').trim() || 'No reason provided';

      if (!target) {
        return await safeReply(interaction, { content: '❌ Could not resolve the target user.', ephemeral: true });
      }

      // Prevent banning yourself or the bot
      if (target.id === user.id) {
        return await safeReply(interaction, { content: '❌ You cannot ban yourself.', ephemeral: true });
      }
      if (target.id === client.user.id) {
        return await safeReply(interaction, { content: '❌ I cannot ban myself.', ephemeral: true });
      }

      // Parse optional duration
      let durationMs = null;
      if (timeStr) {
        durationMs = parseTime(timeStr);
        if (durationMs === null) {
          return await safeReply(interaction, {
            content: '❌ Invalid time format. Use a number followed by `w`, `d`, `h`, or `m` — e.g. `7d`, `2h`, `30m`.',
            ephemeral: true,
          });
        }
      }

      // Verify the target is actually in the guild before trying to ban
      let targetMember = null;
      try {
        targetMember = await interaction.guild.members.fetch(target.id);
      } catch {
        // User may not be in the guild — that's fine, we can still ban by ID
      }

      // Prevent banning someone with equal or higher role hierarchy
      if (targetMember) {
        const executorMember = await interaction.guild.members.fetch(user.id);
        if (targetMember.roles.highest.position >= executorMember.roles.highest.position) {
          return await safeReply(interaction, {
            content: '❌ You cannot ban someone with an equal or higher role than yours.',
            ephemeral: true,
          });
        }
      }

      try {
        await interaction.guild.members.ban(target.id, { reason: `${reason} (banned by ${user.username})` });
      } catch (err) {
        logError(`ban: guild.members.ban [target=${target.id}]`, err);
        return await safeReply(interaction, {
          content: `❌ Failed to ban **${target.username}**. Make sure I have the **Ban Members** permission and that the user is bannable.`,
          ephemeral: true,
        });
      }

      // Schedule automatic unban if a duration was given
      if (durationMs !== null) {
        const key = `${interaction.guild.id}:${target.id}`;
        scheduledUnbans.set(key, {
          guildId:  interaction.guild.id,
          userId:   target.id,
          unbanAt:  Date.now() + durationMs,
        });
        log('INFO', `Scheduled unban for ${target.id} in guild ${interaction.guild.id} in ${formatDuration(durationMs)}.`);
      }

      const durationText = durationMs !== null ? formatDuration(durationMs) : 'Permanent';
      const unbanText    = durationMs !== null
        ? `<t:${Math.floor((Date.now() + durationMs) / 1000)}:F>`
        : 'Never';

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🔨 User Banned')
        .setThumbnail(target.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: 'User',     value: `${target} (${target.username})`,  inline: true },
          { name: 'Duration', value: durationText,                       inline: true },
          { name: 'Unban',    value: unbanText,                          inline: true },
          { name: 'Reason',   value: reason },
        )
        .setFooter({ text: `Banned by ${user.username}` })
        .setTimestamp();

      log('INFO', `${user.username} banned ${target.username} (${target.id}) in guild ${interaction.guild.id} — duration: ${durationText} — reason: ${reason}`);
      return await safeReply(interaction, { embeds: [embed] });
    }

    // ── /mute ─────────────────────────────────────────────────────────────────
    if (commandName === 'mute') {
      // Restrict to the bot owner and the protected user ID
      const ALLOWED_MUTE_IDS = [OWNER_ID, '1417947408691757226'].filter(Boolean);
      if (!ALLOWED_MUTE_IDS.includes(user.id)) {
        return await safeReply(interaction, {
          content: '❌ You do not have permission to use this command.',
          ephemeral: true,
        });
      }

      // Must be used inside a guild
      if (!interaction.guild) {
        return await safeReply(interaction, { content: '❌ This command can only be used inside a server.', ephemeral: true });
      }

      const target      = interaction.options.getUser('user');
      const durationStr = interaction.options.getString('duration');
      const reason      = (interaction.options.getString('reason') ?? '').trim() || 'No reason provided';

      if (!target) {
        return await safeReply(interaction, { content: '❌ Could not resolve the target user.', ephemeral: true });
      }

      // Prevent muting yourself or the bot
      if (target.id === user.id) {
        return await safeReply(interaction, { content: '❌ You cannot mute yourself.', ephemeral: true });
      }
      if (target.id === client.user.id) {
        return await safeReply(interaction, { content: '❌ I cannot mute myself.', ephemeral: true });
      }

      // Parse required duration
      const durationMs = parseTime(durationStr);
      if (durationMs === null) {
        return await safeReply(interaction, {
          content: '❌ Invalid duration format. Use a number followed by `w`, `d`, `h`, or `m` — e.g. `10m`, `1h`, `1d`.',
          ephemeral: true,
        });
      }

      // Fetch the target member — they must be in the guild to be muted
      let targetMember;
      try {
        targetMember = await interaction.guild.members.fetch(target.id);
      } catch {
        return await safeReply(interaction, {
          content: `❌ **${target.username}** is not in this server.`,
          ephemeral: true,
        });
      }

      // Apply Discord's native timeout to the member
      try {
        await targetMember.timeout(durationMs, `Muted by ${user.username}: ${reason}`);
      } catch (err) {
        logError(`mute: member.timeout [target=${target.id}]`, err);
        return await safeReply(interaction, {
          content: `❌ Failed to mute **${target.username}**. Make sure I have the **Moderate Members** permission and that the user is below me in the role hierarchy.`,
          ephemeral: true,
        });
      }

      // Schedule automatic unmute
      const key = `${interaction.guild.id}:${target.id}`;
      scheduledUnmutes.set(key, {
        guildId:  interaction.guild.id,
        userId:   target.id,
        unmuteAt: Date.now() + durationMs,
      });
      log('INFO', `Scheduled unmute for ${target.id} in guild ${interaction.guild.id} in ${formatDuration(durationMs)}.`);

      // Send DM to the muted user
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle('🔇 You Have Been Muted')
          .setDescription(`You have been muted in **${interaction.guild.name}**.`)
          .addFields(
            { name: 'Duration', value: formatDuration(durationMs), inline: true },
            { name: 'Reason',   value: reason },
          )
          .setFooter({ text: `Muted by ${user.username}` })
          .setTimestamp();

        await target.send({ embeds: [dmEmbed] });
      } catch {
        // User may have DMs disabled — not a fatal error
      }

      const unmuteTimestamp = `<t:${Math.floor((Date.now() + durationMs) / 1000)}:F>`;

      const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('🔇 User Muted')
        .setThumbnail(target.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: 'User',     value: `${target} (${target.username})`,  inline: true },
          { name: 'Duration', value: formatDuration(durationMs),         inline: true },
          { name: 'Unmute',   value: unmuteTimestamp,                    inline: true },
          { name: 'Reason',   value: reason },
        )
        .setFooter({ text: `Muted by ${user.username}` })
        .setTimestamp();

      log('INFO', `${user.username} muted ${target.username} (${target.id}) in guild ${interaction.guild.id} — duration: ${formatDuration(durationMs)} — reason: ${reason}`);
      return await safeReply(interaction, { embeds: [embed] });
    }

    // ── /kick ─────────────────────────────────────────────────────────────────
    if (commandName === 'kick') {
      // Must be used inside a guild
      if (!interaction.guild) {
        return await safeReply(interaction, { content: '❌ This command can only be used inside a server.', ephemeral: true });
      }

      const target = interaction.options.getUser('user');
      const reason = (interaction.options.getString('reason') ?? '').trim() || 'No reason provided';

      if (!target) {
        return await safeReply(interaction, { content: '❌ Could not resolve the target user.', ephemeral: true });
      }

      // Prevent kicking yourself or the bot
      if (target.id === user.id) {
        return await safeReply(interaction, { content: '❌ You cannot kick yourself.', ephemeral: true });
      }
      if (target.id === client.user.id) {
        return await safeReply(interaction, { content: '❌ I cannot kick myself.', ephemeral: true });
      }

      // Fetch the target member — they must be in the guild to be kicked
      let targetMember;
      try {
        targetMember = await interaction.guild.members.fetch(target.id);
      } catch {
        return await safeReply(interaction, {
          content: `❌ **${target.username}** is not in this server.`,
          ephemeral: true,
        });
      }

      // Prevent kicking someone with equal or higher role hierarchy
      const executorMember = await interaction.guild.members.fetch(user.id);
      if (targetMember.roles.highest.position >= executorMember.roles.highest.position) {
        return await safeReply(interaction, {
          content: '❌ You cannot kick someone with an equal or higher role than yours.',
          ephemeral: true,
        });
      }

      try {
        await interaction.guild.members.kick(target.id, `${reason} (kicked by ${user.username})`);
      } catch (err) {
        logError(`kick: guild.members.kick [target=${target.id}]`, err);
        return await safeReply(interaction, {
          content: `❌ Failed to kick **${target.username}**. Make sure I have the **Kick Members** permission and that the user is kickable.`,
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0xE67E22)
        .setTitle('👢 User Kicked')
        .setThumbnail(target.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: 'User',   value: `${target} (${target.username})`, inline: true },
          { name: 'Reason', value: reason },
        )
        .setFooter({ text: `Kicked by ${user.username}` })
        .setTimestamp();

      log('INFO', `${user.username} kicked ${target.username} (${target.id}) in guild ${interaction.guild.id} — reason: ${reason}`);
      return await safeReply(interaction, { embeds: [embed] });
    }

    // ── /warn ─────────────────────────────────────────────────────────────────

    if (commandName === 'warn') {
      // Must be used inside a guild
      if (!interaction.guild) {
        return await safeReply(interaction, { content: '❌ This command can only be used inside a server.', ephemeral: true });
      }

      const target = interaction.options.getUser('user');
      const reason = (interaction.options.getString('reason') ?? '').trim() || 'No reason provided';

      if (!target) {
        return await safeReply(interaction, { content: '❌ Could not resolve the target user.', ephemeral: true });
      }

      // Prevent warning yourself or the bot
      if (target.id === user.id) {
        return await safeReply(interaction, { content: '❌ You cannot warn yourself.', ephemeral: true });
      }
      if (target.id === client.user.id) {
        return await safeReply(interaction, { content: '❌ I cannot be warned.', ephemeral: true });
      }

      // Fetch the target member — they must be in the guild to be warned
      let targetMember;
      try {
        targetMember = await interaction.guild.members.fetch(target.id);
      } catch {
        return await safeReply(interaction, {
          content: `❌ **${target.username}** is not in this server.`,
          ephemeral: true,
        });
      }

      // Prevent warning someone with equal or higher role hierarchy
      const executorMember = await interaction.guild.members.fetch(user.id);
      if (targetMember.roles.highest.position >= executorMember.roles.highest.position) {
        return await safeReply(interaction, {
          content: '❌ You cannot warn someone with an equal or higher role than yours.',
          ephemeral: true,
        });
      }

      // Insert warning into the database
      try {
        db.prepare(`
          INSERT INTO warnings (user_id, guild_id, moderator_id, reason)
          VALUES (?, ?, ?, ?)
        `).run(target.id, interaction.guild.id, user.id, reason);
      } catch (err) {
        logError(`warn: DB insert [target=${target.id}]`, err);
        return await safeReply(interaction, {
          content: '❌ Failed to record the warning due to a database error.',
          ephemeral: true,
        });
      }

      // Count total warnings for this user in this guild
      let warningCount = 0;
      try {
        const row = db.prepare(
          'SELECT COUNT(*) AS count FROM warnings WHERE user_id = ? AND guild_id = ?'
        ).get(target.id, interaction.guild.id);
        warningCount = row?.count ?? 1;
      } catch (err) {
        logError(`warn: DB count [target=${target.id}]`, err);
      }

      const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('⚠️ User Warned')
        .setThumbnail(target.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: 'User',           value: `${target} (${target.username})`, inline: true },
          { name: 'Total Warnings', value: `${warningCount}`,                inline: true },
          { name: 'Reason',         value: reason },
        )
        .setFooter({ text: `Warned by ${user.username}` })
        .setTimestamp();

      log('INFO', `${user.username} warned ${target.username} (${target.id}) in guild ${interaction.guild.id} — warning #${warningCount} — reason: ${reason}`);
      return await safeReply(interaction, { embeds: [embed] });
    }

    // ── /unmute ───────────────────────────────────────────────────────────────
    if (commandName === 'unmute') {
      // Restrict to the bot owner and the protected user ID
      const ALLOWED_UNMUTE_IDS = [OWNER_ID, '1417947408691757226'].filter(Boolean);
      if (!ALLOWED_UNMUTE_IDS.includes(user.id)) {
        return await safeReply(interaction, {
          content: '❌ You do not have permission to use this command.',
          ephemeral: true,
        });
      }

      // Must be used inside a guild
      if (!interaction.guild) {
        return await safeReply(interaction, { content: '❌ This command can only be used inside a server.', ephemeral: true });
      }

      const target = interaction.options.getUser('user');
      const reason = (interaction.options.getString('reason') ?? '').trim() || 'No reason provided';

      if (!target) {
        return await safeReply(interaction, { content: '❌ Could not resolve the target user.', ephemeral: true });
      }

      // Call the antispam unmuteUser to clear permission overwrites and reset state
      await unmuteUser(interaction.guild, target.id);

      // Send a DM to the unmuted user
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('🔊 You Have Been Unmuted')
          .setDescription(`You have been unmuted in **${interaction.guild.name}** and can now participate again.`)
          .addFields({ name: 'Reason', value: reason })
          .setFooter({ text: `Unmuted by ${user.username}` })
          .setTimestamp();

        await target.send({ embeds: [dmEmbed] });
      } catch {
        // User may have DMs disabled — not a fatal error
      }

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🔊 User Unmuted')
        .setThumbnail(target.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: 'User',   value: `${target} (${target.username})`, inline: true },
          { name: 'Reason', value: reason },
        )
        .setFooter({ text: `Unmuted by ${user.username}` })
        .setTimestamp();

      log('INFO', `${user.username} unmuted ${target.username} (${target.id}) in guild ${interaction.guild.id} — reason: ${reason}`);
      return await safeReply(interaction, { embeds: [embed] });
    }

    // ── /announce ─────────────────────────────────────────────────────────────
    if (commandName === 'announce') {
      // Owner-only guard
      if (!OWNER_ID || user.id !== OWNER_ID) {
        return await safeReply(interaction, {
          content: '❌ Only the bot owner can use this command.',
          ephemeral: true,
        });
      }

      const message   = interaction.options.getString('message').trim();
      const serverArg = (interaction.options.getString('server') ?? '').trim();
      const pingChoice = interaction.options.getString('ping') ?? 'none';
      const pingUser   = interaction.options.getUser('pinguser');

      // Resolve the ping content string
      // Priority: explicit pinguser > ping choice of 'everyone' > no ping
      let pingContent = null;
      if (pingUser) {
        pingContent = `<@${pingUser.id}>`;
      } else if (pingChoice === 'everyone') {
        pingContent = '@everyone';
      }

      // Build the announcement embed
      const announceEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📢 Announcement')
        .setDescription(message)
        .setFooter({ text: `From ${user.username}` })
        .setTimestamp();

      // Helper: send the embed to the first text channel the bot can message in a guild
      async function sendToGuild(guild) {
        const channel = guild.channels.cache
          .filter(c =>
            c.isTextBased() &&
            !c.isThread() &&
            c.permissionsFor(guild.members.me)?.has('SendMessages')
          )
          .sort((a, b) => a.rawPosition - b.rawPosition)
          .first();

        if (!channel) {
          log('WARN', `announce: no sendable text channel found in guild ${guild.id} (${guild.name})`);
          return false;
        }

        try {
          const sendPayload = { embeds: [announceEmbed] };
          if (pingContent) sendPayload.content = pingContent;
          await channel.send(sendPayload);
          log('INFO', `announce: sent to guild ${guild.id} (${guild.name}) in channel ${channel.id}`);
          return true;
        } catch (err) {
          logError(`announce: send to guild ${guild.id} (${guild.name})`, err);
          return false;
        }
      }

      // ── Case 1: used inside a server — announce to that server only ──────────
      if (interaction.guild) {
        const success = await sendToGuild(interaction.guild);
        if (!success) {
          return await safeReply(interaction, {
            content: '❌ Could not find a text channel to send the announcement in this server.',
            ephemeral: true,
          });
        }
        return await safeReply(interaction, {
          content: `✅ Announcement sent to **${interaction.guild.name}**.`,
          ephemeral: true,
        });
      }

      // ── Case 2: used in DMs with a specific server argument ─────────────────
      if (serverArg) {
        // Match by ID first, then by name (case-insensitive)
        const targetGuild =
          client.guilds.cache.get(serverArg) ??
          client.guilds.cache.find(g => g.name.toLowerCase() === serverArg.toLowerCase());

        if (!targetGuild) {
          return await safeReply(interaction, {
            content: `❌ Could not find a server matching **${serverArg}**. Use the exact server name or its ID.`,
            ephemeral: true,
          });
        }

        const success = await sendToGuild(targetGuild);
        if (!success) {
          return await safeReply(interaction, {
            content: `❌ Could not find a text channel to send the announcement in **${targetGuild.name}**.`,
            ephemeral: true,
          });
        }
        return await safeReply(interaction, {
          content: `✅ Announcement sent to **${targetGuild.name}**.`,
          ephemeral: true,
        });
      }

      // ── Case 3: used in DMs with no server argument — broadcast to all ───────
      const guilds = [...client.guilds.cache.values()];
      let successCount = 0;
      let failCount    = 0;

      for (const guild of guilds) {
        const ok = await sendToGuild(guild);
        if (ok) successCount++; else failCount++;
      }

      log('INFO', `announce: broadcast complete — ${successCount} succeeded, ${failCount} failed.`);
      return await safeReply(interaction, {
        content: `✅ Announcement sent to **${successCount}** server${successCount !== 1 ? 's' : ''}${failCount > 0 ? ` (failed to reach ${failCount})` : ''}.`,
        ephemeral: true,
      });
    }

    // ── /shutdown ─────────────────────────────────────────────────────────────
    if (commandName === 'shutdown') {
      if (!OWNER_ID || user.id !== OWNER_ID) {
        return await safeReply(interaction, {
          content: '❌ Only the bot owner can use this command.',
          ephemeral: true,
        });
      }

      await safeReply(interaction, {
        content: '🔴 Shutting down the bot. Goodbye!',
        ephemeral: true,
      });

      log('INFO', `Shutdown initiated by owner ${user.username} (${user.id}).`);

      // ── Notify owner via DM before shutting down ───────────────────────────
      try {
        const owner = await client.users.fetch(OWNER_ID);
        const shutdownEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('🔴 Bot Shutting Down')
          .setDescription('The bot is shutting down and will go offline now.')
          .addFields(
            { name: 'Initiated by', value: `${user.username} (<@${user.id}>)`, inline: true },
            { name: 'Timestamp',    value: `<t:${Math.floor(Date.now() / 1000)}:F>`,          inline: true },
          )
          .setTimestamp();
        await owner.send({ content: '🔴 **Bot is shutting down!**', embeds: [shutdownEmbed] });
      } catch (err) {
        logError('shutdown: DM owner notification', err);
      }

      client.destroy();
      process.exit(0);
    }

    // ── /restart ──────────────────────────────────────────────────────────────
    if (commandName === 'restart') {
      if (!OWNER_ID || user.id !== OWNER_ID) {
        return await safeReply(interaction, {
          content: '❌ Only the bot owner can use this command.',
          ephemeral: true,
        });
      }

      await safeReply(interaction, {
        content: '🔄 Restarting the bot. Be right back!',
        ephemeral: true,
      });

      log('INFO', `Restart initiated by owner ${user.username} (${user.id}).`);

      // ── Notify owner via DM before restarting ──────────────────────────────
      try {
        const owner = await client.users.fetch(OWNER_ID);
        const restartEmbed = new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle('🔄 Bot Restarting')
          .setDescription('The bot is restarting and will be back online shortly.')
          .addFields(
            { name: 'Initiated by', value: `${user.username} (<@${user.id}>)`, inline: true },
            { name: 'Timestamp',    value: `<t:${Math.floor(Date.now() / 1000)}:F>`,          inline: true },
          )
          .setTimestamp();
        await owner.send({ content: '🔄 **Bot is restarting!**', embeds: [restartEmbed] });
      } catch (err) {
        logError('restart: DM owner notification', err);
      }

      client.destroy();
      process.exit(0);
    }

  } catch (err) {

    logError(`interactionCreate [${commandName}]`, err);
    await safeReply(interaction, {
      content: '❌ An unexpected error occurred while processing your command. Please try again.',
      ephemeral: true,
    });
  }

});

// ─── XP on message ────────────────────────────────────────────────────────────
client.on('messageCreate', (message) => {
  // Anti-spam: check for repeated mentions of the protected user first
  checkMentions(message, client).catch(err =>
    log('ERROR', `messageCreate anti-spam handler: ${err?.message ?? err}`)
  );

  handleXp(message, db).catch(err =>
    log('ERROR', `messageCreate XP handler: ${err?.message ?? err}`)
  );
});

// ─── Giveaway reaction tracking ───────────────────────────────────────────────
// Partial reactions/messages must be fetched before they can be used.
client.on('messageReactionAdd', async (reaction, user) => {
  try {
    // Fetch partial structures so all data is available
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();
    await handleGiveawayReaction(reaction, user);
  } catch (err) {
    log('ERROR', `messageReactionAdd giveaway handler: ${err?.message ?? err}`);
  }
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
function shutdown(signal) {
  log('INFO', `Received ${signal}. Shutting down gracefully...`);
  client.destroy();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ─── Start ────────────────────────────────────────────────────────────────────
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

async function start(attempt = 1) {
  try {
    log('INFO', `Connecting to Discord... (attempt ${attempt}/${MAX_RETRIES})`);
    await client.login(TOKEN);
  } catch (err) {
    // TokenInvalid means the token is structurally wrong or revoked — retrying
    // will never help, so fail immediately with a clear, actionable message.
    if (err.code === 'TokenInvalid' || err.message?.includes('TOKEN_INVALID')) {
      log('ERROR', 'Login failed: the token was rejected by Discord (TokenInvalid). Verify that DISCORD_TOKEN is correct and has not been regenerated or revoked in the Discord Developer Portal.');
      process.exit(1);
    }

    // For transient failures (network issues, Discord outages) retry up to
    // MAX_RETRIES times with a fixed delay between attempts.
    if (attempt < MAX_RETRIES) {
      log('WARN', `Login attempt ${attempt} failed: ${err.message}. Retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return start(attempt + 1);
    }

    log('ERROR', `Login failed after ${MAX_RETRIES} attempts: ${err.message}`);
    process.exit(1);
  }
}

start();
