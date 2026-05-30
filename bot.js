const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// Reward tiers: time in minutes -> coins earned
const REWARD_TIERS = [
  { minutes: 10, coins: 1 },
  { minutes: 20, coins: 2 },
  { minutes: 35, coins: 5 },
  { minutes: 60, coins: 10 },
  { minutes: 80, coins: 15 },
  { minutes: 95, coins: 20 },
];

function calculateRewardCoins(minutesInServer) {
  // Find the highest tier the user qualifies for
  let totalCoins = 0;
  for (const tier of REWARD_TIERS) {
    if (minutesInServer >= tier.minutes) {
      totalCoins = tier.coins;
    } else {
      break;
    }
  }
  return totalCoins;
}
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { commands: gameCommands, handleGame, checkCooldowns, sendDailyHints } = require('./game.js');
const { commands: clanCommands, handleClan, handleXp, initClanTables } = require('./clan.js');
const { commands: lotteryCommands, handleLottery, initLotteryTable, addToLottery, getLotteryParticipants } = require('./lottery.js');
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
const ADMIN_ID = '1323477103877820428';        // Admin user ID for purchase alerts

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

// ─── Lottery Wheel Webhook ────────────────────────────────────────────────────

/**
 * Notify the lottery wheel website of the current participant list.
 *
 * Reads WHEEL_WEBSITE_WEBHOOK from the environment, ensures the URL ends with
 * /api/spin, then POSTs the current participant data as JSON.  All errors are
 * caught and logged so a webhook failure never interrupts the purchase flow.
 *
 * @param {object[]} participants  All rows from lottery_participants.
 * @param {import('discord.js').Client} discordClient  The Discord client used to resolve user IDs to usernames.
 */
async function sendWebhook(participants, discordClient) {
  try {
    let webhookUrl = (process.env.WHEEL_WEBSITE_WEBHOOK ?? '').trim();
    if (!webhookUrl) {
      log('WARN', 'sendWebhook: WHEEL_WEBSITE_WEBHOOK is not set — skipping.');
      return;
    }

    // Normalise: always target the /api/spin endpoint.
    if (!webhookUrl.endsWith('/api/spin')) {
      webhookUrl = webhookUrl.replace(/\/+$/, '') + '/api/spin';
    }

    const totalTickets   = participants.length;
    const uniqueEntrants = new Set(participants.map(p => p.user_id)).size;

    // Resolve every participant row to a Discord username, preserving duplicates
    // so that users with multiple tickets appear once per ticket in the payload.
    // If the fetch fails (e.g. the user deleted their account or is otherwise
    // unavailable) fall back to the raw user ID so the payload is always complete.
    const participantNames = await Promise.all(
      participants.map(async (p) => {
        if (!discordClient) return p.user_id;
        try {
          const user = await discordClient.users.fetch(p.user_id);
          return user.username;
        } catch {
          log('WARN', `sendWebhook: could not fetch user ${p.user_id} — using ID as fallback.`);
          return p.user_id;
        }
      })
    );

    const payload = {
      action:         'update',
      participants:   participantNames,
      totalTickets,
      uniqueEntrants,
    };

    const maskedUrl = webhookUrl.slice(0, 40) + (webhookUrl.length > 40 ? '…' : '');
    log('INFO', `sendWebhook: POST ${maskedUrl} — ${totalTickets} ticket(s), ${uniqueEntrants} entrant(s)`);

    const response = await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    if (!response.ok) {
      log('WARN', `sendWebhook: received HTTP ${response.status} from wheel website.`);
    } else {
      log('INFO', `sendWebhook: wheel website notified successfully (HTTP ${response.status}).`);
    }
  } catch (err) {
    logError('sendWebhook', err);
  }
}

// ─── Coin Shop Webhook ────────────────────────────────────────────────────────

/**
 * Send a synchronisation event to the coin-shop website.
 *
 * Supported actions:
 *   'add'         — credit coins to a user   (payload: { userId, amount })
 *   'add_item'    — add a shop item           (payload: { id, name, price, description })
 *   'remove_item' — remove a shop item        (payload: { id })
 *
 * The webhook URL is always https://coin-shop-hub-production.up.railway.app/api/webhook/coins.
 * Authentication uses two headers:
 *   X-Webhook-Secret  — the shared secret (WEBHOOK_SECRET env var)
 *   X-Owner-Id        — the bot owner's Discord user ID (OWNER_ID env var)
 *
 * All errors are caught and logged so a webhook failure never interrupts the
 * command flow.
 *
 * @param {object} payload  The JSON body to send (must include an `action` key).
 */
async function sendCoinShopWebhook(payload) {
  const COIN_SHOP_WEBHOOK_URL = 'https://coin-shop-hub-production.up.railway.app/api/webhook/coins';
  const webhookSecret = (process.env.WEBHOOK_SECRET ?? '4sc39e1za0zx0b0h4t521umkzmrb3ci9').trim();

  try {
    log('INFO', `sendCoinShopWebhook: action=${payload.action} — sending to ${COIN_SHOP_WEBHOOK_URL}`);

    const response = await fetch(COIN_SHOP_WEBHOOK_URL, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'X-Webhook-Secret': webhookSecret,
        'X-Owner-Id':       OWNER_ID ?? '',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      log('WARN', `sendCoinShopWebhook: received HTTP ${response.status} from coin-shop website.`);
    } else {
      log('INFO', `sendCoinShopWebhook: coin-shop website notified successfully (HTTP ${response.status}).`);
    }
  } catch (err) {
    logError('sendCoinShopWebhook', err);
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

// ─── Lottery spin state ───────────────────────────────────────────────────────
// Set to true for the entire duration of handleLottery (from the moment the DB
// is cleared until the spin fully completes).  While true, /buy suppresses its
// webhook update so the website keeps showing the original participant list that
// was sent at the start of the spin rather than the (empty) next-round list.
let isSpinning = false;

// ─── Spin result callback server ──────────────────────────────────────────────
//
// The lottery wheel website POSTs the winner back to this bot via a lightweight
// HTTP server.  The bot listens on BOT_CALLBACK_PORT (default: 3000).
//
// Endpoint: POST /api/result
// Body:     { "winner": "<display name>" }
//
// handleLottery calls waitForSpinResult(timeoutMs) which returns a Promise that
// resolves to { winner } when the website calls back, or resolves to null if no
// callback arrives within `timeoutMs` milliseconds (graceful fallback).
//
const http = require('http');

// Holds the resolve function for the currently-pending spin result promise.
// Only one spin can be in progress at a time, so a single slot is sufficient.
let _spinResultResolve = null;

/**
 * Returns a Promise that resolves to { winner: string } when the website POSTs
 * the spin result, or resolves to null after `timeoutMs` milliseconds.
 *
 * @param {number} timeoutMs - How long to wait before giving up (default 30 s).
 * @returns {Promise<{winner: string}|null>}
 */
function waitForSpinResult(timeoutMs = 30_000) {
  return new Promise(resolve => {
    // Register the resolver so the HTTP handler can call it.
    _spinResultResolve = resolve;

    // Auto-resolve with null after the timeout so the bot never hangs.
    setTimeout(() => {
      if (_spinResultResolve === resolve) {
        _spinResultResolve = null;
        log('WARN', 'waitForSpinResult: timed out — falling back to random winner selection.');
        resolve(null);
      }
    }, timeoutMs);
  });
}

// Start the HTTP server that receives the result callback from the website.
const CALLBACK_PORT = parseInt(process.env.BOT_CALLBACK_PORT ?? '3000', 10);

const callbackServer = http.createServer((req, res) => {
  // Only handle POST /api/result
  if (req.method === 'POST' && req.url === '/api/result') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        log('INFO', `callbackServer: received spin result — winner: "${data.winner}"`);

        if (_spinResultResolve) {
          const resolve = _spinResultResolve;
          _spinResultResolve = null;
          resolve({ winner: data.winner ?? null });
        } else {
          log('WARN', 'callbackServer: received result but no spin is waiting for a callback.');
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        logError('callbackServer: parse error', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // Purchase notification — the coin-shop website POSTs here when a user buys
  // an item so the bot owner receives an immediate Discord DM.
  if (req.method === 'POST' && req.url === '/api/purchase') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { userId, username, itemName, itemPrice } = JSON.parse(body);
        log('INFO', `callbackServer: purchase notification — user: "${username}" (${userId}), item: "${itemName}", price: ${itemPrice}`);

        const dmMessage = `🛍️ **Purchase Alert!**\n\n**User**: ${username}\n**Item**: ${itemName}\n**Price**: ${itemPrice} coin${itemPrice === 1 ? '' : 's'}`;

        // Send to owner
        try {
          const owner = await client.users.fetch(OWNER_ID);
          await owner.send(dmMessage);
          log('INFO', 'callbackServer: purchase DM sent to owner.');
        } catch (dmErr) {
          logError('callbackServer: failed to DM owner about purchase', dmErr);
        }

        // Send to admin
        try {
          const admin = await client.users.fetch(ADMIN_ID);
          await admin.send(dmMessage);
          log('INFO', 'callbackServer: purchase DM sent to admin.');
        } catch (dmErr) {
          logError('callbackServer: failed to DM admin about purchase', dmErr);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        logError('callbackServer: purchase parse error', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // Timeout request — the coin-shop website POSTs here when a user buys
  // the timeout item so the bot can timeout a user in a Discord server.
  if (req.method === 'POST' && req.url === '/api/timeout') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { executorId, executorUsername, targetUserId, targetUsername, serverId, serverName, durationMinutes } = JSON.parse(body);
        log('INFO', `callbackServer: timeout request — executor: "${executorUsername}" (${executorId}), target: "${targetUsername}" (${targetUserId}), server: "${serverName}" (${serverId}), duration: ${durationMinutes}m`);

        try {
          // Resolve the guild
          let guild = null;
          if (serverId.match(/^\d+$/)) {
            // It's a numeric ID
            guild = await client.guilds.fetch(serverId);
          } else {
            // It's a server name — search for it
            guild = client.guilds.cache.find(g => g.name.toLowerCase() === serverId.toLowerCase());
          }

          if (!guild) {
            log('WARN', `callbackServer: could not find guild "${serverId}"`);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'Guild not found' }));
            return;
          }

          // Resolve the target member
          let member = null;
          if (targetUserId.match(/^\d+$/)) {
            // It's a numeric ID
            try {
              member = await guild.members.fetch(targetUserId);
            } catch {
              log('WARN', `callbackServer: could not fetch member ${targetUserId} in guild ${guild.id}`);
            }
          } else {
            // It's a username — search for it
            const members = await guild.members.fetch();
            member = members.find(m => m.user.username.toLowerCase() === targetUserId.toLowerCase());
          }

          if (!member) {
            log('WARN', `callbackServer: could not find member "${targetUserId}" in guild ${guild.id}`);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'Member not found in guild' }));
            return;
          }

          // Apply the timeout
          const durationMs = durationMinutes * 60 * 1000;
          await member.timeout(durationMs, `Timeout purchased by ${executorUsername} via Coin Shop Hub`);
          log('INFO', `callbackServer: timed out ${member.user.username} (${member.id}) in guild ${guild.id} for ${durationMinutes} minutes`);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, message: `${member.user.username} has been timed out for ${durationMinutes} minutes` }));
        } catch (timeoutErr) {
          logError('callbackServer: timeout execution error', timeoutErr);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Failed to apply timeout' }));
        }
      } catch (err) {
        logError('callbackServer: timeout parse error', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
      }
    });
    return;
  }


  // Skip cooldown endpoint — removes the guess cooldown for a user
  if (req.method === 'POST' && req.url === '/api/skip-cooldown') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { userId, username } = JSON.parse(body);
        log('INFO', `callbackServer: skip-cooldown request — user: "${username}" (${userId})`);

        // Remove the cooldown for this user from the game module
        gameModule.userCooldowns.delete(userId);
        log('INFO', `callbackServer: removed cooldown for ${username} (${userId})`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, message: `Cooldown removed for ${username}` }));
      } catch (err) {
        logError('callbackServer: skip-cooldown error', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid request' }));
      }
    });
    return;
  }
  // Discord data endpoint — returns all servers the bot is in with their members
  // Get user's time in Sam's Server and calculate reward coins
  if (req.method === 'GET' && req.url.startsWith('/api/rewards/')) {
    const userId = req.url.split('/')[3];
    if (!userId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing userId' }));
      return;
    }

    (async () => {
      try {
        const samServer = client.guilds.cache.get(SAM_SERVER_ID);
        if (!samServer) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Sam Server not found' }));
          return;
        }

        const member = await samServer.members.fetch(userId).catch(() => null);
        if (!member) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'User not in Sam Server' }));
          return;
        }

        // Calculate time in server (in minutes)
        const joinedAt = member.joinedAt;
        const now = new Date();
        const minutesInServer = Math.floor((now - joinedAt) / (1000 * 60));

        // Calculate reward coins based on tiers
        const rewardCoins = calculateRewardCoins(minutesInServer);

        log('INFO', `callbackServer: rewards for ${userId} - ${minutesInServer} minutes in server = ${rewardCoins} coins`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          userId,
          minutesInServer,
          rewardCoins,
          tiers: REWARD_TIERS
        }));
      } catch (err) {
        logError('callbackServer: rewards error', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    })();
    return;
  }

  if (req.method === 'GET' && req.url === '/api/discord-data') {
    (async () => {
    try {
      const servers = client.guilds.cache.map(guild => ({
        id: guild.id,
        name: guild.name,
      }));

      const members = {};
      const MEMBER_CACHE_FILE = '/data/member_cache.json';

      // Load cached members from file
      let cachedMembers = {};
      try {
        if (fs.existsSync(MEMBER_CACHE_FILE)) {
          const cacheData = fs.readFileSync(MEMBER_CACHE_FILE, 'utf-8');
          cachedMembers = JSON.parse(cacheData);
          log('INFO', `Loaded member cache from file: ${Object.keys(cachedMembers).length} guilds`);
        }
      } catch (cacheErr) {
        log('WARN', `Could not load member cache: ${cacheErr.message}`);
      }

      for (const guild of client.guilds.cache.values()) {
        try {
          log('INFO', `Fetching members for guild: ${guild.name} (${guild.id})`);
          const guildMembers = await guild.members.fetch();
          log('INFO', `Successfully fetched ${guildMembers.size} members from ${guild.name}`);

          members[guild.id] = guildMembers
            .filter(m => !m.user.bot)
            .map(m => ({
              id: m.user.id,
              username: m.user.username,
            }));
          
          // Update cache with fresh members
          cachedMembers[guild.id] = members[guild.id];
          
          log('INFO', `Filtered to ${members[guild.id].length} non-bot members from ${guild.name}`);
        } catch (err) {
          log('ERROR', `Failed to fetch members for guild ${guild.name} (${guild.id}): ${err.message}`);
          
          // Return cached members if available, otherwise empty array
          members[guild.id] = cachedMembers[guild.id] || [];
          log('INFO', `Using cached members for ${guild.name}: ${members[guild.id].length} members`);
        }
      }

      // Save updated cache to file
      try {
        fs.mkdirSync('/data', { recursive: true });
        fs.writeFileSync(MEMBER_CACHE_FILE, JSON.stringify(cachedMembers, null, 2));
        log('INFO', `Saved member cache to file`);
      } catch (saveErr) {
        log('WARN', `Could not save member cache: ${saveErr.message}`);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ servers, members }));
    } catch (err) {
      logError('callbackServer: discord-data error', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    })();
    return;
  }

  // 404 for unknown endpoints
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// ─── Discord Client ───────────────────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

// ─── Database ─────────────────────────────────────────────────────────────────

const db = new Database('/data/bot.db');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    username TEXT,
    coins INTEGER DEFAULT 0,
    last_daily_claim TEXT
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    amount INTEGER,
    reason TEXT,
    timestamp TEXT
  );

  CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    item_id TEXT,
    item_name TEXT,
    price INTEGER,
    timestamp TEXT
  );

  CREATE TABLE IF NOT EXISTS lottery_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    username TEXT,
    timestamp TEXT
  );

  CREATE TABLE IF NOT EXISTS giveaway_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    username TEXT,
    giveaway_id TEXT,
    timestamp TEXT
  );
`);

initClanTables(db);
initLotteryTable(db);

// ─── Game Module ──────────────────────────────────────────────────────────────

const gameModule = { userCooldowns: new Map() };

// ─── Client Events ────────────────────────────────────────────────────────────

client.once('ready', () => {
  log('INFO', `Logged in as ${client.user.tag}`);

  // Start the callback server
  callbackServer.listen(CALLBACK_PORT, () => {
    log('INFO', `Callback server listening on port ${CALLBACK_PORT}`);
  });

  // Register slash commands
  const rest = new REST({ version: '10' }).setToken(TOKEN);

  const allCommands = [
    ...gameCommands,
    ...clanCommands,
    ...lotteryCommands,
    ...giveawayCommands,
  ];

  (async () => {
    try {
      log('INFO', `Registering ${allCommands.length} slash commands...`);
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: allCommands });
      log('INFO', 'Slash commands registered successfully.');
    } catch (err) {
      logError('Failed to register slash commands', err);
    }
  })();

  // Send daily hints
  sendDailyHints(client, db);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  try {
    // Game commands
    if (gameCommands.some(cmd => cmd.name === commandName)) {
      return await handleGame(interaction, db, gameModule);
    }

    // Clan commands
    if (clanCommands.some(cmd => cmd.name === commandName)) {
      return await handleClan(interaction, db);
    }

    // Lottery commands
    if (lotteryCommands.some(cmd => cmd.name === commandName)) {
      return await handleLottery(interaction, db, client, sendWebhook, isSpinning, waitForSpinResult, (val) => { isSpinning = val; });
    }

    // Giveaway commands
    if (giveawayCommands.some(cmd => cmd.name === commandName)) {
      return await handleGiveaway(interaction, db);
    }
  } catch (err) {
    logError(`Error handling command ${commandName}`, err);
    await safeReply(interaction, { content: 'An error occurred while processing your command.', ephemeral: true });
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Check for mentions and handle antispam
  await checkMentions(message, db, client);

  // Handle XP for clan members
  await handleXp(message, db);
});

client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  await handleGiveawayReaction(reaction, user, db);
});

// ─── Login ────────────────────────────────────────────────────────────────────

client.login(TOKEN);

