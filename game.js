const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// ─── Fortnite POIs ────────────────────────────────────────────────────────────
const FORTNITE_POIS = [
  // Chapter 1
  'Tilted Towers', 'Dusty Depot', 'Dusty Divot', 'Loot Lake', 'Pleasant Park',
  'Retail Row', 'Salty Springs', 'Fatal Fields', 'Haunted Hills', 'Snobby Shores',
  'Tomato Town', 'Tomato Temple', 'Greasy Grove', 'Flush Factory', 'Wailing Woods',
  'Anarchy Acres', 'Junk Junction', 'Lonely Lodge', 'Lucky Landing', 'Lazy Links',
  'Paradise Palms', 'Risky Reels', 'Leaky Lake', 'Sunny Steps', 'Frosty Flights',
  'Polar Peak', 'Happy Hamlet', 'Shifty Shafts', 'Moisty Mire',
  // Chapter 2
  'Sweaty Sands', 'Dirty Docks', 'Misty Meadows', 'Lazy Lake', 'Coral Castle',
  'Catty Corner', 'Craggy Cliffs', 'Frenzy Farm', 'Holly Hedges', 'Weeping Woods',
  'Slurpy Swamp', 'Steamy Stacks', 'The Authority', 'The Agency', 'The Yacht',
  'The Rig', 'The Shark', 'Salty Towers', 'Colossal Crops', 'Boney Burbs',
  'Believer Beach', 'Corny Crops', 'Coney Crossroads', 'Rocky Reels', 'Sanctuary',
  'The Daily Bugle', 'Camp Cuddle', 'Rave Cave', 'Logjam Lumberyard',
  'Chrome Crossroads', "Herald's Sanctum",
  // Chapter 3
  'The Joneses', 'Sleepy Sound', 'Condo Canyon', "Chonker's Speedway",
  'Anvil Square', 'Shuffled Shrines', 'Lustrous Lagoon', 'Cloudy Condos',
  'Reality Falls',
  // Chapter 4
  'Shattered Slabs', 'Breakwater Bay', 'Mega City', 'Steamy Springs', 'Knotty Nets',
  'Brutal Bastion', 'Frenzy Fields', 'Slappy Shores', 'Lonely Labs',
  'Eclipsed Estate', 'Relentless Retreat', 'Faulty Splits',
  // Chapter 5
  'Reckless Railways', 'Grand Glacier', 'Lavish Lair', 'Restored Reels',
  'Snooty Steppes', 'Classy Courts', 'Ritzy Riviera', 'Mount Olympus',
  "Brawler's Battleground", 'Grim Gate', 'Pleasant Piazza', "Rebel's Roost",
];

const COOLDOWN_MS = 90 * 60 * 1000; // 1 hour 30 minutes

// ─── Game State ───────────────────────────────────────────────────────────────
let currentPoi = null;
const userCooldowns = new Map();

function getRandomPoi(excludePoi = null) {
  const filtered = excludePoi ? FORTNITE_POIS.filter(p => p !== excludePoi) : FORTNITE_POIS;
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
  currentPoi = getRandomPoi(currentPoi);
  return currentPoi;
}

function getCooldownRemaining(userId) {
  const expires = userCooldowns.get(userId);
  if (!expires) return 0;
  const remaining = expires - Date.now();
  return remaining > 0 ? remaining : 0;
}

function setCooldown(userId) {
  userCooldowns.set(userId, Date.now() + COOLDOWN_MS);
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

// ─── Commands ─────────────────────────────────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName('guess')
    .setDescription('Guess which Fortnite POI Sam is hiding at!')
    .addStringOption(o => o.setName('poi').setDescription('Your POI guess').setRequired(true)),

  new SlashCommandBuilder()
    .setName('currentpoi')
    .setDescription('See the current hiding game status'),
];

// ─── Handler ──────────────────────────────────────────────────────────────────
async function handleGame(interaction, updateBalance, client) {
  const { commandName, user } = interaction;

  // /currentpoi
  if (commandName === 'currentpoi') {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('🎮 Where is Sam?')
          .setDescription(`**Sam** is hiding somewhere on the Fortnite map!\n\nUse \`/guess <poi>\` to find them and win **🪙 1 coin**!\n\n*There are **${FORTNITE_POIS.length}** possible POIs across all chapters.*`)
          .setFooter({ text: 'Wrong guesses give you a 1hr 30min cooldown!' })
          .setTimestamp()
      ]
    });
  }

  // /guess
  if (commandName === 'guess') {
    const poi = getCurrentPoi();

    const remaining = getCooldownRemaining(user.id);
    if (remaining > 0) {
      return interaction.reply({
        content: `⏳ You guessed wrong recently! You can guess again in **${formatMs(remaining)}**.`,
        ephemeral: true,
      });
    }

    const guess = interaction.options.getString('poi').trim();

    if (guess.toLowerCase() === poi.toLowerCase()) {
      // ✅ Correct!
      updateBalance(user.id, 1);
      const newPoi = newRandomPoi();

      // DM the owner with who found them and the new POI
      try {
        const OWNER_ID = process.env.OWNER_ID;
        if (OWNER_ID) {
          const owner = await client.users.fetch(OWNER_ID);
          await owner.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0xFEE75C)
                .setTitle('📍 Someone Found You!')
                .addFields(
                  { name: 'Found by', value: `${user.username} (<@${user.id}>)`, inline: true },
                  { name: 'They guessed', value: poi, inline: true },
                  { name: 'Your new hiding spot', value: `**${newPoi}**` },
                )
                .setTimestamp()
            ]
          });
        }
      } catch (err) {
        console.error('Could not DM owner:', err.message);
      }

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('🎉 Found Them!')
            .setDescription(`**${user.username}** found where **Sam** was hiding!\n\n📍 They were at **${poi}**!\n\n🪙 **${user.username}** has been awarded **1 coin**!\n\n*Sam has moved to a new location...*`)
            .setTimestamp()
        ]
      });
    } else {
      // ❌ Wrong
      setCooldown(user.id);
      const isValidPoi = FORTNITE_POIS.some(p => p.toLowerCase() === guess.toLowerCase());
      const hint = isValidPoi ? '' : '\n*(That POI might not exist — double check the name!)*';

      // DM the owner about the wrong guess
      try {
        const OWNER_ID = process.env.OWNER_ID;
        if (OWNER_ID) {
          const owner = await client.users.fetch(OWNER_ID);
          await owner.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Wrong Guess!')
                .addFields(
                  { name: 'Guessed by', value: `${user.username} (<@${user.id}>)`, inline: true },
                  { name: 'They guessed', value: guess, inline: true },
                  { name: 'Correct location', value: `**${poi}**` },
                )
                .setTimestamp()
            ]
          });
        }
      } catch (err) {
        console.error('Could not DM owner:', err.message);
      }

      return interaction.reply({
        content: `❌ Wrong! **Sam** is not at **${guess}**. You must wait **1 hour and 30 minutes** before guessing again!${hint}`,
        ephemeral: true,
      });
    }
  }
}

module.exports = { commands, handleGame, getCurrentPoi, initPoi };
