// Test script to demonstrate enhanced Halugunda location intelligence
const testLocation = {
  address: "Halugunda Road, Karnataka, India",
  lat: 12.2630827,
  lng: 75.8305606
};

const mockAmenities = [
  { name: "Community Health Center", types: ["hospital", "clinic"], rating: 3.2 },
  { name: "Local Pharmacy", types: ["pharmacy"], rating: 3.8 },
  { name: "Local Primary School", types: ["school"], rating: 3.5 },
  { name: "State Bank ATM", types: ["bank", "atm"], rating: 4.0 },
  { name: "Local Market", types: ["grocery_store", "market"], rating: 3.7 },
  { name: "HP Petrol Pump", types: ["gas_station"], rating: 3.6 },
  { name: "Post Office", types: ["post_office"], rating: 3.3 },
  { name: "Local Clinic", types: ["clinic"], rating: 3.4 },
  { name: "General Store", types: ["store"], rating: 3.5 }
];

// Essential services analysis
const essentialServices = {
  healthcare: mockAmenities.filter(p => 
    p.types.some(t => ['hospital', 'clinic', 'pharmacy'].includes(t))
  ).length, // Should be 3
  education: mockAmenities.filter(p => 
    p.types.some(t => ['school'].includes(t))
  ).length, // Should be 1
  financial: mockAmenities.filter(p => 
    p.types.some(t => ['bank', 'atm'].includes(t))
  ).length, // Should be 1
  daily_needs: mockAmenities.filter(p => 
    p.types.some(t => ['grocery_store', 'gas_station', 'store'].includes(t))
  ).length // Should be 3
};

console.log("HALUGUNDA ANALYSIS TEST");
console.log("========================");
console.log("Location:", testLocation.address);
console.log("Essential Services:", essentialServices);
console.log("Total Services Available:", Object.values(essentialServices).filter(count => count > 0).length, "out of 4");

// Expected improvements:
console.log("\nEXPECTED IMPROVEMENTS:");
console.log("1. District Recognition: Should identify as Kodagu district");
console.log("2. Tourism Classification: Should classify as 'Tourism hub' with 85+ priority score");
console.log("3. Location Score: Should be 2.0+ (not 0.66) due to good essential services");
console.log("4. Investment Viability: Should be 40-60% range (not 12%)");
console.log("5. Infrastructure Adequacy: Should recognize healthcare=3, education=1, financial=1, daily_needs=3");