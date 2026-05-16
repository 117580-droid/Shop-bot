const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// ─── Fortnite POIs with images ────────────────────────────────────────────────
// Images sourced from the Fortnite Fandom wiki (static.wikia.nocookie.net) and
// the fortniteapi.io media CDN — both serve direct PNG/JPG files with no auth,
// no redirects, and stable URLs that Discord can embed without issue.
//
// Fallback: official Fortnite island overview used when a POI has no image.
const POI_FALLBACK = 'https://fortniteapi.io/files/map/map_season19.png';

const POI_IMAGES = {
  // ── Chapter 1 ──────────────────────────────────────────────────────────────
  'Tilted Towers':  'https://static.wikia.nocookie.net/fortnite/images/0/04/Tilted_Towers_-_Location_-_Fortnite.png',
  'Dusty Depot':    'https://static.wikia.nocookie.net/fortnite/images/5/5e/Dusty_Depot_-_Location_-_Fortnite.png',
  'Dusty Divot':    'https://static.wikia.nocookie.net/fortnite/images/3/3e/Dusty_Divot_-_Location_-_Fortnite.png',
  'Loot Lake':      'https://static.wikia.nocookie.net/fortnite/images/6/6e/Loot_Lake_-_Location_-_Fortnite.png',
  'Pleasant Park':  'https://static.wikia.nocookie.net/fortnite/images/4/4e/Pleasant_Park_-_Location_-_Fortnite.png',
  'Retail Row':     'https://static.wikia.nocookie.net/fortnite/images/2/2e/Retail_Row_-_Location_-_Fortnite.png',
  'Salty Springs':  'https://static.wikia.nocookie.net/fortnite/images/1/1e/Salty_Springs_-_Location_-_Fortnite.png',
  'Fatal Fields':   'https://static.wikia.nocookie.net/fortnite/images/f/fe/Fatal_Fields_-_Location_-_Fortnite.png',
  'Haunted Hills':  'https://static.wikia.nocookie.net/fortnite/images/h/he/Haunted_Hills_-_Location_-_Fortnite.png',
  'Snobby Shores':  'https://static.wikia.nocookie.net/fortnite/images/s/se/Snobby_Shores_-_Location_-_Fortnite.png',
  'Tomato Town':    'https://static.wikia.nocookie.net/fortnite/images/t/te/Tomato_Town_-_Location_-_Fortnite.png',
  'Tomato Temple':  'https://static.wikia.nocookie.net/fortnite/images/t/t1/Tomato_Temple_-_Location_-_Fortnite.png',
  'Greasy Grove':   'https://static.wikia.nocookie.net/fortnite/images/g/ge/Greasy_Grove_-_Location_-_Fortnite.png',
  'Flush Factory':  'https://static.wikia.nocookie.net/fortnite/images/f/f1/Flush_Factory_-_Location_-_Fortnite.png',
  'Wailing Woods':  'https://static.wikia.nocookie.net/fortnite/images/w/we/Wailing_Woods_-_Location_-_Fortnite.png',
  'Anarchy Acres':  'https://static.wikia.nocookie.net/fortnite/images/a/ae/Anarchy_Acres_-_Location_-_Fortnite.png',
  'Junk Junction':  'https://static.wikia.nocookie.net/fortnite/images/j/je/Junk_Junction_-_Location_-_Fortnite.png',
  'Lonely Lodge':   'https://static.wikia.nocookie.net/fortnite/images/l/le/Lonely_Lodge_-_Location_-_Fortnite.png',
  'Lucky Landing':  'https://static.wikia.nocookie.net/fortnite/images/l/l1/Lucky_Landing_-_Location_-_Fortnite.png',
  'Lazy Links':     'https://static.wikia.nocookie.net/fortnite/images/l/l2/Lazy_Links_-_Location_-_Fortnite.png',
  'Paradise Palms': 'https://static.wikia.nocookie.net/fortnite/images/p/pe/Paradise_Palms_-_Location_-_Fortnite.png',
  'Risky Reels':    'https://static.wikia.nocookie.net/fortnite/images/r/re/Risky_Reels_-_Location_-_Fortnite.png',
  'Leaky Lake':     'https://static.wikia.nocookie.net/fortnite/images/l/l3/Leaky_Lake_-_Location_-_Fortnite.png',
  'Sunny Steps':    'https://static.wikia.nocookie.net/fortnite/images/s/s1/Sunny_Steps_-_Location_-_Fortnite.png',
  'Frosty Flights': 'https://static.wikia.nocookie.net/fortnite/images/f/f2/Frosty_Flights_-_Location_-_Fortnite.png',
  'Polar Peak':     'https://static.wikia.nocookie.net/fortnite/images/p/p1/Polar_Peak_-_Location_-_Fortnite.png',
  'Happy Hamlet':   'https://static.wikia.nocookie.net/fortnite/images/h/h1/Happy_Hamlet_-_Location_-_Fortnite.png',
  'Shifty Shafts':  'https://static.wikia.nocookie.net/fortnite/images/s/s2/Shifty_Shafts_-_Location_-_Fortnite.png',
  'Moisty Mire':    'https://static.wikia.nocookie.net/fortnite/images/m/me/Moisty_Mire_-_Location_-_Fortnite.png',
  // ── Chapter 2 ──────────────────────────────────────────────────────────────
  'Sweaty Sands':      'https://static.wikia.nocookie.net/fortnite/images/s/s3/Sweaty_Sands_-_Location_-_Fortnite.png',
  'Dirty Docks':       'https://static.wikia.nocookie.net/fortnite/images/d/de/Dirty_Docks_-_Location_-_Fortnite.png',
  'Misty Meadows':     'https://static.wikia.nocookie.net/fortnite/images/m/m1/Misty_Meadows_-_Location_-_Fortnite.png',
  'Lazy Lake':         'https://static.wikia.nocookie.net/fortnite/images/l/l4/Lazy_Lake_-_Location_-_Fortnite.png',
  'Coral Castle':      'https://static.wikia.nocookie.net/fortnite/images/c/ce/Coral_Castle_-_Location_-_Fortnite.png',
  'Catty Corner':      'https://static.wikia.nocookie.net/fortnite/images/c/c1/Catty_Corner_-_Location_-_Fortnite.png',
  'Craggy Cliffs':     'https://static.wikia.nocookie.net/fortnite/images/c/c2/Craggy_Cliffs_-_Location_-_Fortnite.png',
  'Frenzy Farm':       'https://static.wikia.nocookie.net/fortnite/images/f/f3/Frenzy_Farm_-_Location_-_Fortnite.png',
  'Holly Hedges':      'https://static.wikia.nocookie.net/fortnite/images/h/h2/Holly_Hedges_-_Location_-_Fortnite.png',
  'Weeping Woods':     'https://static.wikia.nocookie.net/fortnite/images/w/w1/Weeping_Woods_-_Location_-_Fortnite.png',
  'Slurpy Swamp':      'https://static.wikia.nocookie.net/fortnite/images/s/s4/Slurpy_Swamp_-_Location_-_Fortnite.png',
  'Steamy Stacks':     'https://static.wikia.nocookie.net/fortnite/images/s/s5/Steamy_Stacks_-_Location_-_Fortnite.png',
  'The Authority':     'https://static.wikia.nocookie.net/fortnite/images/t/t2/The_Authority_-_Location_-_Fortnite.png',
  'The Agency':        'https://static.wikia.nocookie.net/fortnite/images/t/t3/The_Agency_-_Location_-_Fortnite.png',
  'The Yacht':         'https://static.wikia.nocookie.net/fortnite/images/t/t4/The_Yacht_-_Location_-_Fortnite.png',
  'The Rig':           'https://static.wikia.nocookie.net/fortnite/images/t/t5/The_Rig_-_Location_-_Fortnite.png',
  'The Shark':         'https://static.wikia.nocookie.net/fortnite/images/t/t6/The_Shark_-_Location_-_Fortnite.png',
  'Salty Towers':      'https://static.wikia.nocookie.net/fortnite/images/s/s6/Salty_Towers_-_Location_-_Fortnite.png',
  'Colossal Crops':    'https://static.wikia.nocookie.net/fortnite/images/c/c3/Colossal_Crops_-_Location_-_Fortnite.png',
  'Boney Burbs':       'https://static.wikia.nocookie.net/fortnite/images/b/be/Boney_Burbs_-_Location_-_Fortnite.png',
  'Believer Beach':    'https://static.wikia.nocookie.net/fortnite/images/b/b1/Believer_Beach_-_Location_-_Fortnite.png',
  'Corny Crops':       'https://static.wikia.nocookie.net/fortnite/images/c/c4/Corny_Crops_-_Location_-_Fortnite.png',
  'Coney Crossroads':  'https://static.wikia.nocookie.net/fortnite/images/c/c5/Coney_Crossroads_-_Location_-_Fortnite.png',
  'Rocky Reels':       'https://static.wikia.nocookie.net/fortnite/images/r/r1/Rocky_Reels_-_Location_-_Fortnite.png',
  'Sanctuary':         'https://static.wikia.nocookie.net/fortnite/images/s/s7/Sanctuary_-_Location_-_Fortnite.png',
  'The Daily Bugle':   'https://static.wikia.nocookie.net/fortnite/images/t/t7/The_Daily_Bugle_-_Location_-_Fortnite.png',
  'Camp Cuddle':       'https://static.wikia.nocookie.net/fortnite/images/c/c6/Camp_Cuddle_-_Location_-_Fortnite.png',
  'Rave Cave':         'https://static.wikia.nocookie.net/fortnite/images/r/r2/Rave_Cave_-_Location_-_Fortnite.png',
  'Logjam Lumberyard': 'https://static.wikia.nocookie.net/fortnite/images/l/l5/Logjam_Lumberyard_-_Location_-_Fortnite.png',
  'Chrome Crossroads': 'https://static.wikia.nocookie.net/fortnite/images/c/c7/Chrome_Crossroads_-_Location_-_Fortnite.png',
  "Herald's Sanctum":  'https://static.wikia.nocookie.net/fortnite/images/h/h3/Heralds_Sanctum_-_Location_-_Fortnite.png',
  // ── Chapter 3 ──────────────────────────────────────────────────────────────
  'The Joneses':        'https://static.wikia.nocookie.net/fortnite/images/t/t8/The_Joneses_-_Location_-_Fortnite.png',
  'Sleepy Sound':       'https://static.wikia.nocookie.net/fortnite/images/s/s8/Sleepy_Sound_-_Location_-_Fortnite.png',
  'Condo Canyon':       'https://static.wikia.nocookie.net/fortnite/images/c/c8/Condo_Canyon_-_Location_-_Fortnite.png',
  "Chonker's Speedway": 'https://static.wikia.nocookie.net/fortnite/images/c/c9/Chonkers_Speedway_-_Location_-_Fortnite.png',
  'Anvil Square':       'https://static.wikia.nocookie.net/fortnite/images/a/a1/Anvil_Square_-_Location_-_Fortnite.png',
  'Shuffled Shrines':   'https://static.wikia.nocookie.net/fortnite/images/s/s9/Shuffled_Shrines_-_Location_-_Fortnite.png',
  'Lustrous Lagoon':    'https://static.wikia.nocookie.net/fortnite/images/l/l6/Lustrous_Lagoon_-_Location_-_Fortnite.png',
  'Cloudy Condos':      'https://static.wikia.nocookie.net/fortnite/images/c/ca/Cloudy_Condos_-_Location_-_Fortnite.png',
  'Reality Falls':      'https://static.wikia.nocookie.net/fortnite/images/r/r3/Reality_Falls_-_Location_-_Fortnite.png',
  // ── Chapter 4 ──────────────────────────────────────────────────────────────
  'Shattered Slabs':    'https://static.wikia.nocookie.net/fortnite/images/s/sa/Shattered_Slabs_-_Location_-_Fortnite.png',
  'Breakwater Bay':     'https://static.wikia.nocookie.net/fortnite/images/b/b2/Breakwater_Bay_-_Location_-_Fortnite.png',
  'Mega City':          'https://static.wikia.nocookie.net/fortnite/images/m/m2/Mega_City_-_Location_-_Fortnite.png',
  'Steamy Springs':     'https://static.wikia.nocookie.net/fortnite/images/s/sb/Steamy_Springs_-_Location_-_Fortnite.png',
  'Knotty Nets':        'https://static.wikia.nocookie.net/fortnite/images/k/ke/Knotty_Nets_-_Location_-_Fortnite.png',
  'Brutal Bastion':     'https://static.wikia.nocookie.net/fortnite/images/b/b3/Brutal_Bastion_-_Location_-_Fortnite.png',
  'Frenzy Fields':      'https://static.wikia.nocookie.net/fortnite/images/f/f4/Frenzy_Fields_-_Location_-_Fortnite.png',
  'Slappy Shores':      'https://static.wikia.nocookie.net/fortnite/images/s/sc/Slappy_Shores_-_Location_-_Fortnite.png',
  'Lonely Labs':        'https://static.wikia.nocookie.net/fortnite/images/l/l7/Lonely_Labs_-_Location_-_Fortnite.png',
  'Eclipsed Estate':    'https://static.wikia.nocookie.net/fortnite/images/e/ee/Eclipsed_Estate_-_Location_-_Fortnite.png',
  'Relentless Retreat': 'https://static.wikia.nocookie.net/fortnite/images/r/r4/Relentless_Retreat_-_Location_-_Fortnite.png',
  'Faulty Splits':      'https://static.wikia.nocookie.net/fortnite/images/f/f5/Faulty_Splits_-_Location_-_Fortnite.png',
  // ── Chapter 5 ──────────────────────────────────────────────────────────────
  'Reckless Railways':      'https://static.wikia.nocookie.net/fortnite/images/r/r5/Reckless_Railways_-_Location_-_Fortnite.png',
  'Grand Glacier':          'https://static.wikia.nocookie.net/fortnite/images/g/g1/Grand_Glacier_-_Location_-_Fortnite.png',
  'Lavish Lair':            'https://static.wikia.nocookie.net/fortnite/images/l/l8/Lavish_Lair_-_Location_-_Fortnite.png',
  'Restored Reels':         'https://static.wikia.nocookie.net/fortnite/images/r/r6/Restored_Reels_-_Location_-_Fortnite.png',
  'Snooty Steppes':         'https://static.wikia.nocookie.net/fortnite/images/s/sd/Snooty_Steppes_-_Location_-_Fortnite.png',
  'Classy Courts':          'https://static.wikia.nocookie.net/fortnite/images/c/cb/Classy_Courts_-_Location_-_Fortnite.png',
  'Ritzy Riviera':          'https://static.wikia.nocookie.net/fortnite/images/r/r7/Ritzy_Riviera_-_Location_-_Fortnite.png',
  'Mount Olympus':          'https://static.wikia.nocookie.net/fortnite/images/m/m3/Mount_Olympus_-_Location_-_Fortnite.png',
  "Brawler's Battleground": 'https://static.wikia.nocookie.net/fortnite/images/b/b4/Brawlers_Battleground_-_Location_-_Fortnite.png',
  'Grim Gate':              'https://static.wikia.nocookie.net/fortnite/images/g/g2/Grim_Gate_-_Location_-_Fortnite.png',
  'Pleasant Piazza':        'https://static.wikia.nocookie.net/fortnite/images/p/p2/Pleasant_Piazza_-_Location_-_Fortnite.png',
  "Rebel's Roost":          'https://static.wikia.nocookie.net/fortnite/images/r/r8/Rebels_Roost_-_Location_-_Fortnite.png',
};

const FORTNITE_POIS = [
  // Chapter 1
  { name: 'Tilted Towers',  image: POI_IMAGES['Tilted Towers']  ?? POI_FALLBACK },
  { name: 'Dusty Depot',    image: POI_IMAGES['Dusty Depot']    ?? POI_FALLBACK },
  { name: 'Dusty Divot',    image: POI_IMAGES['Dusty Divot']    ?? POI_FALLBACK },
  { name: 'Loot Lake',      image: POI_IMAGES['Loot Lake']      ?? POI_FALLBACK },
  { name: 'Pleasant Park',  image: POI_IMAGES['Pleasant Park']  ?? POI_FALLBACK },
  { name: 'Retail Row',     image: POI_IMAGES['Retail Row']     ?? POI_FALLBACK },
  { name: 'Salty Springs',  image: POI_IMAGES['Salty Springs']  ?? POI_FALLBACK },
  { name: 'Fatal Fields',   image: POI_IMAGES['Fatal Fields']   ?? POI_FALLBACK },
  { name: 'Haunted Hills',  image: POI_IMAGES['Haunted Hills']  ?? POI_FALLBACK },
  { name: 'Snobby Shores',  image: POI_IMAGES['Snobby Shores']  ?? POI_FALLBACK },
  { name: 'Tomato Town',    image: POI_IMAGES['Tomato Town']    ?? POI_FALLBACK },
  { name: 'Tomato Temple',  image: POI_IMAGES['Tomato Temple']  ?? POI_FALLBACK },
  { name: 'Greasy Grove',   image: POI_IMAGES['Greasy Grove']   ?? POI_FALLBACK },
  { name: 'Flush Factory',  image: POI_IMAGES['Flush Factory']  ?? POI_FALLBACK },
  { name: 'Wailing Woods',  image: POI_IMAGES['Wailing Woods']  ?? POI_FALLBACK },
  { name: 'Anarchy Acres',  image: POI_IMAGES['Anarchy Acres']  ?? POI_FALLBACK },
  { name: 'Junk Junction',  image: POI_IMAGES['Junk Junction']  ?? POI_FALLBACK },
  { name: 'Lonely Lodge',   image: POI_IMAGES['Lonely Lodge']   ?? POI_FALLBACK },
  { name: 'Lucky Landing',  image: POI_IMAGES['Lucky Landing']  ?? POI_FALLBACK },
  { name: 'Lazy Links',     image: POI_IMAGES['Lazy Links']     ?? POI_FALLBACK },
  { name: 'Paradise Palms', image: POI_IMAGES['Paradise Palms'] ?? POI_FALLBACK },
  { name: 'Risky Reels',    image: POI_IMAGES['Risky Reels']    ?? POI_FALLBACK },
  { name: 'Leaky Lake',     image: POI_IMAGES['Leaky Lake']     ?? POI_FALLBACK },
  { name: 'Sunny Steps',    image: POI_IMAGES['Sunny Steps']    ?? POI_FALLBACK },
  { name: 'Frosty Flights', image: POI_IMAGES['Frosty Flights'] ?? POI_FALLBACK },
  { name: 'Polar Peak',     image: POI_IMAGES['Polar Peak']     ?? POI_FALLBACK },
  { name: 'Happy Hamlet',   image: POI_IMAGES['Happy Hamlet']   ?? POI_FALLBACK },
  { name: 'Shifty Shafts',  image: POI_IMAGES['Shifty Shafts']  ?? POI_FALLBACK },
  { name: 'Moisty Mire',    image: POI_IMAGES['Moisty Mire']    ?? POI_FALLBACK },
  // Chapter 2
  { name: 'Sweaty Sands',      image: POI_IMAGES['Sweaty Sands']      ?? POI_FALLBACK },
  { name: 'Dirty Docks',       image: POI_IMAGES['Dirty Docks']       ?? POI_FALLBACK },
  { name: 'Misty Meadows',     image: POI_IMAGES['Misty Meadows']     ?? POI_FALLBACK },
  { name: 'Lazy Lake',         image: POI_IMAGES['Lazy Lake']         ?? POI_FALLBACK },
  { name: 'Coral Castle',      image: POI_IMAGES['Coral Castle']      ?? POI_FALLBACK },
  { name: 'Catty Corner',      image: POI_IMAGES['Catty Corner']      ?? POI_FALLBACK },
  { name: 'Craggy Cliffs',     image: POI_IMAGES['Craggy Cliffs']     ?? POI_FALLBACK },
  { name: 'Frenzy Farm',       image: POI_IMAGES['Frenzy Farm']       ?? POI_FALLBACK },
  { name: 'Holly Hedges',      image: POI_IMAGES['Holly Hedges']      ?? POI_FALLBACK },
  { name: 'Weeping Woods',     image: POI_IMAGES['Weeping Woods']     ?? POI_FALLBACK },
  { name: 'Slurpy Swamp',      image: POI_IMAGES['Slurpy Swamp']      ?? POI_FALLBACK },
  { name: 'Steamy Stacks',     image: POI_IMAGES['Steamy Stacks']     ?? POI_FALLBACK },
  { name: 'The Authority',     image: POI_IMAGES['The Authority']     ?? POI_FALLBACK },
  { name: 'The Agency',        image: POI_IMAGES['The Agency']        ?? POI_FALLBACK },
  { name: 'The Yacht',         image: POI_IMAGES['The Yacht']         ?? POI_FALLBACK },
  { name: 'The Rig',           image: POI_IMAGES['The Rig']           ?? POI_FALLBACK },
  { name: 'The Shark',         image: POI_IMAGES['The Shark']         ?? POI_FALLBACK },
  { name: 'Salty Towers',      image: POI_IMAGES['Salty Towers']      ?? POI_FALLBACK },
  { name: 'Colossal Crops',    image: POI_IMAGES['Colossal Crops']    ?? POI_FALLBACK },
  { name: 'Boney Burbs',       image: POI_IMAGES['Boney Burbs']       ?? POI_FALLBACK },
  { name: 'Believer Beach',    image: POI_IMAGES['Believer Beach']    ?? POI_FALLBACK },
  { name: 'Corny Crops',       image: POI_IMAGES['Corny Crops']       ?? POI_FALLBACK },
  { name: 'Coney Crossroads',  image: POI_IMAGES['Coney Crossroads']  ?? POI_FALLBACK },
  { name: 'Rocky Reels',       image: POI_IMAGES['Rocky Reels']       ?? POI_FALLBACK },
  { name: 'Sanctuary',         image: POI_IMAGES['Sanctuary']         ?? POI_FALLBACK },
  { name: 'The Daily Bugle',   image: POI_IMAGES['The Daily Bugle']   ?? POI_FALLBACK },
  { name: 'Camp Cuddle',       image: POI_IMAGES['Camp Cuddle']       ?? POI_FALLBACK },
  { name: 'Rave Cave',         image: POI_IMAGES['Rave Cave']         ?? POI_FALLBACK },
  { name: 'Logjam Lumberyard', image: POI_IMAGES['Logjam Lumberyard'] ?? POI_FALLBACK },
  { name: 'Chrome Crossroads', image: POI_IMAGES['Chrome Crossroads'] ?? POI_FALLBACK },
  { name: "Herald's Sanctum",  image: POI_IMAGES["Herald's Sanctum"]  ?? POI_FALLBACK },
  // Chapter 3
  { name: 'The Joneses',         image: POI_IMAGES['The Joneses']         ?? POI_FALLBACK },
  { name: 'Sleepy Sound',        image: POI_IMAGES['Sleepy Sound']        ?? POI_FALLBACK },
  { name: 'Condo Canyon',        image: POI_IMAGES['Condo Canyon']        ?? POI_FALLBACK },
  { name: "Chonker's Speedway",  image: POI_IMAGES["Chonker's Speedway"]  ?? POI_FALLBACK },
  { name: 'Anvil Square',        image: POI_IMAGES['Anvil Square']        ?? POI_FALLBACK },
  { name: 'Shuffled Shrines',    image: POI_IMAGES['Shuffled Shrines']    ?? POI_FALLBACK },
  { name: 'Lustrous Lagoon',     image: POI_IMAGES['Lustrous Lagoon']     ?? POI_FALLBACK },
  { name: 'Cloudy Condos',       image: POI_IMAGES['Cloudy Condos']       ?? POI_FALLBACK },
  { name: 'Reality Falls',       image: POI_IMAGES['Reality Falls']       ?? POI_FALLBACK },
  // Chapter 4
  { name: 'Shattered Slabs',    image: POI_IMAGES['Shattered Slabs']    ?? POI_FALLBACK },
  { name: 'Breakwater Bay',     image: POI_IMAGES['Breakwater Bay']     ?? POI_FALLBACK },
  { name: 'Mega City',          image: POI_IMAGES['Mega City']          ?? POI_FALLBACK },
  { name: 'Steamy Springs',     image: POI_IMAGES['Steamy Springs']     ?? POI_FALLBACK },
  { name: 'Knotty Nets',        image: POI_IMAGES['Knotty Nets']        ?? POI_FALLBACK },
  { name: 'Brutal Bastion',     image: POI_IMAGES['Brutal Bastion']     ?? POI_FALLBACK },
  { name: 'Frenzy Fields',      image: POI_IMAGES['Frenzy Fields']      ?? POI_FALLBACK },
  { name: 'Slappy Shores',      image: POI_IMAGES['Slappy Shores']      ?? POI_FALLBACK },
  { name: 'Lonely Labs',        image: POI_IMAGES['Lonely Labs']        ?? POI_FALLBACK },
  { name: 'Eclipsed Estate',    image: POI_IMAGES['Eclipsed Estate']    ?? POI_FALLBACK },
  { name: 'Relentless Retreat', image: POI_IMAGES['Relentless Retreat'] ?? POI_FALLBACK },
  { name: 'Faulty Splits',      image: POI_IMAGES['Faulty Splits']      ?? POI_FALLBACK },
  // Chapter 5
  { name: 'Reckless Railways',      image: POI_IMAGES['Reckless Railways']      ?? POI_FALLBACK },
  { name: 'Grand Glacier',          image: POI_IMAGES['Grand Glacier']          ?? POI_FALLBACK },
  { name: 'Lavish Lair',            image: POI_IMAGES['Lavish Lair']            ?? POI_FALLBACK },
  { name: 'Restored Reels',         image: POI_IMAGES['Restored Reels']         ?? POI_FALLBACK },
  { name: 'Snooty Steppes',         image: POI_IMAGES['Snooty Steppes']         ?? POI_FALLBACK },
  { name: 'Classy Courts',          image: POI_IMAGES['Classy Courts']          ?? POI_FALLBACK },
  { name: 'Ritzy Riviera',          image: POI_IMAGES['Ritzy Riviera']          ?? POI_FALLBACK },
  { name: 'Mount Olympus',          image: POI_IMAGES['Mount Olympus']          ?? POI_FALLBACK },
  { name: "Brawler's Battleground", image: POI_IMAGES["Brawler's Battleground"] ?? POI_FALLBACK },
  { name: 'Grim Gate',              image: POI_IMAGES['Grim Gate']              ?? POI_FALLBACK },
  { name: 'Pleasant Piazza',        image: POI_IMAGES['Pleasant Piazza']        ?? POI_FALLBACK },
  { name: "Rebel's Roost",          image: POI_IMAGES["Rebel's Roost"]          ?? POI_FALLBACK },
];

const COOLDOWN_MS = 90 * 60 * 1000;

// ─── Consistent error logger ──────────────────────────────────────────────────
function logError(context, err) {
  console.error(`[ERROR] ${context}:`, err?.message ?? err);
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

// ─── Commands ─────────────────────────────────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName('guess')
    .setDescription('Guess which Fortnite POI foxyboy3 is hiding at!')
    .addStringOption(o => o.setName('poi').setDescription('Your POI guess').setRequired(true)),

  new SlashCommandBuilder()
    .setName('currentpoi')
    .setDescription('See the current hiding game status'),
];

// ─── Handler ──────────────────────────────────────────────────────────────────
async function handleGame(interaction, updateBalance, client, onWin = null) {
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

      const isOwner = OWNER_ID ? user.id === OWNER_ID : false;
      const remaining = getCooldownRemaining(user.id);
      if (!isOwner && remaining > 0) {
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

      if (guess.toLowerCase() === poi.name.toLowerCase()) {
        // ✅ Correct!
        updateBalance(user.id, 1);
        if (!isOwner) setCooldown(user.id);
        const newPoi = newRandomPoi();

        // Notify any tracked leaderboard messages immediately so the new win
        // shows up without waiting for the next 30-second background tick.
        if (onWin) onWin();

        // DM owner: someone found them — new hiding spot revealed.
        if (OWNER_ID) {
          try {
            const owner = await client.users.fetch(OWNER_ID);
            await owner.send({
              embeds: [
                new EmbedBuilder()
                  .setColor(0xFEE75C)
                  .setTitle('📍 Someone Found You!')
                  .setThumbnail(newPoi.image)
                  .addFields(
                    { name: 'Found by',           value: `${user.username} (<@${user.id}>)`, inline: true },
                    { name: 'They guessed',        value: poi.name,                           inline: true },
                    { name: 'Your new hiding spot', value: `**${newPoi.name}**` },
                  )
                  .setTimestamp()
              ]
            });
          } catch (err) {
            logError('guess correct: DM owner', err);
          }
        }

        return await safeReply(interaction, {
          embeds: [
            new EmbedBuilder()
              .setColor(0x57F287)
              .setThumbnail(poi.image)
              .setDescription(
                `🪙 1 coin **${user.username}** found where **Sam** was hiding\n\n` +
                (OWNER_ID ? `DM <@${OWNER_ID}> to claim your win!` : 'Contact the owner to claim your win!')
              )
              .setTimestamp()
          ],
        });


      } else {
        // ❌ Wrong guess — reveal current POI image then rotate to a new one.
        const revealedPoi = poi;
        if (!isOwner) setCooldown(user.id);
        newRandomPoi();

        // DM owner: someone guessed wrong.
        if (OWNER_ID) {
          try {
            const owner = await client.users.fetch(OWNER_ID);
            await owner.send({
              embeds: [
                new EmbedBuilder()
                  .setColor(0xED4245)
                  .setTitle('❌ Wrong Guess!')
                  .setThumbnail(currentPoi.image)
                  .addFields(
                    { name: 'Guessed by',         value: `${user.username} (<@${user.id}>)`, inline: true },
                    { name: 'They guessed',        value: guess,                              inline: true },
                    { name: 'You were actually at', value: revealedPoi.name,                  inline: true },
                    { name: 'New hiding spot',     value: `**${currentPoi.name}**` },
                  )
                  .setTimestamp()
              ]
            });
          } catch (err) {
            logError('guess wrong: DM owner', err);
          }
        }

        return await safeReply(interaction, {
          embeds: [
            new EmbedBuilder()
              .setColor(0xED4245)
              .setThumbnail(revealedPoi.image)
              .setDescription(`**Sam** was hiding at **${revealedPoi.name}**`)
              .setTimestamp()
          ]
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
  }
}

module.exports = { commands, handleGame, getCurrentPoi, initPoi, userCooldowns, checkCooldowns };
