const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// ─── Fortnite POIs with images ────────────────────────────────────────────────
// Individual POI images are hosted in the /pois folder on GitHub and served via
// the raw.githubusercontent.com CDN. Each key maps to a direct PNG URL using
// the format:
//   https://raw.githubusercontent.com/117580-droid/Shop-bot/sandbox/3a54afec-b06b-4e0a-bb11--oau7/pois/{poi-name}.png
// where {poi-name} is the POI name lowercased with spaces replaced by hyphens
// (apostrophes removed). Example: "Chonker's Speedway" → "chonkers-speedway.png"
//
// To activate an image for a POI:
//   1. Upload the PNG to the /pois folder on GitHub with the correct filename.
//   2. Replace the POI_FALLBACK value for that entry below with:
//        `${POI_IMG_BASE}{poi-name}.png`
//
// Fallback: generic Fortnite island image used when a POI has no dedicated image yet.
const POI_FALLBACK = 'https://cdn2.unrealengine.com/Fortnite/fortnite-game/battleroyalenews/v53/BR05_MOTD_Rifttogo-256x256-3bd010b63911f314abb0bba893a01dc49e1eec3c.png';

// Base URL for POI images hosted in the /pois folder on GitHub.
// Usage: `${POI_IMG_BASE}{poi-name}.png`  (name lowercased, spaces → hyphens, apostrophes removed)
const POI_IMG_BASE = 'https://raw.githubusercontent.com/117580-droid/Shop-bot/sandbox/3a54afec-b06b-4e0a-bb11--oau7/pois/';

const POI_IMAGES = {
  // ── Chapter 1 ──────────────────────────────────────────────────────────────
  'Anarchy Acres': `${POI_IMG_BASE}anarchy-acres.png`,
  'Dusty Depot': `${POI_IMG_BASE}dusty-depot.png`,
  'Fatal Fields': `${POI_IMG_BASE}fatal-fields.png`,
  'Flush Factory': `${POI_IMG_BASE}flush-factory.png`,
  'Greasy Grove': `${POI_IMG_BASE}greasy-grove.png`,
  'Haunted Hills': `${POI_IMG_BASE}haunted-hills.png`,
  'Junk Junction': `${POI_IMG_BASE}junk-junction.png`,
  'Lazy Links': `${POI_IMG_BASE}lazy-links.png`,
  'Lonely Lodge': `${POI_IMG_BASE}lonely-lodge.png`,
  'Loot Lake': `${POI_IMG_BASE}loot-lake.png`,
  'Lucky Landing': `${POI_IMG_BASE}lucky-landing.png`,
  'Moisty Mire': `${POI_IMG_BASE}moisty-mire.png`,
  'Pleasant Park': `${POI_IMG_BASE}pleasant-park.png`,
  'Retail Row': `${POI_IMG_BASE}retail-row.png`,
  'Risky Reels': `${POI_IMG_BASE}risky-reels.png`,
  'Salty Springs': `${POI_IMG_BASE}salty-springs.png`,
  'Shifty Shafts': `${POI_IMG_BASE}shifty-shafts.png`,
  'Snobby Shores': `${POI_IMG_BASE}snobby-shores.png`,
  'Tilted Towers': `${POI_IMG_BASE}tilted-towers.png`,
  'Tomato Town': `${POI_IMG_BASE}tomato-town.png`,
  'Wailing Woods': `${POI_IMG_BASE}wailing-woods.png`,
  // ── Chapter 2 ──────────────────────────────────────────────────────────────
  'The Agency': `${POI_IMG_BASE}the-agency.png`,
  'Craggy Cliffs': `${POI_IMG_BASE}craggy-cliffs.png`,
  'Dirty Docks': `${POI_IMG_BASE}dirty-docks.png`,
  'Frenzy Farm': `${POI_IMG_BASE}frenzy-farm.png`,
  'Holly Hedges': `${POI_IMG_BASE}holly-hedges.png`,
  'Lazy Lake': `${POI_IMG_BASE}lazy-lake.png`,
  'Misty Meadows': `${POI_IMG_BASE}misty-meadows.png`,
  'Slurpy Swamp': `${POI_IMG_BASE}slurpy-swamp.png`,
  'Steamy Stacks': `${POI_IMG_BASE}steamy-stacks.png`,
  'Sweaty Sands': `${POI_IMG_BASE}sweaty-sands.png`,
  'The Fortilla': `${POI_IMG_BASE}the-fortilla.png`,
  'The Grotto': `${POI_IMG_BASE}the-grotto.png`,
  'The Shark': `${POI_IMG_BASE}the-shark.png`,
  'Weeping Woods': `${POI_IMG_BASE}weeping-woods.png`,
  // ── Chapter 3 ──────────────────────────────────────────────────────────────
  'Camp Cuddle': `${POI_IMG_BASE}camp-cuddle.png`,
  "Chonker's Speedway": `${POI_IMG_BASE}chonkers-speedway.png`,
  'Condo Canyon': `${POI_IMG_BASE}condo-canyon.png`,
  'Coney Crossroads': `${POI_IMG_BASE}coney-crossroads.png`,
  'Daily Bugle': `${POI_IMG_BASE}daily-bugle.png`,
  'Logjam Lumberyard': `${POI_IMG_BASE}logjam-lumberyard.png`,
  'Rocky Reels': `${POI_IMG_BASE}rocky-reels.png`,
  'Sanctuary': `${POI_IMG_BASE}sanctuary.png`,
  'Sleepy Sound': `${POI_IMG_BASE}sleepy-sound.png`,
  'Synapse Station': `${POI_IMG_BASE}synapse-station.png`,
  'The Joneses': `${POI_IMG_BASE}the-joneses.png`,
  // ── Chapter 4 ──────────────────────────────────────────────────────────────
  'Anvil Square': `${POI_IMG_BASE}anvil-square.png`,
  'Brutal Bastion': `${POI_IMG_BASE}brutal-bastion.png`,
  'Breakwater Bay': `${POI_IMG_BASE}breakwater-bay.png`,
  'Faulty Splits': `${POI_IMG_BASE}faulty-splits.png`,
  'Frenzy Fields': `${POI_IMG_BASE}frenzy-fields.png`,
  'Lonely Labs': `${POI_IMG_BASE}lonely-labs.png`,
  'Mega City': `${POI_IMG_BASE}mega-city.png`,
  'Shattered Slabs': `${POI_IMG_BASE}shattered-slabs.png`,
  'Slappy Shores': `${POI_IMG_BASE}slappy-shores.png`,
  'Steamy Springs': `${POI_IMG_BASE}steamy-springs.png`,
  // ── Chapter 5 ──────────────────────────────────────────────────────────────
  'Classy Courts': `${POI_IMG_BASE}classy-courts.png`,
  'Fencing Fields': `${POI_IMG_BASE}fencing-fields.png`,
  'Grand Glacier': `${POI_IMG_BASE}grand-glacier.png`,
  'Hazy Hillside': `${POI_IMG_BASE}hazy-hillside.png`,
  'Lavish Lair': `${POI_IMG_BASE}lavish-lair.png`,
  'Pleasant Piazza': `${POI_IMG_BASE}pleasant-piazza.png`,
  'Reckless Railways': `${POI_IMG_BASE}reckless-railways.png`,
  'Ritzy Riviera': `${POI_IMG_BASE}ritzy-riviera.png`,
  'Ruined Reels': `${POI_IMG_BASE}ruined-reels.png`,
  'Snooty Steppes': `${POI_IMG_BASE}snooty-steppes.png`,
};

const FORTNITE_POIS = [
  // ── Chapter 1 ──────────────────────────────────────────────────────────────
  { name: 'Anarchy Acres',  image: POI_IMAGES['Anarchy Acres']  ?? POI_FALLBACK },
  { name: 'Dusty Depot',    image: POI_IMAGES['Dusty Depot']    ?? POI_FALLBACK },
  { name: 'Fatal Fields',   image: POI_IMAGES['Fatal Fields']   ?? POI_FALLBACK },
  { name: 'Flush Factory',  image: POI_IMAGES['Flush Factory']  ?? POI_FALLBACK },
  { name: 'Greasy Grove',   image: POI_IMAGES['Greasy Grove']   ?? POI_FALLBACK },
  { name: 'Haunted Hills',  image: POI_IMAGES['Haunted Hills']  ?? POI_FALLBACK },
  { name: 'Junk Junction',  image: POI_IMAGES['Junk Junction']  ?? POI_FALLBACK },
  { name: 'Lazy Links',     image: POI_IMAGES['Lazy Links']     ?? POI_FALLBACK },
  { name: 'Lonely Lodge',   image: POI_IMAGES['Lonely Lodge']   ?? POI_FALLBACK },
  { name: 'Loot Lake',      image: POI_IMAGES['Loot Lake']      ?? POI_FALLBACK },
  { name: 'Lucky Landing',  image: POI_IMAGES['Lucky Landing']  ?? POI_FALLBACK },
  { name: 'Moisty Mire',    image: POI_IMAGES['Moisty Mire']    ?? POI_FALLBACK },
  { name: 'Pleasant Park',  image: POI_IMAGES['Pleasant Park']  ?? POI_FALLBACK },
  { name: 'Retail Row',     image: POI_IMAGES['Retail Row']     ?? POI_FALLBACK },
  { name: 'Risky Reels',    image: POI_IMAGES['Risky Reels']    ?? POI_FALLBACK },
  { name: 'Salty Springs',  image: POI_IMAGES['Salty Springs']  ?? POI_FALLBACK },
  { name: 'Shifty Shafts',  image: POI_IMAGES['Shifty Shafts']  ?? POI_FALLBACK },
  { name: 'Snobby Shores',  image: POI_IMAGES['Snobby Shores']  ?? POI_FALLBACK },
  { name: 'Tilted Towers',  image: POI_IMAGES['Tilted Towers']  ?? POI_FALLBACK },
  { name: 'Tomato Town',    image: POI_IMAGES['Tomato Town']    ?? POI_FALLBACK },
  { name: 'Wailing Woods',  image: POI_IMAGES['Wailing Woods']  ?? POI_FALLBACK },
  // ── Chapter 2 ──────────────────────────────────────────────────────────────
  { name: 'The Agency',        image: POI_IMAGES['The Agency']        ?? POI_FALLBACK },
  { name: 'Craggy Cliffs',     image: POI_IMAGES['Craggy Cliffs']     ?? POI_FALLBACK },
  { name: 'Dirty Docks',       image: POI_IMAGES['Dirty Docks']       ?? POI_FALLBACK },
  { name: 'Frenzy Farm',       image: POI_IMAGES['Frenzy Farm']       ?? POI_FALLBACK },
  { name: 'Holly Hedges',      image: POI_IMAGES['Holly Hedges']      ?? POI_FALLBACK },
  { name: 'Lazy Lake',         image: POI_IMAGES['Lazy Lake']         ?? POI_FALLBACK },
  { name: 'Misty Meadows',     image: POI_IMAGES['Misty Meadows']     ?? POI_FALLBACK },
  { name: 'Slurpy Swamp',      image: POI_IMAGES['Slurpy Swamp']      ?? POI_FALLBACK },
  { name: 'Steamy Stacks',     image: POI_IMAGES['Steamy Stacks']     ?? POI_FALLBACK },
  { name: 'Sweaty Sands',      image: POI_IMAGES['Sweaty Sands']      ?? POI_FALLBACK },
  { name: 'The Fortilla',      image: POI_IMAGES['The Fortilla']      ?? POI_FALLBACK },
  { name: 'The Grotto',        image: POI_IMAGES['The Grotto']        ?? POI_FALLBACK },
  { name: 'The Shark',         image: POI_IMAGES['The Shark']         ?? POI_FALLBACK },
  { name: 'Weeping Woods',     image: POI_IMAGES['Weeping Woods']     ?? POI_FALLBACK },
  // ── Chapter 3 ──────────────────────────────────────────────────────────────
  { name: 'Camp Cuddle',        image: POI_IMAGES['Camp Cuddle']        ?? POI_FALLBACK },
  { name: "Chonker's Speedway", image: POI_IMAGES["Chonker's Speedway"] ?? POI_FALLBACK },
  { name: 'Condo Canyon',       image: POI_IMAGES['Condo Canyon']       ?? POI_FALLBACK },
  { name: 'Coney Crossroads',   image: POI_IMAGES['Coney Crossroads']   ?? POI_FALLBACK },
  { name: 'Daily Bugle',        image: POI_IMAGES['Daily Bugle']        ?? POI_FALLBACK },
  { name: 'Logjam Lumberyard',  image: POI_IMAGES['Logjam Lumberyard']  ?? POI_FALLBACK },
  { name: 'Rocky Reels',        image: POI_IMAGES['Rocky Reels']        ?? POI_FALLBACK },
  { name: 'Sanctuary',          image: POI_IMAGES['Sanctuary']          ?? POI_FALLBACK },
  { name: 'Sleepy Sound',       image: POI_IMAGES['Sleepy Sound']       ?? POI_FALLBACK },
  { name: 'Synapse Station',    image: POI_IMAGES['Synapse Station']    ?? POI_FALLBACK },
  { name: 'The Joneses',        image: POI_IMAGES['The Joneses']        ?? POI_FALLBACK },
  // ── Chapter 4 ──────────────────────────────────────────────────────────────
  { name: 'Anvil Square',      image: POI_IMAGES['Anvil Square']      ?? POI_FALLBACK },
  { name: 'Brutal Bastion',    image: POI_IMAGES['Brutal Bastion']    ?? POI_FALLBACK },
  { name: 'Breakwater Bay',    image: POI_IMAGES['Breakwater Bay']    ?? POI_FALLBACK },
  { name: 'Faulty Splits',     image: POI_IMAGES['Faulty Splits']     ?? POI_FALLBACK },
  { name: 'Frenzy Fields',     image: POI_IMAGES['Frenzy Fields']     ?? POI_FALLBACK },
  { name: 'Lonely Labs',       image: POI_IMAGES['Lonely Labs']       ?? POI_FALLBACK },
  { name: 'Mega City',         image: POI_IMAGES['Mega City']         ?? POI_FALLBACK },
  { name: 'Shattered Slabs',   image: POI_IMAGES['Shattered Slabs']   ?? POI_FALLBACK },
  { name: 'Slappy Shores',     image: POI_IMAGES['Slappy Shores']     ?? POI_FALLBACK },
  { name: 'Steamy Springs',    image: POI_IMAGES['Steamy Springs']    ?? POI_FALLBACK },
  // ── Chapter 5 ──────────────────────────────────────────────────────────────
  { name: 'Classy Courts',     image: POI_IMAGES['Classy Courts']     ?? POI_FALLBACK },
  { name: 'Fencing Fields',    image: POI_IMAGES['Fencing Fields']    ?? POI_FALLBACK },
  { name: 'Grand Glacier',     image: POI_IMAGES['Grand Glacier']     ?? POI_FALLBACK },
  { name: 'Hazy Hillside',     image: POI_IMAGES['Hazy Hillside']     ?? POI_FALLBACK },
  { name: 'Lavish Lair',       image: POI_IMAGES['Lavish Lair']       ?? POI_FALLBACK },
  { name: 'Pleasant Piazza',   image: POI_IMAGES['Pleasant Piazza']   ?? POI_FALLBACK },
  { name: 'Reckless Railways', image: POI_IMAGES['Reckless Railways'] ?? POI_FALLBACK },
  { name: 'Ritzy Riviera',     image: POI_IMAGES['Ritzy Riviera']     ?? POI_FALLBACK },
  { name: 'Ruined Reels',      image: POI_IMAGES['Ruined Reels']      ?? POI_FALLBACK },
  { name: 'Snooty Steppes',    image: POI_IMAGES['Snooty Steppes']    ?? POI_FALLBACK },
];

const COOLDOWN_MS = 120 * 60 * 1000;
const ITEM_GUESS_COOLDOWN_MS = 30 * 1000; // 30-second cooldown for /guessitem

// ─── Consistent error logger ──────────────────────────────────────────────────
function logError(context, err) {
  console.error(`[ERROR] ${context}:`, err?.message ?? err);
}

// ─── Dual-user alert helper ───────────────────────────────────────────────────
// Sends an identical embed DM to both the owner and the secondary alert user.
// Errors for either recipient are caught independently so one failure doesn't
// prevent the other from receiving the message.
const ALERT_USER_ID = '1417947408691757226';

async function alertBothUsers(client, title, description, color) {
  const OWNER_ID = process.env.OWNER_ID;
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();

  if (OWNER_ID) {
    try {
      const owner = await client.users.fetch(OWNER_ID);
      await owner.send({ embeds: [embed] });
    } catch (err) {
      logError('alertBothUsers: DM owner', err);
    }
  }

  try {
    const alertUser = await client.users.fetch(ALERT_USER_ID);
    await alertUser.send({ embeds: [embed] });
  } catch (err) {
    logError(`alertBothUsers: DM alert user ${ALERT_USER_ID}`, err);
  }
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
    logError('game safeReply', err);
  }
}

// ─── Game State ───────────────────────────────────────────────────────────────
let currentPoi = null;
const userCooldowns = new Map();

// ─── Item Game State ──────────────────────────────────────────────────────────
// Tracks the active /guessitem game per guild. Each entry in the map is keyed
// by guild ID and holds the item being guessed, accumulated hints, a daily hint
// counter (resets each calendar day), a daily-hint delivery tracker, and a log
// of all guesses.
//
// itemGames:         guildId → { item, hints, hintDay, lastHintSentDay, guesses }
// itemUserCooldowns: guildId → Map<userId, expiry timestamp (ms)>
const itemGames = new Map();
const itemUserCooldowns = new Map(); // guildId → Map<userId, expiry timestamp (ms)>

/** Return (creating if absent) the item game state for a given guild. */
function getItemGame(guildId) {
  if (!itemGames.has(guildId)) {
    itemGames.set(guildId, {
      item:             null,  // { name: string }
      hints:            [],    // string[]
      hintDay:          null,  // YYYY-MM-DD (UTC) — day the last hint was revealed via wrong guess
      lastHintSentDay:  null,  // YYYY-MM-DD (UTC) — day the last daily hint was auto-sent
      guesses:          [],    // { userId, username, guess, timestamp }[]
    });
  }
  return itemGames.get(guildId);
}

/** Return (creating if absent) the per-user cooldown map for a given guild. */
function getItemCooldownMap(guildId) {
  if (!itemUserCooldowns.has(guildId)) {
    itemUserCooldowns.set(guildId, new Map());
  }
  return itemUserCooldowns.get(guildId);
}

function getRandomPoi(excludeName = null) {
  const filtered = excludeName ? FORTNITE_POIS.filter(p => p.name !== excludeName) : FORTNITE_POIS;
  return filtered[Math.floor(Math.random() * filtered.length)];
}

function initPoi() {
  currentPoi = getRandomPoi();
  return currentPoi;
}

function getCurrentPoi() {
  if (!currentPoi) initPoi();
  return currentPoi;
}

function newRandomPoi() {
  currentPoi = getRandomPoi(currentPoi?.name);
  return currentPoi;
}

function getCooldownRemaining(userId) {
  const expires = userCooldowns.get(userId);
  if (!expires) return 0;
  const remaining = expires - Date.now();
  if (remaining <= 0) {
    userCooldowns.delete(userId); // prune expired entry on read
    return 0;
  }
  return remaining;
}

function setCooldown(userId) {
  // Prune all expired cooldowns before adding a new one to prevent unbounded growth.
  const now = Date.now();
  for (const [id, expires] of userCooldowns) {
    if (expires <= now) userCooldowns.delete(id);
  }
  userCooldowns.set(userId, now + COOLDOWN_MS);
}

function formatMs(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours   = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];
  if (hours)   parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds) parts.push(`${seconds}s`);
  return parts.join(' ');
}

// ─── Item Game Helpers ────────────────────────────────────────────────────────

function getItemCooldownRemaining(guildId, userId) {
  const cooldowns = getItemCooldownMap(guildId);
  const expires = cooldowns.get(userId);
  if (!expires) return 0;
  const remaining = expires - Date.now();
  if (remaining <= 0) {
    cooldowns.delete(userId);
    return 0;
  }
  return remaining;
}

function setItemCooldown(guildId, userId) {
  const cooldowns = getItemCooldownMap(guildId);
  const now = Date.now();
  for (const [id, expires] of cooldowns) {
    if (expires <= now) cooldowns.delete(id);
  }
  cooldowns.set(userId, now + ITEM_GUESS_COOLDOWN_MS);
}

/** Returns today's date as a YYYY-MM-DD string (UTC). */
function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Build the hints block shown to users.
 * Accepts the guild-specific item game state object.
 * Returns an empty string when there are no hints yet.
 * Hints are shuffled via Fisher-Yates on every call so the order is
 * randomised each time they are displayed, making the game harder to
 * solve by memorising hint positions.
 */
function buildHintsText(game) {
  if (!game.hints.length) return '';
  // Shallow-copy so the stored order is never mutated.
  const shuffled = [...game.hints];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled
    .map((h, i) => `**Hint ${i + 1}:** ${h}`)
    .join('\n');
}

// ─── Wheel graphic helpers ────────────────────────────────────────────────────

// Outer-ring segments used to build the visual wheel.  Each position in the
// ring is one "slot"; the pointer (▼) always sits above index 0.
const WHEEL_SEGMENTS = ['🎡', '🎰', '🎲', '🎯', '⚡', '💫', '🌀', '🔄'];

/**
 * Build a text-art spinning wheel embed.
 *
 * The wheel is rendered as a fixed-width ring of emoji segments with a ▼
 * pointer above the top slot.  The currently "selected" POI name is shown
 * prominently in the description, and the POI image is set as the thumbnail
 * so players can see the location while the wheel spins.
 *
 * @param {{name:string,image:string}} selectedPoi  POI currently at the top.
 * @param {Array<{name:string,image:string}>} pois  Full POI list (for ring labels).
 * @param {boolean} isSpinning  true → spinning state; false → landed state.
 * @param {number}  rotationOffset  How many positions the ring has rotated.
 * @returns {EmbedBuilder}
 */
function generateWheelEmbed(selectedPoi, pois, isSpinning, rotationOffset = 0) {
  // ── Build the visual ring ────────────────────────────────────────────────
  // We show WHEEL_SEGMENTS.length slots around the ring.  The segment at
  // position 0 (top-centre) is always the "selected" one.
  const ringSize   = WHEEL_SEGMENTS.length;
  const ringEmojis = [];
  for (let i = 0; i < ringSize; i++) {
    // Rotate the segment array so a different emoji sits at the top each frame.
    ringEmojis.push(WHEEL_SEGMENTS[(i + rotationOffset) % ringSize]);
  }

  // Split the ring into top-row (3 slots), sides (1 slot each), bottom-row (3 slots).
  // Layout (indices):
  //   top:    [7] [0] [1]
  //   sides:  [6]     [2]
  //   bottom: [5] [4] [3]
  const top    = `${ringEmojis[7]}  ${ringEmojis[0]}  ${ringEmojis[1]}`;
  const mid    = `${ringEmojis[6]}        ${ringEmojis[2]}`;
  const bot    = `${ringEmojis[5]}  ${ringEmojis[4]}  ${ringEmojis[3]}`;

  // Pointer sits above the top-centre slot.
  const pointer = isSpinning ? '　　　　▼' : '　　　　🎯';

  // ── Status line ──────────────────────────────────────────────────────────
  const statusLine = isSpinning
    ? `🌀  **Spinning…**  🌀`
    : `🎯  **LANDED ON:**  🎯`;

  // ── POI name display ─────────────────────────────────────────────────────
  // Pad the name to a fixed width so the embed width stays stable across frames.
  const poiDisplay = isSpinning
    ? `\`${selectedPoi.name.padEnd(22)}\``
    : `✨ **${selectedPoi.name}** ✨`;

  // ── Assemble description ─────────────────────────────────────────────────
  const description = [
    pointer,
    '```',
    `┌─────────────────┐`,
    `│  ${top}  │`,
    `│  ${mid}  │`,
    `│  ${bot}  │`,
    `└─────────────────┘`,
    '```',
    statusLine,
    poiDisplay,
  ].join('\n');

  // ── Embed colour: blue while spinning, gold when landed ──────────────────
  const color = isSpinning ? 0x5865F2 : 0xFEE75C;

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(isSpinning ? '🎡 Spinning the Wheel…' : '🎯 The Wheel Has Landed!')
    .setDescription(description)
    .setThumbnail(selectedPoi.image)
    .setFooter({ text: selectedPoi.name })
    .setTimestamp();
}

// ─── Spin-wheel animation ─────────────────────────────────────────────────────
// Renders a live visual lottery wheel that rotates through POI names with a
// slot-machine style deceleration, then resolves once the final frame has been
// shown.  Each frame edits the deferred reply in-place so the wheel appears to
// spin inside a single Discord message.
//
// Schedule (total ≈ 2-3 s, 200 frames — ultra-smooth continuous motion):
//   Frames 1-80   → 10 ms apart, +2.0 rotation  (ultra-fast, super smooth)
//   Frames 81-140 → 15 ms apart, +1.5 rotation  (blazing, smooth deceleration)
//   Frames 141-180 → 20 ms apart, +0.8 rotation (slowing smoothly)
//   Frames 181-200 → 30 ms apart, +0.3 rotation (final dramatic slow)
//
// The final editReply (the actual result) is NOT done here — the caller is
// responsible for that so it can attach the correct colour, description, etc.
//
// @param {import('discord.js').ChatInputCommandInteraction} interaction
//   Must already be deferred (deferReply called) before this is invoked.
// @param {Array<{name:string,image:string}>} pois  Full POI list to sample from.
// @param {{name:string,image:string}} finalPoi     The POI to land on last.
async function spinWheelAnimation(interaction, pois, finalPoi) {
  // Build the delay + rotation-increment schedule for all 200 frames.
  // Each entry is [delayMs, rotationIncrement].
  const schedule = [
    ...Array.from({ length: 80  }, () => [10, 2.0]),  // frames 1-80   (ultra-fast)
    ...Array.from({ length: 60  }, () => [15, 1.5]),  // frames 81-140 (blazing)
    ...Array.from({ length: 40  }, () => [20, 0.8]),  // frames 141-180 (smooth slow)
    ...Array.from({ length: 20  }, () => [30, 0.3]),  // frames 181-200 (final crawl)
  ];

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Pick a random POI that is different from the one shown in the previous frame
  // to avoid the same location appearing twice in a row.
  function pickRandom(excludeName) {
    const pool = pois.filter((p) => p.name !== excludeName);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Initial message: show the wheel already spinning before the first frame.
  try {
    await interaction.editReply({
      embeds: [generateWheelEmbed(pickRandom(null), pois, true, 0)],
    });
  } catch (err) {
    logError('spinWheelAnimation: initial editReply', err);
    return;
  }

  let lastShown  = null;
  let rotation   = 0; // tracks how far the ring has visually rotated (fractional)

  for (let i = 0; i < schedule.length; i++) {
    const [delayMs, rotInc] = schedule[i];
    await sleep(delayMs);

    const isLastFrame = i === schedule.length - 1;
    const framePoi    = isLastFrame ? finalPoi : pickRandom(lastShown?.name);
    lastShown         = framePoi;

    // Advance the ring rotation by the per-phase increment, wrapping around
    // the segment count so the ring spins continuously without overflow.
    rotation = (rotation + rotInc) % WHEEL_SEGMENTS.length;

    try {
      await interaction.editReply({
        embeds: [generateWheelEmbed(framePoi, pois, !isLastFrame, Math.floor(rotation))],
      });
    } catch (err) {
      // If the interaction token expired or the edit failed, abort gracefully
      // rather than spamming errors for every remaining frame.
      logError('spinWheelAnimation: editReply', err);
      return;
    }
  }
}

// ─── Commands ─────────────────────────────────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName('guess')
    .setDescription('Guess which Fortnite POI foxyboy3 is hiding at!')
    .addStringOption(o => o.setName('poi').setDescription('Your POI guess').setRequired(true)),

  new SlashCommandBuilder()
    .setName('currentpoi')
    .setDescription('See the current hiding game status'),

  new SlashCommandBuilder()
    .setName('skipcooldown')
    .setDescription("Skip a player's cooldown (Admin only)")
    .addUserOption(o => o.setName('player').setDescription('The player whose cooldown to skip').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // ── Item guessing game ────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName('guessitem')
    .setDescription('Guess the hidden item/character!')
    .setDMPermission(true)
    .addStringOption(o =>
      o.setName('guess')
        .setDescription('Your guess for the item or character name')
        .setRequired(false)
    )
    .addStringOption(o =>
      o.setName('server')
        .setDescription('Server name or ID to guess in (DM use only)')
        .setRequired(false)
        .setAutocomplete(true)
    ),

  new SlashCommandBuilder()
    .setName('setitem')
    .setDescription('Set the item/character to be guessed (Admin only)')
    .setDMPermission(true)
    .addStringOption(o =>
      o.setName('name')
        .setDescription('The item or character name players must guess')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('server')
        .setDescription('Server name or ID to set the item in (DM use only)')
        .setRequired(false)
        .setAutocomplete(true)
    ),

  new SlashCommandBuilder()
    .setName('additemhint')
    .setDescription('Add a hint for the current item game (Admin only)')
    .setDMPermission(true)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o =>
      o.setName('hint')
        .setDescription('The hint text to add')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('server')
        .setDescription('Server name or ID to add the hint in (DM use only)')
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption(o =>
      o.setName('channel')
        .setDescription('Channel to post the hint in (defaults to topmost sendable channel)')
        .setRequired(false)
        .setAutocomplete(true)
    ),
];

// ─── Handler ──────────────────────────────────────────────────────────────────
async function handleGame(interaction, updateBalance, client, onWin = null, targetGuild = null) {
  const { commandName, user } = interaction;

  // Read OWNER_ID once at the top of every invocation.
  const OWNER_ID = process.env.OWNER_ID;

  try {

    // /currentpoi ──────────────────────────────────────────────────────────────
    if (commandName === 'currentpoi') {
      return await safeReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🎮 Where is foxyboy3?')
            .setDescription(`**foxyboy3** is hiding somewhere on the Fortnite map!\n\nUse \`/guess <poi>\` to find them and win **🪙 1 coin**!\n\n*There are **${FORTNITE_POIS.length}** possible POIs across all chapters.*`)
            .setFooter({ text: 'Wrong guesses give you a 1hr 30min cooldown!' })
            .setTimestamp()
        ]
      });
    }

    // /guess ───────────────────────────────────────────────────────────────────
    if (commandName === 'guess') {
      const poi = getCurrentPoi();

      const isOwner = false; // Everyone gets cooldown
      const remaining = getCooldownRemaining(user.id);
      if (remaining > 0) {
        return await safeReply(interaction, {
          content: `⏳ You guessed recently! You can guess again in **${formatMs(remaining)}**.`,
          ephemeral: true,
        });
      }

      // Validate and sanitize the guess input.
      const rawGuess = interaction.options.getString('poi');
      if (!rawGuess) {
        return await safeReply(interaction, { content: '❌ Please provide a POI name to guess.', ephemeral: true });
      }
      const guess = rawGuess.trim().slice(0, 100);
      if (!guess) {
        return await safeReply(interaction, { content: '❌ Your guess cannot be empty.', ephemeral: true });
      }

      // Validate that the guess is a real POI name
      const validPois = FORTNITE_POIS.map(p => p.name.toLowerCase());
      if (!validPois.includes(guess.toLowerCase())) {
        return await safeReply(interaction, { content: `❌ **${guess}** is not a valid POI name. Please guess a real Fortnite location.`, ephemeral: true });
      }

      // Defer the reply so we can edit it multiple times during the animation.
      // All subsequent responses must use editReply / followUp.
      await interaction.deferReply();

      if (guess.toLowerCase() === poi.name.toLowerCase()) {
        // ✅ Correct! — run the wheel animation landing on the winning POI.
        updateBalance(user.id, 1);
        setCooldown(user.id);
        const newPoi = newRandomPoi();

        // Notify any tracked leaderboard messages immediately so the new win
        // shows up without waiting for the next 30-second background tick.
        if (onWin) onWin();

        // Alert owner + secondary user: someone found them — new hiding spot revealed.
        await alertBothUsers(
          client,
          '🎯 Someone Found Sam!',
          `**${user.username}** (<@${user.id}>) found Sam at **${poi.name}**!\nNew hiding spot: **${newPoi.name}**`,
          0x57F287,
        );

        // Final reveal: correct guess result.
        return await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x57F287)
              .setTitle('🎉 Correct!')
              .setThumbnail(poi.image)
              .setDescription(
                `🪙 1 coin **${user.username}** found Sam in **${poi.name}**\n\nDM <@1249146669061115904> (Sam), <@1253458483240763434> (Foxyboy3), or <@1347396372688797811> (Emily) to claim your coins!`
              )
              .setFooter({ text: poi.name })
              .setTimestamp()
          ],
        });

      } else {
        // ❌ Wrong guess — run the wheel animation landing on the real POI,
        //    then reveal it with the wrong-guess message.
        const revealedPoi = poi;
        setCooldown(user.id);
        newRandomPoi();

        // Alert owner + secondary user: someone guessed wrong.
        await alertBothUsers(
          client,
          '❌ Wrong Guess!',
          `**${user.username}** (<@${user.id}>) guessed **${guess}** but Sam was at **${revealedPoi.name}**.\nNew hiding spot: **${currentPoi.name}**`,
          0xED4245,
        );

        // Final reveal: wrong guess result.
        return await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xED4245)
              .setTitle('❌ Wrong Guess!')
              .setThumbnail(revealedPoi.image)
              .setDescription(`**Sam** was hiding at **${revealedPoi.name}**`)
              .setFooter({ text: revealedPoi.name })
              .setTimestamp()
          ],
        });
      }
    }

    // /skipcooldown ────────────────────────────────────────────────────────────
    if (commandName === 'skipcooldown') {
      const isOwner = OWNER_ID ? user.id === OWNER_ID : false;
      const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

      if (!isOwner && !isAdmin) {
        return await safeReply(interaction, {
          content: '❌ You do not have permission to use this command.',
          ephemeral: true,
        });
      }

      const target = interaction.options.getUser('player');

      if (!userCooldowns.has(target.id)) {
        return await safeReply(interaction, {
          content: `ℹ️ **${target.username}** does not have an active cooldown.`,
          ephemeral: true,
        });
      }

      userCooldowns.delete(target.id);
      return await safeReply(interaction, {
        content: `✅ **${target.username}**'s cooldown has been removed — they can guess again!`,
      });
    }

    // /setitem ─────────────────────────────────────────────────────────────────
    if (commandName === 'setitem') {
      const isOwner = OWNER_ID ? user.id === OWNER_ID : false;
      const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

      if (!isOwner && !isAdmin) {
        return await safeReply(interaction, {
          content: '❌ You do not have permission to use this command.',
          ephemeral: true,
        });
      }

      if (!targetGuild) {
        return await safeReply(interaction, {
          content: '❌ You must specify a **server** when using this command from DMs.\nExample: `/setitem name:Item Name server:My Server Name`',
          ephemeral: true,
        });
      }

      const rawName = interaction.options.getString('name');
      if (!rawName) {
        return await safeReply(interaction, { content: '❌ Please provide an item name.', ephemeral: true });
      }
      const itemName = rawName.trim().slice(0, 200);
      if (!itemName) {
        return await safeReply(interaction, { content: '❌ Item name cannot be empty.', ephemeral: true });
      }

      // Reset the item game state for the new item (scoped to this guild).
      const game = getItemGame(targetGuild.id);
      game.item            = { name: itemName };
      game.hints           = [];
      game.hintDay         = null;
      game.lastHintSentDay = null;
      game.guesses         = [];
      getItemCooldownMap(targetGuild.id).clear();

      return await safeReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🎯 Item Game Started')
            .setDescription(`The hidden item has been set to **${itemName}**.\nAll previous hints and guesses have been cleared.`)
            .addFields({ name: 'Server', value: targetGuild.name, inline: true })
            .setFooter({ text: `Set by ${user.username}` })
            .setTimestamp()
        ],
        ephemeral: true,
      });
    }

    // /additemhint ─────────────────────────────────────────────────────────────
    if (commandName === 'additemhint') {
      const isOwner = OWNER_ID ? user.id === OWNER_ID : false;
      const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

      if (!isOwner && !isAdmin) {
        return await safeReply(interaction, {
          content: '❌ You do not have permission to use this command.',
          ephemeral: true,
        });
      }

      if (!targetGuild) {
        return await safeReply(interaction, {
          content: '❌ You must specify a **server** when using this command from DMs.\nExample: `/additemhint hint:Your hint here server:My Server Name`',
          ephemeral: true,
        });
      }

      const game = getItemGame(targetGuild.id);

      if (!game.item) {
        return await safeReply(interaction, {
          content: '❌ No item game is active. Use `/setitem` first.',
          ephemeral: true,
        });
      }

      const rawHint = interaction.options.getString('hint');
      if (!rawHint) {
        return await safeReply(interaction, { content: '❌ Please provide a hint.', ephemeral: true });
      }
      const hintText = rawHint.trim().slice(0, 500);
      if (!hintText) {
        return await safeReply(interaction, { content: '❌ Hint cannot be empty.', ephemeral: true });
      }

      game.hints.push(hintText);
      const hintNumber = game.hints.length;

      const hintEmbed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle(`💡 Hint ${hintNumber} Added`)
        .setDescription(`**Hint ${hintNumber}:** ${hintText}`)
        .addFields({ name: 'Server', value: targetGuild.name, inline: true })
        .setFooter({ text: `Added by ${user.username}` })
        .setTimestamp();

      // Post the hint to the specified channel, or fall back to the topmost
      // sendable text channel in the target guild so all players can see it.
      const channelArg = (interaction.options.getString('channel') ?? '').trim();

      // Resolve the target channel: by explicit ID first, then fall back to topmost.
      let sendableChannel = null;
      if (channelArg) {
        // channelArg may be a raw ID or the "Name (id)" format from autocomplete.
        const channelIdMatch = channelArg.match(/(\d{17,20})\)?$/);
        const resolvedId = channelIdMatch ? channelIdMatch[1] : channelArg;
        const resolved = targetGuild.channels.cache.get(resolvedId);
        if (resolved && resolved.isTextBased() && !resolved.isThread() &&
            resolved.permissionsFor(targetGuild.members.me)?.has('SendMessages')) {
          sendableChannel = resolved;
        }
      }

      if (!sendableChannel) {
        sendableChannel = targetGuild.channels.cache
          .filter(c =>
            c.isTextBased() &&
            !c.isThread() &&
            c.permissionsFor(targetGuild.members.me)?.has('SendMessages')
          )
          .sort((a, b) => a.rawPosition - b.rawPosition)
          .first();
      }

      let serverPostWarning = '';
      if (sendableChannel) {
        try {
          await sendableChannel.send({ embeds: [hintEmbed] });
        } catch (err) {
          logError(`additemhint: send to guild ${targetGuild.id} channel ${sendableChannel.id}`, err);
          serverPostWarning = '\n⚠️ Could not post to the server channel — check bot permissions.';
        }
      } else {
        serverPostWarning = '\n⚠️ No sendable text channel found in the server — hint was not posted publicly.';
      }

      return await safeReply(interaction, {
        embeds: [hintEmbed],
        content: serverPostWarning || undefined,
        ephemeral: true,
      });
    }

    // /guessitem ───────────────────────────────────────────────────────────────
    if (commandName === 'guessitem') {
      // targetGuild must be resolved before reaching here (by bot.js).
      if (!targetGuild) {
        return await safeReply(interaction, {
          content: '❌ You must specify a **server** when using this command from DMs.\nExample: `/guessitem server:My Server Name`',
          ephemeral: true,
        });
      }

      const game = getItemGame(targetGuild.id);

      // If no game is active, tell the user.
      if (!game.item) {
        return await safeReply(interaction, {
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865F2)
              .setTitle('🎮 Item Guessing Game')
              .setDescription('There is no active item game right now. Check back later!')
              .setTimestamp()
          ],
          ephemeral: true,
        });
      }

      const rawGuess = interaction.options.getString('guess');

      // No guess provided — show current hints only.
      if (!rawGuess || !rawGuess.trim()) {
        const hintsText = buildHintsText(game);
        return await safeReply(interaction, {
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865F2)
              .setTitle('🎮 Item Guessing Game')
              .setDescription(
                `Can you guess the hidden item or character?\n\n` +
                (hintsText
                  ? `**Hints so far:**\n${hintsText}`
                  : '*No hints have been revealed yet. Check back tomorrow!*') +
                `\n\nUse \`/guessitem guess:<your answer>\` to make a guess.`
              )
              .setFooter({ text: 'Wrong guesses give you a 30-second cooldown!' })
              .setTimestamp()
          ],
          ephemeral: true,
        });
      }

      // Admin restriction: only the bot owner may submit guesses.
      const isOwner = OWNER_ID ? user.id === OWNER_ID : false;
      const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
      if (isAdmin && !isOwner) {
        return await safeReply(interaction, {
          content: '🚫 Admins are not allowed to play the guessing game. Only the bot owner can guess.',
          ephemeral: true,
        });
      }

      // Cooldown check.
      const remaining = getItemCooldownRemaining(targetGuild.id, user.id);
      if (!isOwner && remaining > 0) {
        return await safeReply(interaction, {
          content: `⏳ You guessed recently! You can guess again in **${formatMs(remaining)}**.`,
          ephemeral: true,
        });
      }

      const guess = rawGuess.trim().slice(0, 200);

      // Log the guess.
      game.guesses.push({
        userId:    user.id,
        username:  user.username,
        guess,
        timestamp: Date.now(),
      });

      if (guess.toLowerCase() === game.item.name.toLowerCase()) {
        // ✅ Correct guess!
        const foundItem = game.item.name;

        // Clear the game state so a new item can be set (scoped to this guild).
        game.item            = null;
        game.hints           = [];
        game.hintDay         = null;
        game.lastHintSentDay = null;
        game.guesses         = [];
        getItemCooldownMap(targetGuild.id).clear();

        // Alert owner + secondary user.
        await alertBothUsers(
          client,
          '🎯 Someone Found the Item!',
          `**${user.username}** (<@${user.id}>) found the item: **${foundItem}**! (server: **${targetGuild.name}**)`,
          0x57F287,
        );

        return await safeReply(interaction, {
          embeds: [
            new EmbedBuilder()
              .setColor(0x57F287)
              .setDescription(
                `🪙 1 coin **${user.username}** found the item\n\n` +
                (OWNER_ID ? `DM <@${OWNER_ID}> to claim your win!` : 'Contact the owner to claim your win!')
              )
              .setTimestamp()
          ],
        });

      } else {
        // ❌ Wrong guess — apply cooldown and show a hint.
        if (!isOwner) setItemCooldown(targetGuild.id, user.id);

        // Reveal one new hint per calendar day (UTC).
        const today = todayUTC();
        if (game.hints.length > 0 && game.hintDay !== today) {
          game.hintDay = today;
        }

        const hintsText = buildHintsText(game);

        console.log(`[guessitem] Wrong guess by ${user.username} (${user.id}) in ${targetGuild.name}: "${guess}"`);

        return await safeReply(interaction, {
          embeds: [
            new EmbedBuilder()
              .setColor(0xED4245)
              .setTitle('❌ Wrong Guess!')
              .setDescription(
                `That's not the right item. Try again!\n\n` +
                (hintsText
                  ? `**Hints so far:**\n${hintsText}`
                  : '*No hints available yet.*')
              )
              .setFooter({ text: 'You have a 30-second cooldown before guessing again.' })
              .setTimestamp()
          ],
          ephemeral: true,
        });
      }
    }

  } catch (err) {
    logError(`handleGame [${commandName}]`, err);
    await safeReply(interaction, {
      content: '❌ An unexpected error occurred in the game. Please try again.',
      ephemeral: true,
    });
  }
}

// ─── Cooldown expiry notifier ─────────────────────────────────────────────────
// Called periodically from bot.js. Iterates every active cooldown and, for any
// that have now expired, sends the user a DM and removes the entry from the map.
async function checkCooldowns(client) {
  const now = Date.now();
  for (const [userId, expires] of userCooldowns) {
    if (now < expires) continue; // still active — skip

    // Remove first so a DM failure doesn't leave a stale entry.
    userCooldowns.delete(userId);

    try {
      const user = await client.users.fetch(userId);
      await user.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('⏰ Your MadGuessr cooldown has now expired')
            .setDescription(
              "Your cooldown has expired! Go back and use `/guess` to try and find Sam 🎯"
            )
            .setTimestamp()
        ]
      });
    } catch (err) {
      logError(`checkCooldowns: DM user ${userId}`, err);
    }

    // Alert owner + secondary user that this player's cooldown has expired.
    await alertBothUsers(
      client,
      '⏰ Cooldown Expired',
      `The cooldown for <@${userId}> has expired — they can guess again now.`,
      0xFEE75C,
    );
  }
}

// ─── Daily Hint Scheduler ─────────────────────────────────────────────────────
// Called once per day (at midnight UTC) from bot.js. Iterates every active item
// game across all guilds and, for each one that has hints available and hasn't
// already sent a hint today, reveals the next hint in the server's first
// available text channel and marks `lastHintSentDay` so it won't fire again
// until the following UTC day.
async function sendDailyHints(client) {
  const today = todayUTC();

  for (const [guildId, game] of itemGames) {
    // Skip guilds with no active game or no hints loaded.
    if (!game.item || game.hints.length === 0) continue;

    // Skip if a hint was already auto-sent today.
    if (game.lastHintSentDay === today) continue;

    // Determine which hint to send next. The next hint index is the number of
    // hints that have already been sent (0-based), capped at the last hint.
    // We use `lastHintSentDay` transitions to count: each day we advance by one.
    // For simplicity, count how many daily sends have occurred by tracking the
    // index on the game state itself.
    if (game.dailyHintIndex === undefined) game.dailyHintIndex = 0;

    const hintIndex = Math.min(game.dailyHintIndex, game.hints.length - 1);
    const hintText  = game.hints[hintIndex];
    const hintNum   = hintIndex + 1;

    // Resolve the guild from the client cache.
    let guild;
    try {
      guild = await client.guilds.fetch(guildId);
    } catch (err) {
      logError(`sendDailyHints: fetch guild ${guildId}`, err);
      continue;
    }

    // Find the first text channel the bot can send messages in, ordered by
    // position so we land in the topmost visible channel (usually #general).
    await guild.channels.fetch().catch(() => null); // populate cache
    const channel = guild.channels.cache
      .filter(c =>
        c.isTextBased() &&
        !c.isThread() &&
        c.permissionsFor(guild.members.me)?.has('SendMessages')
      )
      .sort((a, b) => a.rawPosition - b.rawPosition)
      .first();

    if (!channel) {
      logError(`sendDailyHints: no sendable channel in guild ${guildId} (${guild.name})`, 'no channel found');
      continue;
    }

    try {
      const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle(`💡 Daily Hint — Hint ${hintNum} of ${game.hints.length}`)
        .setDescription(`**💡 Daily Hint:** ${hintText}`)
        .setFooter({ text: 'Use /guessitem to make a guess!' })
        .setTimestamp();

      await channel.send({ embeds: [embed] });

      // Mark the hint as sent for today and advance the index for tomorrow.
      game.lastHintSentDay = today;
      game.dailyHintIndex  = hintIndex + 1;

      console.log(`[sendDailyHints] Sent hint ${hintNum} to guild ${guildId} (${guild.name}) in channel ${channel.id}.`);
    } catch (err) {
      logError(`sendDailyHints: send to guild ${guildId} (${guild.name})`, err);
    }
  }
}

module.exports = { commands, handleGame, getCurrentPoi, initPoi, userCooldowns, checkCooldowns, sendDailyHints };
