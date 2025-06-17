const fs = require('fs');

// Read the file
let content = fs.readFileSync('server/routes.ts', 'utf8');

// Replace all instances of the old essential service detection logic
const oldPattern = `          if (place.types.includes('school') || place.types.includes('hospital') || 
              place.types.includes('subway_station') || place.types.includes('bus_station') ||
              place.types.includes('shopping_mall') || place.types.includes('grocery_or_supermarket')) {
            closeEssentialServices++;
          }`;

const newPattern = `          if (isEssentialService(place)) {
            closeEssentialServices++;
          }`;

// Replace all occurrences
content = content.replace(new RegExp(oldPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newPattern);

// Also update the hasHospital, hasTransport, hasShopping detection in paid/pro tiers
content = content.replace(
  /const hasHospital = result\.nearbyPlaces\.some\(p => p\.types\.includes\('hospital'\)\);/g,
  `const hasHospital = result.nearbyPlaces.some(p => p.types.some(t => ['hospital', 'health', 'doctor', 'clinic'].includes(t)));`
);

content = content.replace(
  /const hasTransport = result\.nearbyPlaces\.some\(p => p\.types\.includes\('subway_station'\) \|\| p\.types\.includes\('bus_station'\)\);/g,
  `const hasTransport = result.nearbyPlaces.some(p => p.types.some(t => ['subway_station', 'bus_station', 'train_station', 'transit_station', 'light_rail_station'].includes(t)));`
);

content = content.replace(
  /const hasShopping = result\.nearbyPlaces\.some\(p => p\.types\.includes\('shopping_mall'\) \|\| p\.types\.includes\('grocery_or_supermarket'\)\);/g,
  `const hasShopping = result.nearbyPlaces.some(p => p.types.some(t => ['shopping_mall', 'supermarket', 'grocery_or_supermarket', 'store', 'convenience_store'].includes(t)));`
);

// Write the updated content back
fs.writeFileSync('server/routes.ts', content);

console.log('Essential service detection logic updated successfully');