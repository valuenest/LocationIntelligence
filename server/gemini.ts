import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface InvestmentLocation {
  address: string;
  lat: number;
  lng: number;
  score: number;
  reasoning: string;
  distance: string;
  imageUrl?: string;
}

interface LocationIntelligence {
  locationType: 'metropolitan' | 'city' | 'town' | 'village' | 'rural' | 'uninhabitable';
  areaClassification: string; // Detailed area type classification
  priorityScore: number; // Score based on area type priority (0-100)
  safetyScore: number; // 1-10 scale
  crimeRate: 'very-low' | 'low' | 'moderate' | 'high' | 'very-high';
  developmentStage: 'developed' | 'developing' | 'underdeveloped' | 'restricted';
  investmentPotential: number; // 0-100 scale
  primaryConcerns: string[];
  keyStrengths: string[];
  reasoning: string;
  confidence: number; // 0-100 scale
}

interface AIAnalysisRequest {
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  amount: number;
  propertyType: string;
  nearbyPlaces: Array<{
    name: string;
    vicinity: string;
    rating?: number;
    types: string[];
  }>;
  distances: Record<string, any>;
}

// Simple in-memory cache for location intelligence
const locationCache = new Map<string, LocationIntelligence>();

export async function analyzeLocationIntelligence(
  address: string,
  lat: number,
  lng: number
): Promise<LocationIntelligence> {
  try {
    // Simple caching to avoid duplicate AI calls for same location
    const cacheKey = `${address}_${lat.toFixed(3)}_${lng.toFixed(3)}`;
    const cached = locationCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `As a location intelligence expert, analyze this specific location for real estate investment:

Location: ${address}
Coordinates: ${lat}, ${lng}

Analyze and provide a comprehensive assessment including:

1. Location Type Classification with Priority Scoring:

MUST classify using EXACT terms from these categories:

TIER 1: Metropolitan Areas (Priority Score: 90-100)
- "Metro city" - For HSR Layout Bangalore, Gurgaon, Noida, Bandra Mumbai
- "Metropolitan area" - Major metro regions
- "Megacity" - Cities with 10M+ population
- "Urban agglomeration" - Large urban clusters

TIER 2: Urban Areas (Priority Score: 70-89)  
- "City" - Tier 1/2 city centers
- "Urban locality" - Urban neighborhoods
- "Municipality" - Municipal areas
- "Town" - Smaller urban centers

TIER 3: Semi-Urban Areas (Priority Score: 50-69)
- "Township" - Planned residential areas
- "Suburban" - Suburb areas
- "Semi-urban" - Between urban and rural
- "Outskirts" - City periphery

TIER 4: Industrial/IT Zones (Priority Score: 80-95)
- "Industrial estate" - Manufacturing zones
- "SEZ (Special Economic Zone)" - Export zones
- "IT park" - Technology parks
- "Tech hub" - Technology corridors

TIER 5: Smart Cities/Planned Cities (Priority Score: 85-100)
- "Smart city" - Government smart city initiatives
- "Planned township" - Integrated townships
- "Satellite city" - Planned satellite towns

TIER 6: Tourism & Highway Corridors (Priority Score: 75-90)
- "Tourism hub" - Major tourist destinations (Coorg, Ooty, Munnar, Goa)
- "Highway corridor" - National/State highway adjacent areas
- "Tourist town" - Towns with significant tourism potential
- "Resort area" - Areas with resort/hospitality development
- "Weekend getaway" - Popular short-distance destinations
- "Scenic location" - Locations with natural beauty/attractions

TIER 7: Coastal Areas (Priority Score: 60-80)
- "Coastal town" - Coastal settlements
- "Port city" - Port areas
- "Beachside area" - Beach localities

TIER 8: Hill/Tribal Regions (Priority Score: 50-70)
- "Hill station" - Mountain retreats
- "Tribal area" - Tribal regions
- "Mountain village" - Hill settlements

TIER 9: Rural Areas (Priority Score: 20-40)
- "Village" - Rural villages
- "Panchayat" - Gram panchayat areas
- "Countryside" - Rural countryside
- "Hamlet" - Small villages
- "Rural block" - Rural administrative blocks

CRITICAL SPECIAL LOCATIONS - MUST IDENTIFY CORRECTLY:
- ALL Kodagu district locations (including Halugunda, Bittangala, Virajpet, Madikeri, Kushalnagar, Pollibetta) = "Tourism hub" with 85-90 priority score
- Kodagu district is Karnataka's premier coffee and tourism region - ANY location within this district should get tourism classification
- Areas near National Highway NH-275, NH-48, NH-44 = "Highway corridor" with 80-85 priority score  
- Hill stations like Ooty, Munnar, Nainital = "Hill station" with 70-80 priority score
- Beach towns like Gokarna, Varkala, Pondicherry = "Coastal town" with 75-80 priority score
- HSR Layout Bangalore = "Metro city" with 95+ priority score

MANDATORY DISTRICT ANALYSIS FOR KARNATAKA LOCATIONS:
1. Check if location is in Kodagu district - if YES, classify as "Tourism hub" with 85+ priority score
2. Look for Karnataka hill areas that could be coffee plantation regions
3. Consider proximity to Bangalore/Mysore for weekend tourism classification
4. Halugunda, Bittangala, and similar names in Karnataka are typically in Kodagu district

TOURISM INVESTMENT INDICATORS - Look for these keywords/areas:
- Coorg, Kodagu, Coffee plantations, Hill tourism, Halugunda (Kodagu area)
- Weekend destinations from major cities (especially Bangalore/Mysore vicinity)
- National/State highway connectivity (NH-xx, SH-xx)
- Tourist attractions, resorts, homestays nearby
- Scenic beauty, nature tourism potential in hill districts

2. Safety & Crime Assessment:
   - Research known crime statistics for this area
   - Consider factors like: theft rates, safety for families, women's safety, law enforcement presence
   - Rate safety on 1-10 scale (10 = very safe, 1 = dangerous)

3. Development Stage:
   - developed: Established infrastructure, mature market
   - developing: Active infrastructure projects, growing market
   - underdeveloped: Limited infrastructure, high potential
   - restricted: Legal/environmental restrictions on development

4. Investment Potential (0-100):
   - Metropolitan areas like HSR Layout Bangalore should score 85-95 (premium tech corridors)
   - Consider: future growth prospects, infrastructure development, government projects
   - Factor in: connectivity projects, IT/industrial development, real estate trends
   - Premium residential areas in major metros should score 80+ for investment potential

Respond in this exact JSON format:
{
  "locationType": "one of: metropolitan|city|town|village|rural|uninhabitable",
  "areaClassification": "specific area type from the tiers above (e.g., Metro city, IT park, Smart city)",
  "priorityScore": number between 0-100,
  "safetyScore": number between 1-10,
  "crimeRate": "one of: very-low|low|moderate|high|very-high",
  "developmentStage": "one of: developed|developing|underdeveloped|restricted",
  "investmentPotential": number between 0-100,
  "primaryConcerns": ["list of main concerns"],
  "keyStrengths": ["list of main advantages"],
  "reasoning": "brief explanation of assessment",
  "confidence": number between 0-100
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON response
    try {
      const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const intelligence: LocationIntelligence = JSON.parse(cleanedText);

      // Validate and ensure proper bounds
      intelligence.safetyScore = Math.max(1, Math.min(10, intelligence.safetyScore));
      intelligence.investmentPotential = Math.max(0, Math.min(100, intelligence.investmentPotential));
      intelligence.confidence = Math.max(0, Math.min(100, intelligence.confidence));

      const cacheKey = `location_${lat}_${lng}`;
      locationCache.set(cacheKey, intelligence); // Cache the result
      return intelligence;
    } catch (parseError) {
      console.error('Failed to parse Gemini location intelligence response:', parseError);

      // Fallback based on address keywords
      const fallbackIntelligence = generateFallbackIntelligence(address);
      const cacheKey = `location_${lat}_${lng}`;
      locationCache.set(cacheKey, fallbackIntelligence); // Cache the fallback result
      return fallbackIntelligence;
    }
  } catch (error) {
    console.error('Gemini location intelligence error:', error);
    const fallbackIntelligence = generateFallbackIntelligence(address);
    const cacheKey = `location_${lat}_${lng}`;
    locationCache.set(cacheKey, fallbackIntelligence); // Cache the fallback result
    return fallbackIntelligence;
  }
}

function generateFallbackIntelligence(address: string): LocationIntelligence {
  const addressLower = address.toLowerCase();

  // KODAGU DISTRICT DETECTION - Critical for tourism areas
  const isKodaguDistrict = addressLower.includes('kodagu') || 
                          addressLower.includes('coorg') ||
                          addressLower.includes('halugunda') ||
                          addressLower.includes('bittangala') ||
                          addressLower.includes('virajpet') ||
                          addressLower.includes('madikeri') ||
                          addressLower.includes('kushalnagar') ||
                          addressLower.includes('pollibetta');

  // Enhanced classification based on keywords
  let locationType: LocationIntelligence['locationType'] = 'village';
  let areaClassification = 'Rural village';
  let priorityScore = 35;
  let investmentPotential = 35;
  let safetyScore = 6;

  // KODAGU DISTRICT SPECIAL HANDLING - Takes precedence
  if (isKodaguDistrict) {
    locationType = 'town';
    areaClassification = 'Tourism hub';
    priorityScore = 87; // High priority for Kodagu tourism areas
    investmentPotential = 72; // Good investment potential
    safetyScore = 8; // Generally safe hill district
  } else if (addressLower.includes('hsr') || addressLower.includes('electronic city') || 
      addressLower.includes('whitefield') || addressLower.includes('koramangala')) {
    locationType = 'metropolitan';
    areaClassification = 'Metro city';
    priorityScore = 95;
    investmentPotential = 85;
    safetyScore = 8;
  } else if (addressLower.includes('bengaluru') || addressLower.includes('mumbai') || 
             addressLower.includes('delhi') || addressLower.includes('chennai')) {
    locationType = 'city';
    areaClassification = 'City';
    priorityScore = 75;
    investmentPotential = 65;
    safetyScore = 7;
  } else if (addressLower.includes('village') || addressLower.includes('rural') || 
             (addressLower.includes('road') && !addressLower.includes('main'))) {
    locationType = 'village';
    areaClassification = 'Village';
    priorityScore = 30;
    investmentPotential = 30;
    safetyScore = 7;
  } else {
    // Default urban locality
    areaClassification = 'Urban locality';
    priorityScore = 50;
  }

  return {
    locationType,
    areaClassification,
    priorityScore,
    safetyScore,
    crimeRate: safetyScore >= 7 ? 'low' : safetyScore >= 5 ? 'moderate' : 'high',
    developmentStage: investmentPotential >= 70 ? 'developed' : investmentPotential >= 40 ? 'developing' : 'underdeveloped',
    investmentPotential,
    primaryConcerns: ['Limited AI analysis available'],
    keyStrengths: ['Location assessment based on keywords'],
    reasoning: 'Fallback analysis due to AI service limitations',
    confidence: 60
  };
}

export async function generateInvestmentRecommendations(
  analysisData: AIAnalysisRequest,
  locationIntelligence?: any,
  infrastructureScores?: any
): Promise<string[]> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const actualAmenities = analysisData.nearbyPlaces.map(p => `${p.name} (${p.vicinity || 'local area'})`).join(', ');
    const actualDistances = Object.entries(analysisData.distances)
      .map(([key, data]: [string, any]) => `${key}: ${data.distance?.text || 'N/A'}`)
      .join(', ');

    const prompt = `As a real estate investment expert, analyze this SPECIFIC property investment opportunity using ONLY the actual data provided:

LOCATION: ${analysisData.location.address}
INVESTMENT: ₹${analysisData.amount.toLocaleString()} for ${analysisData.propertyType}

ACTUAL AMENITIES DETECTED WITHIN 5KM:
${actualAmenities || 'Limited amenities detected'}

ACTUAL DISTANCES TO KEY FACILITIES:
${actualDistances || 'Distance data limited'}

${locationIntelligence ? `
LOCATION CHARACTERISTICS:
- Area Type: ${locationIntelligence.areaClassification}
- Development Stage: ${locationIntelligence.developmentStage}
- Safety Score: ${locationIntelligence.safetyScore}/10
- Investment Potential: ${locationIntelligence.investmentPotential}%
- Key Strengths: ${locationIntelligence.keyStrengths?.join(', ')}
- Primary Concerns: ${locationIntelligence.primaryConcerns?.join(', ')}
` : ''}

CRITICAL REQUIREMENTS FOR RECOMMENDATIONS:
1. MUST mention the specific location name (${analysisData.location.address.split(',')[0]}) in each recommendation
2. MUST reference the area's unique characteristics (e.g., if it's Madikeri, mention Coorg tourism; if it's HSR Layout, mention IT hub)
3. Base recommendations ONLY on actual amenities and data detected
4. Be specific about what infrastructure is actually present vs missing
5. Connect the location's known reputation/importance to investment potential
6. Mention specific nearby amenities that were actually found
7. Address the property type (${analysisData.propertyType}) specifically

LOCATION-SPECIFIC CONTEXT:
- If this is in Coorg/Kodagu (Madikeri, Bittangala, etc.), emphasize coffee plantations, tourism, weekend getaways from Bangalore/Mysore
- If this is a tech corridor, mention IT companies and professionals
- If this is a hill station, mention scenic beauty and tourism potential
- If this is highway-adjacent, mention connectivity benefits

Return exactly 3 detailed, location-specific recommendations as plain text lines without numbers or bullets. Each recommendation should be 25-40 words and mention the specific place name.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Split into individual recommendations and clean up
    const recommendations = text
      .split('\n')
      .filter(line => line.trim().length > 10)
      .slice(0, 3)
      .map(rec => rec.trim().replace(/^[-*•\d.]/, '').trim());

    if (recommendations.length >= 3) {
      return recommendations;
    }

    // Generate location-specific fallback based on actual data
    const fallbackRecommendations = [];
    const locationName = analysisData.location.address.split(',')[0];
    const isCoorgArea = analysisData.location.address.toLowerCase().includes('madikeri') || 
                       analysisData.location.address.toLowerCase().includes('coorg') || 
                       analysisData.location.address.toLowerCase().includes('kodagu');
    
    if (actualAmenities.includes('school') || actualAmenities.includes('School')) {
      fallbackRecommendations.push(`${locationName}'s local educational facilities create stable demand from families, particularly beneficial for ${analysisData.propertyType} investments targeting residential buyers`);
    }
    
    if (actualAmenities.includes('bank') || actualAmenities.includes('ATM') || actualAmenities.includes('Bank')) {
      fallbackRecommendations.push(`Banking infrastructure in ${locationName} indicates established financial ecosystem, crucial for smooth property transactions and mortgage accessibility for future buyers`);
    }
    
    if (actualAmenities.includes('market') || actualAmenities.includes('store') || actualAmenities.includes('grocery')) {
      fallbackRecommendations.push(`${locationName}'s local commercial facilities enhance daily convenience, making ${analysisData.propertyType} properties more attractive to potential renters and buyers`);
    }
    
    // Add location-specific context based on area characteristics
    if (isCoorgArea) {
      fallbackRecommendations.push(`${locationName} benefits from Coorg's established tourism industry, creating strong potential for ${analysisData.propertyType} investments targeting weekend rental and homestay markets`);
    } else if (locationIntelligence?.areaClassification) {
      fallbackRecommendations.push(`${locationName} as a ${locationIntelligence.areaClassification} offers ${locationIntelligence.developmentStage} infrastructure with investment potential suited for patient ${analysisData.propertyType} investors`);
    }

    return fallbackRecommendations.slice(0, 3);
  } catch (error) {
    console.error('Gemini API error:', error);
    
    // Generate realistic fallback based on available data
    const safeRecommendations = [];
    const amenityText = analysisData.nearbyPlaces.map(p => p.name).join(', ');
    const locationName = analysisData.location.address.split(',')[0];
    const isCoorgArea = analysisData.location.address.toLowerCase().includes('madikeri') || 
                       analysisData.location.address.toLowerCase().includes('coorg') || 
                       analysisData.location.address.toLowerCase().includes('kodagu');
    
    if (amenityText.includes('school') || amenityText.includes('School')) {
      safeRecommendations.push(`${locationName}'s educational facilities provide stability for long-term residential demand, essential for ${analysisData.propertyType} investment success`);
    } else if (isCoorgArea) {
      safeRecommendations.push(`${locationName} offers scenic Coorg location with tourism potential, ideal for ${analysisData.propertyType} targeting vacation rental markets`);
    } else {
      safeRecommendations.push(`${locationName} presents affordable ${analysisData.propertyType} opportunity with potential for future infrastructure development`);
    }
    
    if (amenityText.includes('bank') || amenityText.includes('market') || amenityText.includes('store')) {
      safeRecommendations.push(`${locationName}'s basic commercial infrastructure supports daily living needs, enhancing ${analysisData.propertyType} rental viability`);
    } else if (isCoorgArea) {
      safeRecommendations.push(`${locationName} in Coorg benefits from regional tourism economy despite limited local amenities, suitable for nature-focused ${analysisData.propertyType} investments`);
    } else {
      safeRecommendations.push(`${locationName} represents emerging area with early ${analysisData.propertyType} investment opportunity before major infrastructure development`);
    }
    
    if (isCoorgArea) {
      safeRecommendations.push(`${locationName}'s position in renowned Coorg tourism belt offers long-term ${analysisData.propertyType} appreciation despite current infrastructure limitations`);
    } else {
      safeRecommendations.push(`${locationName} requires careful consideration of infrastructure development timeline for optimal ${analysisData.propertyType} investment returns`);
    }
    
    return safeRecommendations.slice(0, 3);
  }
}

export async function findTopInvestmentLocations(
  centerLocation: { lat: number; lng: number; address: string },
  radius: number = 10
): Promise<InvestmentLocation[]> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `As a real estate investment expert, identify the top 3 investment locations within ${radius}km of ${centerLocation.address}.

Focus on areas with:
- High growth potential for property appreciation
- Strong infrastructure development
- Commercial and business growth
- Educational institutions nearby
- Transportation connectivity
- Emerging neighborhoods with investment potential

For each location, provide:
1. Specific area/locality name with full address
2. Investment score (1-100)
3. Distance from the reference location
4. Detailed reasoning for investment potential

Format as JSON array:
[
  {
    "address": "Specific locality name, City, State",
    "lat": 12.34567,
    "lng": 77.89012,
    "score": 85,
    "reasoning": "Detailed investment reasoning",
    "distance": "5.2 km"
  }
]`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    try {
      // Extract JSON from response text more robustly
      let cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Find the first [ and last ] to extract just the JSON array
      const startIdx = cleanedText.indexOf('[');
      const endIdx = cleanedText.lastIndexOf(']');
      
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        cleanedText = cleanedText.substring(startIdx, endIdx + 1);
      }
      
      const locations = JSON.parse(cleanedText);
      return locations;
    } catch (parseError) {
      console.error('Failed to parse investment locations response:', parseError);
      return [];
    }
  } catch (error) {
    console.error('Gemini API error for investment locations:', error);
    return [];
  }
}

export async function findNearbyTouristAttractions(
  centerLocation: { lat: number; lng: number; address: string }
): Promise<Array<{
  name: string;
  description: string;
  category: string;
  rating: number;
  distance: string;
  why_visit: string;
  imageUrl?: string;
}>> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `As a tourism expert, find the top 3 most popular and interesting tourist attractions, visiting places, and recreational spots within 100km of ${centerLocation.address}.

Focus on:
- Famous temples, historical monuments, and religious sites
- Natural attractions like waterfalls, hills, lakes, parks
- Cultural sites, museums, art galleries
- Adventure spots, trekking areas, scenic viewpoints
- Popular tourist destinations that people actually visit for sightseeing
- Entertainment venues like amusement parks, zoos, aquariums

Avoid:
- Regular shops, malls, restaurants, cafes
- Hospitals, schools, banks
- Ordinary business establishments
- Residential areas

For each attraction, provide:
1. Name of the place
2. Brief description (what makes it special)
3. Category (temple/monument/natural/cultural/adventure/entertainment)
4. Estimated rating (1-5 stars)
5. Approximate distance from location
6. Why tourists visit this place

Format as JSON array:
[
  {
    "name": "Place Name",
    "description": "Brief description",
    "category": "temple/monument/natural/cultural/adventure/entertainment",
    "rating": 4.5,
    "distance": "25 km",
    "why_visit": "Reason tourists visit",
    "imageUrl": "https://example.com/image.jpg"
  }
]`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    try {
      // Extract JSON from response text more robustly
      let cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Find the first [ and last ] to extract just the JSON array
      const startIdx = cleanedText.indexOf('[');
      const endIdx = cleanedText.lastIndexOf(']');
      
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        cleanedText = cleanedText.substring(startIdx, endIdx + 1);
      }
      
      const attractions = JSON.parse(cleanedText);
      return attractions;
    } catch (parseError) {
      console.error('Failed to parse Gemini tourist attraction response:', parseError, text);
      return [];
    }
  } catch (error) {
    console.error('Gemini API error:', error);
    return [];
  }
}

export async function validateMajorTransportInfrastructure(
  location: { lat: number; lng: number; address: string }
): Promise<{ hasMajorInfrastructure: boolean; infrastructureFound: string[]; reasoning: string }> {
  try {
    const model = genai.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `Analyze the major transport infrastructure within 5km radius of this location: ${location.address} (${location.lat}, ${location.lng}).

MANDATORY INFRASTRUCTURE CHECK - For location scores above 4.5/5, check if ANY of these exist within 5km:

MAJOR TRANSPORT INFRASTRUCTURE:
1. National Highway (NH) or State Highway (SH)
2. Airport (domestic/international)
3. Railway station (major/minor)
4. Harbor/Port facilities
5. Helipad/Helicopter landing facilities
6. Metro/Subway stations
7. Major bus terminals/ISBT
8. Expressway/Toll road access
9. Industrial transport hubs
10. Logistics/freight corridors

ANALYSIS REQUIREMENTS:
- Search within exactly 5km radius
- Only count MAJOR infrastructure (not local roads)
- Provide specific names and distances
- Be strict - if no major infrastructure exists, return false

Return JSON format:
{
  "hasMajorInfrastructure": true/false,
  "infrastructureFound": ["specific names with distances"],
  "reasoning": "detailed explanation of findings within 5km"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    try {
      let cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      const startIdx = cleanedText.indexOf('{');
      const endIdx = cleanedText.lastIndexOf('}');
      
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        cleanedText = cleanedText.substring(startIdx, endIdx + 1);
      }
      
      const infrastructureData = JSON.parse(cleanedText);
      return infrastructureData;
    } catch (parseError) {
      console.error('Failed to parse infrastructure validation:', parseError);
      return {
        hasMajorInfrastructure: false,
        infrastructureFound: [],
        reasoning: "Failed to analyze infrastructure data"
      };
    }
  } catch (error) {
    console.error('Error validating major transport infrastructure:', error);
    return {
      hasMajorInfrastructure: false,
      infrastructureFound: [],
      reasoning: "Error occurred during infrastructure analysis"
    };
  }
}

export async function analyzeInfrastructureWithAI(
  location: { lat: number; lng: number; address: string },
  locationIntelligence?: LocationIntelligence
): Promise<{
  detectedAmenities: Array<{
    name: string;
    vicinity: string;
    types: string[];
    rating?: number;
    estimatedDistance: string;
    estimatedDistanceMeters: number;
    estimatedTravelTime: string;
  }>;
  infrastructureSummary: string;
  confidence: number;
} | null> {
  try {
    const prompt = `
INFRASTRUCTURE ANALYSIS TASK:
Analyze the location: ${location.address} (${location.lat}, ${location.lng})

${locationIntelligence ? `
LOCATION CONTEXT:
- Area Type: ${locationIntelligence.areaClassification}
- Development Stage: ${locationIntelligence.developmentStage}
- Key Strengths: ${locationIntelligence.keyStrengths.join(', ')}
- Primary Concerns: ${locationIntelligence.primaryConcerns.join(', ')}
` : ''}

TASK: Identify ALL infrastructure and amenities within 5km radius of this location.

For a ${locationIntelligence?.areaClassification || 'residential area'} in ${location.address.split(',').slice(-2).join(',')}, systematically identify:

ESSENTIAL SERVICES (within 5km):
- Hospitals, clinics, pharmacies, medical centers
- Banks, ATMs, post offices
- Grocery stores, supermarkets, local markets
- Gas stations, vehicle services

EDUCATION & TRANSPORT (within 5km):
- Schools (primary, secondary), colleges, universities
- Bus stops, bus stations, railway stations
- Local transport hubs, auto-rickshaw stands

TOURISM & HIGHWAY INFRASTRUCTURE (CRITICAL FOR COORG AREAS):
- Tourist attractions, viewpoints, coffee plantations
- Hotels, resorts, homestays, guest houses
- Restaurants, cafes, local eateries
- National/State highways (NH-275, SH-90, etc.)
- Tourist information centers, travel agencies
- Adventure sports facilities, trekking points
- Religious sites, temples, churches
- Shopping areas, souvenir shops, local crafts

COMMERCIAL & LIFESTYLE (within 5km):
- Shops, shopping areas, commercial complexes
- Restaurants, cafes, food establishments
- Parks, recreation areas, community centers

For each amenity found, provide:
1. name - Specific name or generic type (e.g., "Local Primary School", "Community Health Center")
2. vicinity - Area/locality name where it's located
3. types - Array of relevant categories (e.g., ["school"], ["hospital"], ["bank"])
4. rating - Realistic rating 3.0-4.5 for local facilities
5. estimatedDistance - Distance text (e.g., "1.2 km", "3.5 km")
6. estimatedDistanceMeters - Distance in meters (1200, 3500)
7. estimatedTravelTime - Travel time (e.g., "3 min", "8 min")

IMPORTANT: Even in rural/suburban areas, there are typically:
- At least 1-2 schools within 5km
- Basic medical facilities (clinic/pharmacy)
- Local shops and markets
- Some form of public transport access
- Community services

Return ONLY valid JSON:
{
  "detectedAmenities": [
    {
      "name": "...",
      "vicinity": "...",
      "types": ["..."],
      "rating": 3.8,
      "estimatedDistance": "2.1 km",
      "estimatedDistanceMeters": 2100,
      "estimatedTravelTime": "5 min"
    }
  ],
  "infrastructureSummary": "Brief summary of infrastructure quality",
  "confidence": 85
}
`;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean and parse the response more robustly
    let cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Find the first { and last } to extract just the JSON object
    const startIdx = cleanedText.indexOf('{');
    const endIdx = cleanedText.lastIndexOf('}');
    
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      cleanedText = cleanedText.substring(startIdx, endIdx + 1);
    }
    
    const analysis = JSON.parse(cleanedText);
    
    if (analysis && analysis.detectedAmenities && Array.isArray(analysis.detectedAmenities)) {
      return analysis;
    }
    
    return null;
  } catch (error) {
    console.error('Error analyzing infrastructure with AI:', error);
    return null;
  }
}