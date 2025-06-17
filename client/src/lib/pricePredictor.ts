// Property Price Prediction Logic
interface PropertyData {
  propertyType: string;
  propertySize: number;
  sizeUnit: string;
  propertyAge: string;
  bedrooms: number;
  furnished: string;
  floor: string;
  parkingSpaces: number;
}

interface LocationData {
  lat: number;
  lng: number;
  address: string;
}

interface PriceRange {
  min: number;
  max: number;
  average: number;
  perSqFt: number;
  confidence: number;
  marketTrend: 'hot' | 'stable' | 'slow';
}

// Base property prices per sq ft for different property types in India (in INR)
const basePrices = {
  apartment: {
    tier1: { min: 8000, max: 25000, avg: 12000 }, // Mumbai, Delhi, Bangalore
    tier2: { min: 4000, max: 12000, avg: 6500 },  // Pune, Hyderabad, Chennai
    tier3: { min: 2000, max: 8000, avg: 4000 },   // Smaller cities
    rural: { min: 800, max: 3000, avg: 1500 }     // Rural/outskirts
  },
  house: {
    tier1: { min: 10000, max: 35000, avg: 15000 },
    tier2: { min: 5000, max: 15000, avg: 8000 },
    tier3: { min: 2500, max: 10000, avg: 5000 },
    rural: { min: 1000, max: 4000, avg: 2000 }
  },
  plot: {
    tier1: { min: 15000, max: 80000, avg: 25000 },
    tier2: { min: 8000, max: 30000, avg: 12000 },
    tier3: { min: 3000, max: 15000, avg: 6000 },
    rural: { min: 500, max: 5000, avg: 1500 }
  },
  commercial: {
    tier1: { min: 12000, max: 50000, avg: 20000 },
    tier2: { min: 6000, max: 20000, avg: 10000 },
    tier3: { min: 3000, max: 12000, avg: 6000 },
    rural: { min: 1000, max: 6000, avg: 2500 }
  }
};

// Major Indian cities classification
const cityTiers = {
  tier1: ['mumbai', 'delhi', 'bangalore', 'bengaluru', 'gurgaon', 'noida', 'new delhi'],
  tier2: ['pune', 'hyderabad', 'chennai', 'kolkata', 'ahmedabad', 'surat', 'jaipur', 'lucknow', 'kanpur', 'nagpur', 'indore', 'thane', 'bhopal', 'visakhapatnam', 'patna'],
  tier3: ['vadodara', 'coimbatore', 'agra', 'madurai', 'nashik', 'faridabad', 'meerut', 'rajkot', 'kalyan-dombivali', 'vasai-virar', 'varanasi', 'srinagar', 'aurangabad', 'dhanbad', 'amritsar', 'navi mumbai', 'allahabad', 'ranchi', 'howrah', 'jabalpur', 'gwalior', 'vijayawada']
};

function getCityTier(address: string): 'tier1' | 'tier2' | 'tier3' | 'rural' {
  const lowerAddress = address.toLowerCase();
  
  for (const city of cityTiers.tier1) {
    if (lowerAddress.includes(city)) return 'tier1';
  }
  
  for (const city of cityTiers.tier2) {
    if (lowerAddress.includes(city)) return 'tier2';
  }
  
  for (const city of cityTiers.tier3) {
    if (lowerAddress.includes(city)) return 'tier3';
  }
  
  return 'rural';
}

function applyLocationMultipliers(basePrice: any, location: LocationData): any {
  const address = location.address.toLowerCase();
  let multiplier = 1.0;
  
  // Premium location keywords
  if (address.includes('sector') || address.includes('phase')) multiplier += 0.15;
  if (address.includes('it park') || address.includes('tech park')) multiplier += 0.25;
  if (address.includes('airport') || address.includes('metro')) multiplier += 0.20;
  if (address.includes('mall') || address.includes('commercial')) multiplier += 0.15;
  if (address.includes('highway') || address.includes('expressway')) multiplier += 0.10;
  if (address.includes('lake') || address.includes('park')) multiplier += 0.12;
  
  // Negative factors
  if (address.includes('industrial') || address.includes('factory')) multiplier -= 0.15;
  if (address.includes('outskirts') || address.includes('periphery')) multiplier -= 0.20;
  
  return {
    min: Math.round(basePrice.min * multiplier),
    max: Math.round(basePrice.max * multiplier),
    avg: Math.round(basePrice.avg * multiplier)
  };
}

function applyPropertyFactors(adjustedPrice: any, propertyData: PropertyData): any {
  let multiplier = 1.0;
  
  // Age factor
  switch (propertyData.propertyAge) {
    case 'new':
    case '0-1':
      multiplier += 0.15;
      break;
    case '1-5':
      multiplier += 0.05;
      break;
    case '5-10':
      break; // neutral
    case '10-20':
      multiplier -= 0.10;
      break;
    default:
      multiplier -= 0.20;
  }
  
  // Furnishing factor
  switch (propertyData.furnished) {
    case 'fully-furnished':
      multiplier += 0.20;
      break;
    case 'semi-furnished':
      multiplier += 0.10;
      break;
    case 'unfurnished':
      break; // neutral
  }
  
  // Floor factor for apartments
  if (propertyData.propertyType === 'apartment') {
    if (propertyData.floor === 'penthouse') multiplier += 0.25;
    else if (propertyData.floor === '4-7') multiplier += 0.10;
    else if (propertyData.floor === 'ground') multiplier -= 0.05;
  }
  
  // Parking factor
  if (propertyData.parkingSpaces >= 2) multiplier += 0.08;
  else if (propertyData.parkingSpaces === 1) multiplier += 0.03;
  
  return {
    min: Math.round(adjustedPrice.min * multiplier),
    max: Math.round(adjustedPrice.max * multiplier),
    avg: Math.round(adjustedPrice.avg * multiplier)
  };
}

export function predictPropertyPrice(location: LocationData, propertyData: PropertyData): PriceRange {
  const cityTier = getCityTier(location.address);
  const propertyType = propertyData.propertyType as keyof typeof basePrices;
  
  // Get base price for property type and city tier
  const basePrice = basePrices[propertyType]?.[cityTier] || basePrices.apartment.rural;
  
  // Apply location-specific multipliers
  const locationAdjustedPrice = applyLocationMultipliers(basePrice, location);
  
  // Apply property-specific factors
  const finalPrice = applyPropertyFactors(locationAdjustedPrice, propertyData);
  
  // Calculate size-based total price
  let sizeInSqFt = propertyData.propertySize;
  if (propertyData.sizeUnit === 'acres') {
    sizeInSqFt = propertyData.propertySize * 43560; // 1 acre = 43,560 sq ft
  }
  
  const totalMin = finalPrice.min * sizeInSqFt;
  const totalMax = finalPrice.max * sizeInSqFt;
  const totalAvg = finalPrice.avg * sizeInSqFt;
  
  // Determine market trend based on city tier and property type
  let marketTrend: 'hot' | 'stable' | 'slow' = 'stable';
  if (cityTier === 'tier1' && (propertyType === 'apartment' || propertyType === 'commercial')) {
    marketTrend = 'hot';
  } else if (cityTier === 'rural' || propertyType === 'plot') {
    marketTrend = 'slow';
  }
  
  // Calculate confidence based on data availability
  const confidence = Math.min(95, 60 + (cityTier === 'tier1' ? 25 : cityTier === 'tier2' ? 15 : 5));
  
  return {
    min: totalMin,
    max: totalMax,
    average: totalAvg,
    perSqFt: finalPrice.avg,
    confidence,
    marketTrend
  };
}

export function validateUserAmount(userAmount: number, predictedRange: PriceRange): {
  isRealistic: boolean;
  deviation: number;
  category: 'underpriced' | 'realistic' | 'overpriced';
  confidence: number;
} {
  const { min, max, average } = predictedRange;
  
  // Allow 30% variance for market fluctuations
  const lowerBound = min * 0.7;
  const upperBound = max * 1.3;
  
  const isRealistic = userAmount >= lowerBound && userAmount <= upperBound;
  const deviation = ((userAmount - average) / average) * 100;
  
  let category: 'underpriced' | 'realistic' | 'overpriced' = 'realistic';
  if (userAmount < min * 0.8) category = 'underpriced';
  else if (userAmount > max * 1.2) category = 'overpriced';
  
  // Calculate confidence in analysis based on how realistic the amount is
  let confidence = predictedRange.confidence;
  if (!isRealistic) {
    confidence = Math.max(30, confidence - Math.abs(deviation));
  }
  
  return {
    isRealistic,
    deviation,
    category,
    confidence
  };
}

export function generateInvestmentAdvice(userAmount: number, predictedRange: PriceRange, validation: any): string[] {
  const advice: string[] = [];
  
  if (validation.category === 'underpriced') {
    advice.push("💡 Your budget seems lower than market rates. Consider increasing budget or looking at smaller properties.");
    advice.push("📍 Look for properties in developing areas where prices might be more affordable.");
  } else if (validation.category === 'overpriced') {
    advice.push("⚠️ Your budget is higher than typical market rates. You might be overpaying.");
    advice.push("💰 Consider negotiating the price or look for premium properties that justify the cost.");
  } else {
    advice.push("✅ Your budget aligns well with current market rates.");
    advice.push("📈 This appears to be a realistic investment amount for the area.");
  }
  
  if (predictedRange.marketTrend === 'hot') {
    advice.push("🔥 This is a hot market with high demand. Prices may rise quickly.");
  } else if (predictedRange.marketTrend === 'slow') {
    advice.push("📊 This market has steady growth. Good for long-term investment.");
  }
  
  return advice;
}