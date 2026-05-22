const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// ─── Fortnite POIs with GitHub-hosted SVG images ────────────────────────────
// All POI location images are stored in the /pois folder on GitHub
// Each image is a custom-generated SVG with the POI name and theme color
const POI_IMG_BASE = 'https://raw.githubusercontent.com/117580-droid/Shop-bot/main/pois/';

const POI_IMAGES = {
  // ── Chapter 1 ──────────────────────────────────────────────────────────────
  'Anarchy Acres':  `${POI_IMG_BASE}anarchy-acres.svg`,
  'Dusty Depot':    `${POI_IMG_BASE}dusty-depot.svg`,
  'Fatal Fields':   `${POI_IMG_BASE}fatal-fields.svg`,
  'Flush Factory':  `${POI_IMG_BASE}flush-factory.svg`,
  'Greasy Grove':   `${POI_IMG_BASE}greasy-grove.svg`,
  'Haunted Hills':  `${POI_IMG_BASE}haunted-hills.svg`,
  'Junk Junction':  `${POI_IMG_BASE}junk-junction.svg`,
  'Lazy Links':     `${POI_IMG_BASE}lazy-links.svg`,
  'Lonely Lodge':   `${POI_IMG_BASE}lonely-lodge.svg`,
  'Loot Lake':      `${POI_IMG_BASE}loot-lake.svg`,
  'Lucky Landing':  `${POI_IMG_BASE}lucky-landing.svg`,
  'Moisty Mire':    `${POI_IMG_BASE}moisty-mire.svg`,
  'Pleasant Park':  `${POI_IMG_BASE}pleasant-park.svg`,
  'Retail Row':     `${POI_IMG_BASE}retail-row.svg`,
  'Risky Reels':    `${POI_IMG_BASE}risky-reels.svg`,
  'Salty Springs':  `${POI_IMG_BASE}salty-springs.svg`,
  'Shifty Shafts':  `${POI_IMG_BASE}shifty-shafts.svg`,
  'Snobby Shores':  `${POI_IMG_BASE}snobby-shores.svg`,
  'Tilted Towers':  `${POI_IMG_BASE}tilted-towers.svg`,
  'Tomato Town':    `${POI_IMG_BASE}tomato-town.svg`,
  'Wailing Woods':  `${POI_IMG_BASE}wailing-woods.svg`,
  // ── Chapter 2 ──────────────────────────────────────────────────────────────
  'The Agency':     `${POI_IMG_BASE}the-agency.svg`,
  'Craggy Cliffs':  `${POI_IMG_BASE}craggy-cliffs.svg`,
  'Dirty Docks':    `${POI_IMG_BASE}dirty-docks.svg`,
  'Frenzy Farm':    `${POI_IMG_BASE}frenzy-farm.svg`,
  'Holly Hedges':   `${POI_IMG_BASE}holly-hedges.svg`,
  'Lazy Lake':      `${POI_IMG_BASE}lazy-lake.svg`,
  'Misty Meadows':  `${POI_IMG_BASE}misty-meadows.svg`,
  'Slurpy Swamp':   `${POI_IMG_BASE}slurpy-swamp.svg`,
  'Steamy Stacks':  `${POI_IMG_BASE}steamy-stacks.svg`,
  'Sweaty Sands':   `${POI_IMG_BASE}sweaty-sands.svg`,
  'The Fortilla':   `${POI_IMG_BASE}the-fortilla.svg`,
  'The Grotto':     `${POI_IMG_BASE}the-grotto.svg`,
  'The Shark':      `${POI_IMG_BASE}the-shark.svg`,
  'Weeping Woods':  `${POI_IMG_BASE}weeping-woods.svg`,
  // ── Chapter 3 ──────────────────────────────────────────────────────────────
  'Camp Cuddle':    `${POI_IMG_BASE}camp-cuddle.svg`,
  'Chonker\'s Speedway': `${POI_IMG_BASE}chonkers-speedway.svg`,
  'Condo Canyon':   `${POI_IMG_BASE}condo-canyon.svg`,
  'Coney Crossroads': `${POI_IMG_BASE}coney-crossroads.svg`,
  'Daily Bugle':    `${POI_IMG_BASE}daily-bugle.svg`,
  'Logjam Lumberyard': `${POI_IMG_BASE}logjam-lumberyard.svg`,
  'Rocky Reels':    `${POI_IMG_BASE}rocky-reels.svg`,
  'Sanctuary':      `${POI_IMG_BASE}sanctuary.svg`,
  'Sleepy Sound':   `${POI_IMG_BASE}sleepy-sound.svg`,
  'Synapse Station': `${POI_IMG_BASE}synapse-station.svg`,
  'The Joneses':    `${POI_IMG_BASE}the-joneses.svg`,
  // ── Chapter 4 ──────────────────────────────────────────────────────────────
  'Anvil Square':   `${POI_IMG_BASE}anvil-square.svg`,
  'Brutal Bastion': `${POI_IMG_BASE}brutal-bastion.svg`,
  'Breakwater Bay': `${POI_IMG_BASE}breakwater-bay.svg`,
  'Faulty Splits':  `${POI_IMG_BASE}faulty-splits.svg`,
  'Frenzy Fields':  `${POI_IMG_BASE}frenzy-fields.svg`,
  'Lonely Labs':    `${POI_IMG_BASE}lonely-labs.svg`,
  'Mega City':      `${POI_IMG_BASE}mega-city.svg`,
  'Shattered Slabs': `${POI_IMG_BASE}shattered-slabs.svg`,
  'Slappy Shores':  `${POI_IMG_BASE}slappy-shores.svg`,
  'Steamy Springs': `${POI_IMG_BASE}steamy-springs.svg`,
  // ── Chapter 5 ──────────────────────────────────────────────────────────────
  'Classy Courts':  `${POI_IMG_BASE}classy-courts.svg`,
  'Fencing Fields': `${POI_IMG_BASE}fencing-fields.svg`,
  'Grand Glacier':  `${POI_IMG_BASE}grand-glacier.svg`,
  'Hazy Hillside':  `${POI_IMG_BASE}hazy-hillside.svg`,
  'Lavish Lair':    `${POI_IMG_BASE}lavish-lair.svg`,
  'Pleasant Piazza': `${POI_IMG_BASE}pleasant-piazza.svg`,
  'Reckless Railways': `${POI_IMG_BASE}reckless-railways.svg`,
  'Ritzy Riviera':  `${POI_IMG_BASE}ritzy-riviera.svg`,
  'Ruined Reels':   `${POI_IMG_BASE}ruined-reels.svg`,
  'Snooty Steppes': `${POI_IMG_BASE}snooty-steppes.svg`,
};

const FORTNITE_POIS = [
  // Chapter 1
  { name: 'Anarchy Acres', image: POI_IMAGES['Anarchy Acres'] },
  { name: 'Dusty Depot', image: POI_IMAGES['Dusty Depot'] },
  { name: 'Fatal Fields', image: POI_IMAGES['Fatal Fields'] },
  { name: 'Flush Factory', image: POI_IMAGES['Flush Factory'] },
  { name: 'Greasy Grove', image: POI_IMAGES['Greasy Grove'] },
  { name: 'Haunted Hills', image: POI_IMAGES['Haunted Hills'] },
  { name: 'Junk Junction', image: POI_IMAGES['Junk Junction'] },
  { name: 'Lazy Links', image: POI_IMAGES['Lazy Links'] },
  { name: 'Lonely Lodge', image: POI_IMAGES['Lonely Lodge'] },
  { name: 'Loot Lake', image: POI_IMAGES['Loot Lake'] },
  { name: 'Lucky Landing', image: POI_IMAGES['Lucky Landing'] },
  { name: 'Moisty Mire', image: POI_IMAGES['Moisty Mire'] },
  { name: 'Pleasant Park', image: POI_IMAGES['Pleasant Park'] },
  { name: 'Retail Row', image: POI_IMAGES['Retail Row'] },
  { name: 'Risky Reels', image: POI_IMAGES['Risky Reels'] },
  { name: 'Salty Springs', image: POI_IMAGES['Salty Springs'] },
  { name: 'Shifty Shafts', image: POI_IMAGES['Shifty Shafts'] },
  { name: 'Snobby Shores', image: POI_IMAGES['Snobby Shores'] },
  { name: 'Tilted Towers', image: POI_IMAGES['Tilted Towers'] },
  { name: 'Tomato Town', image: POI_IMAGES['Tomato Town'] },
  { name: 'Wailing Woods', image: POI_IMAGES['Wailing Woods'] },
  // Chapter 2
  { name: 'The Agency', image: POI_IMAGES['The Agency'] },
  { name: 'Craggy Cliffs', image: POI_IMAGES['Craggy Cliffs'] },
  { name: 'Dirty Docks', image: POI_IMAGES['Dirty Docks'] },
  { name: 'Frenzy Farm', image: POI_IMAGES['Frenzy Farm'] },
  { name: 'Holly Hedges', image: POI_IMAGES['Holly Hedges'] },
  { name: 'Lazy Lake', image: POI_IMAGES['Lazy Lake'] },
  { name: 'Misty Meadows', image: POI_IMAGES['Misty Meadows'] },
  { name: 'Slurpy Swamp', image: POI_IMAGES['Slurpy Swamp'] },
  { name: 'Steamy Stacks', image: POI_IMAGES['Steamy Stacks'] },
  { name: 'Sweaty Sands', image: POI_IMAGES['Sweaty Sands'] },
  { name: 'The Fortilla', image: POI_IMAGES['The Fortilla'] },
  { name: 'The Grotto', image: POI_IMAGES['The Grotto'] },
  { name: 'The Shark', image: POI_IMAGES['The Shark'] },
  { name: 'Weeping Woods', image: POI_IMAGES['Weeping Woods'] },
  // Chapter 3
  { name: 'Camp Cuddle', image: POI_IMAGES['Camp Cuddle'] },
  { name: 'Chonker\'s Speedway', image: POI_IMAGES['Chonker\'s Speedway'] },
  { name: 'Condo Canyon', image: POI_IMAGES['Condo Canyon'] },
  { name: 'Coney Crossroads', image: POI_IMAGES['Coney Crossroads'] },
  { name: 'Daily Bugle', image: POI_IMAGES['Daily Bugle'] },
  { name: 'Logjam Lumberyard', image: POI_IMAGES['Logjam Lumberyard'] },
  { name: 'Rocky Reels', image: POI_IMAGES['Rocky Reels'] },
  { name: 'Sanctuary', image: POI_IMAGES['Sanctuary'] },
  { name: 'Sleepy Sound', image: POI_IMAGES['Sleepy Sound'] },
  { name: 'Synapse Station', image: POI_IMAGES['Synapse Station'] },
  { name: 'The Joneses', image: POI_IMAGES['The Joneses'] },
  // Chapter 4
  { name: 'Anvil Square', image: POI_IMAGES['Anvil Square'] },
  { name: 'Brutal Bastion', image: POI_IMAGES['Brutal Bastion'] },
  { name: 'Breakwater Bay', image: POI_IMAGES['Breakwater Bay'] },
  { name: 'Faulty Splits', image: POI_IMAGES['Faulty Splits'] },
  { name: 'Frenzy Fields', image: POI_IMAGES['Frenzy Fields'] },
  { name: 'Lonely Labs', image: POI_IMAGES['Lonely Labs'] },
  { name: 'Mega City', image: POI_IMAGES['Mega City'] },
  { name: 'Shattered Slabs', image: POI_IMAGES['Shattered Slabs'] },
  { name: 'Slappy Shores', image: POI_IMAGES['Slappy Shores'] },
  { name: 'Steamy Springs', image: POI_IMAGES['Steamy Springs'] },
  // Chapter 5
  { name: 'Classy Courts', image: POI_IMAGES['Classy Courts'] },
  { name: 'Fencing Fields', image: POI_IMAGES['Fencing Fields'] },
  { name: 'Grand Glacier', image: POI_IMAGES['Grand Glacier'] },
  { name: 'Hazy Hillside', image: POI_IMAGES['Hazy Hillside'] },
  { name: 'Lavish Lair', image: POI_IMAGES['Lavish Lair'] },
  { name: 'Pleasant Piazza', image: POI_IMAGES['Pleasant Piazza'] },
  { name: 'Reckless Railways', image: POI_IMAGES['Reckless Railways'] },
  { name: 'Ritzy Riviera', image: POI_IMAGES['Ritzy Riviera'] },
  { name: 'Ruined Reels', image: POI_IMAGES['Ruined Reels'] },
  { name: 'Snooty Steppes', image: POI_IMAGES['Snooty Steppes'] },
];

let currentPoi = FORTNITE_POIS[0];

function newRandomPoi() {
  currentPoi = FORTNITE_POIS[Math.floor(Math.random() * FORTNITE_POIS.length)];
  return currentPoi;
}

function getCurrentPoi() {
  return currentPoi;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('guess')
    .setDescription('Guess where Sam is hiding on the Fortnite map!')
    .addStringOption(option =>
      option
        .setName('location')
        .setDescription('The POI location where Sam is hiding')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const choices = FORTNITE_POIS.map(poi => poi.name);
    const filtered = choices.filter(choice =>
      choice.toLowerCase().startsWith(focusedValue.toLowerCase())
    );
    await interaction.respond(
      filtered.slice(0, 25).map(choice => ({ name: choice, value: choice }))
    );
  },

  async execute(interaction) {
    const guess = interaction.options.getString('location');
    const poi = getCurrentPoi();
    const userId = interaction.user.id;
    const protectedUserId = '1417947408691757226'; // Sam

    // Check if guess is correct
    const isCorrect = guess.toLowerCase() === poi.name.toLowerCase();

    if (isCorrect) {
      // Correct guess
      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setThumbnail(poi.image)
        .setDescription(`🪙 1 coin **${interaction.user.username}** found where **Sam** was hiding\n\nDM <@${protectedUserId}> to claim your win!`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } else {
      // Wrong guess
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setThumbnail(poi.image)
        .setDescription(`**Sam** was hiding at **${poi.name}**`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    // Set up next round
    newRandomPoi();
  },
};
