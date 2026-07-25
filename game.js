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
            .setDescription(`**foxyboy3** is hiding somewhere on the Fortnite map!\n\nUse \`/guess <poi>\` to find them and win **🪙 1 point**!\n\n*There are **${FORTNITE_POIS.length}** possible POIs across all chapters.*`)
            .setFooter({ text: 'Wrong guesses give you a 1hr 30min cooldown!' })
            .setTimestamp()
        ]
      });
    }

    // /guess ───────────────────────────────────────────────────────────────────
    if (commandName === 'guess') {
      const poi = getCurrentPoi();
      // Check if command is being used in the correct channel
      const GUESS_CHANNEL_ID = '1529364927415062618';
      if (interaction.channelId !== GUESS_CHANNEL_ID) {
        return await safeReply(interaction, {
          content: `❌ You can only use /guess in <#${GUESS_CHANNEL_ID}>`,
          ephemeral: true,
        });
      }

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
          '🎯 Someone Found Madmotherflupa!',
          `**${user.username}** (<@${user.id}>) found Madmotherflupa at **${poi.name}**!\nNew hiding spot: **${newPoi.name}**`,
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
                `🪙 1 point **${user.username}** found Madmotherflupa in **${poi.name}**\n\nDM <@1249146669061115904> (Sam), <@1253458483240763434> (Foxyboy3), or <@1347396372688797811> (Emily) to claim your points!`
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
          `**${user.username}** (<@${user.id}>) guessed **${guess}** but Madmotherflupa was at **${revealedPoi.name}**.\nNew hiding spot: **${currentPoi.name}**`,
          0xED4245,
        );

        // Final reveal: wrong guess result.
        return await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xED4245)
              .setTitle('❌ Wrong Guess!')
              .setThumbnail(revealedPoi.image)
              .setDescription(`**Madmotherflupa** was hiding at **${revealedPoi.name}**`)
              .setFooter({ text: revealedPoi.name })
              .setTimestamp()
          ],
        });
      }
    }

  } catch (err) {
    logError(`handleGame/${commandName}`, err);
    return await safeReply(interaction, { content: '❌ An error occurred. Please try again.', ephemeral: true });
  }
}

module.exports = { handleGame };

