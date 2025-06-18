import { GoogleGenerativeAI } from '@google/generative-ai';

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

export async function analyzeLocationIntelligence(
  address: string,
  lat: number,
  lng: number
): Promise<LocationIntelligence> {
  try {
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
      
      return intelligence;
    } catch (parseError) {
      console.error('Failed to parse Gemini location intelligence response:', parseError);
      
      // Fallback based on address keywords
      return generateFallbackIntelligence(address);
    }
  } catch (error) {
    console.error('Gemini location intelligence error:', error);
    return generateFallbackIntelligence(address);
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
      
      // Add Google Street View images for attractions that don't have imageUrl
      const enhancedAttractions = Array.isArray(attractions) ? attractions.slice(0, 3).map((attraction: any, index: number) => {
        if (!attraction.imageUrl) {
          // Generate approximate coordinates for the attraction (within 50km of center)
          const offsetLat = (Math.random() - 0.5) * 0.8;
          const offsetLng = (Math.random() - 0.5) * 0.8;
          const attractionLat = centerLocation.lat + offsetLat;
          const attractionLng = centerLocation.lng + offsetLng;
          
          attraction.imageUrl = `https://maps.googleapis.com/maps/api/streetview?size=400x300&location=${attractionLat},${attractionLng}&heading=${Math.floor(Math.random() * 360)}&pitch=0&key=${process.env.GOOGLE_MAPS_API_KEY}`;
        }
        return attraction;
      }) : [];
      
      return enhancedAttractions;
    } catch (parseError) {
      console.error('Failed to parse tourist attractions response:', parseError);
      
      // Fallback tourist attractions based on location
      const addressLower = centerLocation.address.toLowerCase();
      
      if (addressLower.includes('karnataka') || addressLower.includes('bangalore')) {
        return [
          {
            name: "Nandi Hills",
            description: "Ancient hill fortress with stunning sunrise views and historical significance",
            category: "natural",
            rating: 4.2,
            distance: "60 km",
            why_visit: "Famous for sunrise views, trekking, and historical Tipu Sultan's fort",
            imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop"
          },
          {
            name: "Bangalore Palace",
            description: "Tudor-style architectural marvel inspired by Windsor Castle",
            category: "monument",
            rating: 4.0,
            distance: "45 km",
            why_visit: "Royal architecture, vintage car collection, and cultural heritage",
            imageUrl: "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=400&h=300&fit=crop"
          },
          {
            name: "Cubbon Park",
            description: "Large green lung of the city with botanical gardens and walking trails",
            category: "natural",
            rating: 4.1,
            distance: "50 km",
            why_visit: "Nature walks, jogging, photography, and peaceful environment",
            imageUrl: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=300&fit=crop"
          }
        ];
      }
      
      // Generic fallback for other locations
      return [
        {
          name: "Regional Heritage Site",
          description: "Local historical monument with cultural significance",
          category: "monument",
          rating: 3.8,
          distance: "30 km",
          why_visit: "Cultural heritage and historical importance",
          imageUrl: "https://images.unsplash.com/photo-1539650116574-75c0c6d73925?w=400&h=300&fit=crop"
        },
        {
          name: "Natural Park/Garden",
          description: "Local recreational area with natural beauty",
          category: "natural",
          rating: 3.5,
          distance: "25 km",
          why_visit: "Nature walks and family recreation",
          imageUrl: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=300&fit=crop"
        },
        {
          name: "Local Temple/Religious Site",
          description: "Regional place of worship with architectural beauty",
          category: "temple",
          rating: 4.0,
          distance: "20 km",
          why_visit: "Spiritual significance and traditional architecture",
          imageUrl: "https://images.unsplash.com/photo-1548013146-72479768bada?w=400&h=300&fit=crop"
        }
      ];
    }
  } catch (error) {
    console.error('Gemini API error for tourist attractions:', error);
    
    // Fallback attractions
    return [
      {
        name: "Heritage Monument",
        description: "Historical site with cultural significance",
        category: "monument",
        rating: 3.8,
        distance: "35 km",
        why_visit: "Historical and cultural importance",
        imageUrl: "https://images.unsplash.com/photo-1539650116574-75c0c6d73925?w=400&h=300&fit=crop"
      },
      {
        name: "Nature Reserve",
        description: "Natural area for recreation and sightseeing",
        category: "natural",
        rating: 3.6,
        distance: "40 km", 
        why_visit: "Natural beauty and wildlife observation",
        imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop"
      },
      {
        name: "Cultural Center",
        description: "Local cultural and artistic hub",
        category: "cultural",
        rating: 3.5,
        distance: "30 km",
        why_visit: "Art exhibitions and cultural events",
        imageUrl: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=400&h=300&fit=crop"
      }
    ];
  }
}

export async function findTopInvestmentLocations(
  centerLocation: { lat: number; lng: number; address: string },
  propertyType: string,
  budget: number
): Promise<InvestmentLocation[]> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `As a real estate investment expert, suggest 3 specific cities or major investment locations within 50km of ${centerLocation.address}.

Consider:
- Property Type: ${propertyType}
- Budget: ₹${budget.toLocaleString()}
- Distance from current location: ${centerLocation.address}

For each location, provide:
1. Specific city/major area name (not just localities)
2. Brief reasoning for investment potential
3. Approximate distance from the center location

Focus on cities/areas with:
- Major infrastructure development
- Metro/highway connectivity
- Commercial and IT growth potential
- Government development projects
- Industrial corridors

Format as: City/Area Name | Reasoning | Distance`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse the response into structured data
    const locations: InvestmentLocation[] = [];
    const lines = text.split('\n').filter(line => line.includes('|') && line.trim().length > 10);

    for (let i = 0; i < Math.min(3, lines.length); i++) {
      const parts = lines[i].split('|').map(p => p.trim());
      if (parts.length >= 3) {
        // Generate approximate coordinates (this would ideally use geocoding)
        const offsetLat = (Math.random() - 0.5) * 0.8; // ~50km range
        const offsetLng = (Math.random() - 0.5) * 0.4;
        
        locations.push({
          address: parts[0],
          lat: centerLocation.lat + offsetLat,
          lng: centerLocation.lng + offsetLng,
          score: 75 + Math.random() * 20, // Random score between 75-95
          reasoning: parts[1],
          distance: parts[2],
          imageUrl: `https://maps.googleapis.com/maps/api/staticmap?center=${centerLocation.lat + offsetLat},${centerLocation.lng + offsetLng}&zoom=15&size=300x200&maptype=roadmap&markers=color:blue%7C${centerLocation.lat + offsetLat},${centerLocation.lng + offsetLng}&key=${process.env.GOOGLE_MAPS_API_KEY}`
        });
      }
    }

    // Fallback if parsing fails
    if (locations.length === 0) {
      const fallbackAreas = [
        'Electronic City Phase 2',
        'Whitefield Extension',
        'Sarjapur Road Corridor'
      ];

      fallbackAreas.forEach((area, index) => {
        const offsetLat = (Math.random() - 0.5) * 0.3;
        const offsetLng = (Math.random() - 0.5) * 0.3;
        
        locations.push({
          address: area,
          lat: centerLocation.lat + offsetLat,
          lng: centerLocation.lng + offsetLng,
          score: 80 + Math.random() * 15,
          reasoning: 'Strong infrastructure development and connectivity options',
          distance: `${(15 + Math.random() * 10).toFixed(1)} km`,
          imageUrl: `https://maps.googleapis.com/maps/api/staticmap?center=${centerLocation.lat + offsetLat},${centerLocation.lng + offsetLng}&zoom=15&size=300x200&maptype=roadmap&markers=color:blue%7C${centerLocation.lat + offsetLat},${centerLocation.lng + offsetLng}&key=${process.env.GOOGLE_MAPS_API_KEY}`
        });
      });
    }

    return locations.slice(0, 3);
  } catch (error) {
    console.error('Gemini API error for location suggestions:', error);
    
    // Fallback locations
    return [
      {
        address: 'Electronic City Phase 2',
        lat: centerLocation.lat + 0.1,
        lng: centerLocation.lng + 0.1,
        score: 85,
        reasoning: 'Major IT hub with excellent infrastructure and appreciation potential',
        distance: '18 km'
      },
      {
        address: 'Sarjapur Road Corridor',
        lat: centerLocation.lat - 0.08,
        lng: centerLocation.lng + 0.12,
        score: 82,
        reasoning: 'Upcoming metro connectivity and commercial development projects',
        distance: '22 km'  
      },
      {
        address: 'Whitefield Extension',
        lat: centerLocation.lat + 0.15,
        lng: centerLocation.lng - 0.05,
        score: 78,
        reasoning: 'Growing residential demand with proximity to tech parks',
        distance: '24 km'
      }
    ];
  }
}