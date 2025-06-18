import { GoogleGenerativeAI } from '@googleGenerativeAI';

const genAI = new GoogleGenerativeAI('AIzaSyCEetXKsgKVA4KB5v-XhjY6cCfl9UZNK6w');

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

1. Location Type Classification:
   - metropolitan: Major city centers with metro/IT hubs (Mumbai, Delhi NCR, Bangalore tech areas)
   - city: Tier 1/2 cities with good infrastructure (Pune, Chennai, Hyderabad suburbs)
   - town: Smaller urban centers with basic amenities (district headquarters, growing suburbs)
   - village: Rural areas with limited infrastructure
   - rural: Agricultural/remote areas with minimal development
   - uninhabitable: Forests, water bodies, deserts, restricted military/government zones

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
   - Consider: future growth prospects, infrastructure development, government projects
   - Factor in: connectivity projects, IT/industrial development, real estate trends

Respond in this exact JSON format:
{
  "locationType": "one of: metropolitan|city|town|village|rural|uninhabitable",
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

      locationCache.set(cacheKey, intelligence); // Cache the result
      return intelligence;
    } catch (parseError) {
      console.error('Failed to parse Gemini location intelligence response:', parseError);

      // Fallback based on address keywords
      const fallbackIntelligence = generateFallbackIntelligence(address);
      locationCache.set(cacheKey, fallbackIntelligence); // Cache the fallback result
      return fallbackIntelligence;
    }
  } catch (error) {
    console.error('Gemini location intelligence error:', error);
    const fallbackIntelligence = generateFallbackIntelligence(address);
    locationCache.set(cacheKey, fallbackIntelligence); // Cache the fallback result
    return fallbackIntelligence;
  }
}

function generateFallbackIntelligence(address: string): LocationIntelligence {
  const addressLower = address.toLowerCase();

  // Basic classification based on keywords
  let locationType: LocationIntelligence['locationType'] = 'village';
  let investmentPotential = 35;
  let safetyScore = 6;

  if (addressLower.includes('hsr') || addressLower.includes('electronic city') || 
      addressLower.includes('whitefield') || addressLower.includes('koramangala')) {
    locationType = 'metropolitan';
    investmentPotential = 85;
    safetyScore = 8;
  } else if (addressLower.includes('bengaluru') || addressLower.includes('mumbai') || 
             addressLower.includes('delhi') || addressLower.includes('chennai')) {
    locationType = 'city';
    investmentPotential = 65;
    safetyScore = 7;
  } else if (addressLower.includes('village') || addressLower.includes('rural') || 
             addressLower.includes('road') && !addressLower.includes('main')) {
    locationType = 'village';
    investmentPotential = 30;
    safetyScore = 7;
  }

  return {
    locationType,
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
  analysisData: AIAnalysisRequest
): Promise<string[]> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `As a real estate investment expert, analyze this property investment opportunity:

Location: ${analysisData.location.address}
Investment Amount: ₹${analysisData.amount.toLocaleString()}
Property Type: ${analysisData.propertyType}

Nearby Places: ${analysisData.nearbyPlaces.map(p => `${p.name} (${p.vicinity})`).join(', ')}

Key Distances: ${Object.entries(analysisData.distances).map(([key, data]: [string, any]) => 
  `${key}: ${data.distance?.text || 'N/A'}`).join(', ')}

Provide exactly 3 specific, actionable investment recommendations for this property location. Each recommendation should be one clear sentence explaining why this location is good for investment. Focus on growth potential, infrastructure development, and market trends.

Format as a simple list without numbering or bullet points.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Split into individual recommendations and clean up
    const recommendations = text
      .split('\n')
      .filter(line => line.trim().length > 10)
      .slice(0, 3)
      .map(rec => rec.trim().replace(/^[-*•]/, '').trim());

    return recommendations.length >= 3 ? recommendations : [
      'Strong infrastructure connectivity with metro and highway access increases property appreciation potential',
      'Growing commercial development in the area indicates rising property demand and rental yields',
      'Proximity to educational institutions and healthcare facilities ensures consistent tenant demand'
    ];
  } catch (error) {
    console.error('Gemini API error:', error);
    // Fallback recommendations
    return [
      'Strong infrastructure connectivity with metro and highway access increases property appreciation potential',
      'Growing commercial development in the area indicates rising property demand and rental yields',
      'Proximity to educational institutions and healthcare facilities ensures consistent tenant demand'
    ];
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
      const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
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
`