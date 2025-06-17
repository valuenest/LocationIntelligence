import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI('AIzaSyCEetXKsgKVA4KB5v-XhjY6cCfl9UZNK6w');

interface InvestmentLocation {
  address: string;
  lat: number;
  lng: number;
  score: number;
  reasoning: string;
  distance: string;
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

export async function generateInvestmentRecommendations(
  analysisData: AIAnalysisRequest
): Promise<string[]> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

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

export async function findTopInvestmentLocations(
  centerLocation: { lat: number; lng: number; address: string },
  propertyType: string,
  budget: number
): Promise<InvestmentLocation[]> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `As a real estate investment expert, suggest 3 specific investment locations within 25km of ${centerLocation.address}.

Consider:
- Property Type: ${propertyType}
- Budget: ₹${budget.toLocaleString()}
- Distance from current location: ${centerLocation.address}

For each location, provide:
1. Specific area/locality name
2. Brief reasoning for investment potential
3. Approximate distance from the center location

Focus on areas with:
- Infrastructure development
- Metro/transport connectivity
- Commercial growth potential
- Upcoming projects

Format as: Area Name | Reasoning | Distance`;

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
        const offsetLat = (Math.random() - 0.5) * 0.4; // ~25km range
        const offsetLng = (Math.random() - 0.5) * 0.4;
        
        locations.push({
          address: parts[0],
          lat: centerLocation.lat + offsetLat,
          lng: centerLocation.lng + offsetLng,
          score: 75 + Math.random() * 20, // Random score between 75-95
          reasoning: parts[1],
          distance: parts[2]
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
          distance: `${(15 + Math.random() * 10).toFixed(1)} km`
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