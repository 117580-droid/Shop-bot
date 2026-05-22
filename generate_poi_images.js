/**
 * POI Image Generator
 * Creates visual representations of Fortnite POI locations
 */

const fs = require('fs');
const path = require('path');

// POI data with colors and descriptions
const POIS_DATA = {
  'Anarchy Acres': { color: '#8B7355', desc: 'Farm' },
  'Dusty Depot': { color: '#A9A9A9', desc: 'Industrial' },
  'Fatal Fields': { color: '#90EE90', desc: 'Fields' },
  'Flush Factory': { color: '#FFB6C1', desc: 'Factory' },
  'Greasy Grove': { color: '#DAA520', desc: 'Town' },
  'Haunted Hills': { color: '#4B0082', desc: 'Spooky' },
  'Junk Junction': { color: '#696969', desc: 'Junkyard' },
  'Lazy Links': { color: '#228B22', desc: 'Golf' },
  'Lonely Lodge': { color: '#8B4513', desc: 'Lodge' },
  'Loot Lake': { color: '#4169E1', desc: 'Lake' },
  'Lucky Landing': { color: '#FFD700', desc: 'Desert' },
  'Moisty Mire': { color: '#2F4F4F', desc: 'Swamp' },
  'Pleasant Park': { color: '#90EE90', desc: 'Suburb' },
  'Retail Row': { color: '#FF6347', desc: 'Shopping' },
  'Risky Reels': { color: '#FF8C00', desc: 'Cinema' },
  'Salty Springs': { color: '#87CEEB', desc: 'Beach' },
  'Shifty Shafts': { color: '#A9A9A9', desc: 'Mines' },
  'Snobby Shores': { color: '#FFB6C1', desc: 'Mansion' },
  'Tilted Towers': { color: '#DC143C', desc: 'City' },
  'Tomato Town': { color: '#FF4500', desc: 'Farm' },
  'Wailing Woods': { color: '#228B22', desc: 'Forest' },
  'The Agency': { color: '#000000', desc: 'Secret' },
  'Craggy Cliffs': { color: '#808080', desc: 'Cliffs' },
  'Dirty Docks': { color: '#4B0082', desc: 'Port' },
  'Frenzy Farm': { color: '#90EE90', desc: 'Farm' },
  'Holly Hedges': { color: '#228B22', desc: 'Hedges' },
  'Lazy Lake': { color: '#4169E1', desc: 'Lake' },
  'Misty Meadows': { color: '#87CEEB', desc: 'Meadow' },
  'Slurpy Swamp': { color: '#00CED1', desc: 'Swamp' },
  'Steamy Stacks': { color: '#FF6347', desc: 'Factory' },
  'Sweaty Sands': { color: '#FFD700', desc: 'Beach' },
  'The Fortilla': { color: '#4169E1', desc: 'Fort' },
  'The Grotto': { color: '#696969', desc: 'Cave' },
  'The Shark': { color: '#1E90FF', desc: 'Island' },
  'Weeping Woods': { color: '#228B22', desc: 'Forest' },
  'Camp Cuddle': { color: '#FFB6C1', desc: 'Camp' },
  "Chonker's Speedway": { color: '#FF4500', desc: 'Track' },
  'Condo Canyon': { color: '#DAA520', desc: 'Canyon' },
  'Coney Crossroads': { color: '#FF6347', desc: 'Fair' },
  'Daily Bugle': { color: '#FF0000', desc: 'News' },
  'Logjam Lumberyard': { color: '#8B4513', desc: 'Lumber' },
  'Rocky Reels': { color: '#A9A9A9', desc: 'Cinema' },
  'Sanctuary': { color: '#FFD700', desc: 'Temple' },
  'Sleepy Sound': { color: '#87CEEB', desc: 'Beach' },
  'Synapse Station': { color: '#9370DB', desc: 'Station' },
  'The Joneses': { color: '#FFB6C1', desc: 'Suburb' },
  'Anvil Square': { color: '#696969', desc: 'Square' },
  'Brutal Bastion': { color: '#8B0000', desc: 'Fort' },
  'Breakwater Bay': { color: '#4169E1', desc: 'Bay' },
  'Faulty Splits': { color: '#FF6347', desc: 'Landmark' },
  'Frenzy Fields': { color: '#90EE90', desc: 'Fields' },
  'Lonely Labs': { color: '#9370DB', desc: 'Lab' },
  'Mega City': { color: '#DC143C', desc: 'City' },
  'Shattered Slabs': { color: '#A9A9A9', desc: 'Ruins' },
  'Slappy Shores': { color: '#FFD700', desc: 'Beach' },
  'Steamy Springs': { color: '#FF6347', desc: 'Springs' },
  'Classy Courts': { color: '#FFB6C1', desc: 'Courts' },
  'Fencing Fields': { color: '#90EE90', desc: 'Fields' },
  'Grand Glacier': { color: '#87CEEB', desc: 'Glacier' },
  'Hazy Hillside': { color: '#DAA520', desc: 'Hills' },
  'Lavish Lair': { color: '#FFD700', desc: 'Mansion' },
  'Pleasant Piazza': { color: '#90EE90', desc: 'Plaza' },
  'Reckless Railways': { color: '#696969', desc: 'Rails' },
  'Ritzy Riviera': { color: '#FFB6C1', desc: 'Beach' },
  'Ruined Reels': { color: '#A9A9A9', desc: 'Cinema' },
  'Snooty Steppes': { color: '#DAA520', desc: 'Steppe' },
};

// Generate SVG image for a POI
function generateSVG(poiName, color, desc) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="256" height="256" fill="#1a1a2e"/>
  
  <!-- Gradient overlay -->
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${color};stop-opacity:0.8" />
      <stop offset="100%" style="stop-color:#0f3460;stop-opacity:0.9" />
    </linearGradient>
  </defs>
  
  <!-- Main shape -->
  <circle cx="128" cy="128" r="100" fill="url(#grad)"/>
  
  <!-- Border -->
  <circle cx="128" cy="128" r="100" fill="none" stroke="${color}" stroke-width="3"/>
  
  <!-- POI Name -->
  <text x="128" y="110" font-family="Arial, sans-serif" font-size="18" font-weight="bold" 
        text-anchor="middle" fill="white">${poiName}</text>
  
  <!-- Description -->
  <text x="128" y="145" font-family="Arial, sans-serif" font-size="12" 
        text-anchor="middle" fill="${color}">${desc}</text>
  
  <!-- Fortnite marker -->
  <polygon points="128,60 145,90 110,90" fill="${color}"/>
</svg>`;
  
  return svg;
}

// Convert POI name to filename
function poiToFilename(name) {
  return name
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

// Generate all POI images
async function generateAllImages() {
  const poisDir = path.join('/root/repo/pois');
  
  // Create pois directory if it doesn't exist
  if (!fs.existsSync(poisDir)) {
    fs.mkdirSync(poisDir, { recursive: true });
  }
  
  console.log('🎨 GENERATING POI IMAGES');
  console.log('═'.repeat(70));
  
  let count = 0;
  for (const [poiName, data] of Object.entries(POIS_DATA)) {
    const filename = poiToFilename(poiName);
    const filepath = path.join(poisDir, `${filename}.svg`);
    
    const svg = generateSVG(poiName, data.color, data.desc);
    fs.writeFileSync(filepath, svg);
    
    count++;
    console.log(`✅ Generated: ${poiName.padEnd(30)} → ${filename}.svg`);
  }
  
  console.log('\n' + '═'.repeat(70));
  console.log(`📊 GENERATED ${count} POI IMAGES`);
  console.log('═'.repeat(70));
  console.log('\n✨ All images saved to /pois folder');
  console.log('📝 Next: Convert SVG to PNG and upload to GitHub');
}

generateAllImages().catch(console.error);
