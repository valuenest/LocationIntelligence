interface ValidationRequest {
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  propertyData: {
    amount: number;
    propertyType: string;
    currency?: string;
    country?: string;
    propertySize?: number;
    sizeUnit?: string;
    propertyAge?: string;
    bedrooms?: number;
    furnished?: string;
    floor?: string;
    parkingSpaces?: number;
  };
}

interface ValidationResult {
  isValid: boolean;
  issues: string[];
  recommendations: string[];
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number;
}

export async function performSmartValidation(data: ValidationRequest): Promise<ValidationResult> {
  try {
    // First, check basic keyword-based validation
    const locationIssues = await checkLocationViability(data.location);
    
    // If basic validation finds issues, return them
    if (locationIssues.length > 0) {
      return {
        isValid: false,
        issues: locationIssues,
        recommendations: [],
        riskLevel: 'high',
        confidence: 85
      };
    }
    
    // If basic validation passes, check if location needs AI validation
    // Only use AI for potentially problematic locations (institutional keywords)
    const needsAIValidation = data.location.address.toLowerCase().includes('school') ||
                             data.location.address.toLowerCase().includes('college') ||
                             data.location.address.toLowerCase().includes('hospital') ||
                             data.location.address.toLowerCase().includes('university') ||
                             data.location.address.toLowerCase().includes('campus') ||
                             data.location.address.toLowerCase().includes('playground') ||
                             data.location.address.toLowerCase().includes('stadium') ||
                             data.location.address.toLowerCase().includes('park') ||
                             data.location.address.toLowerCase().includes('government');
    
    if (needsAIValidation) {
      const aiValidation = await performAILocationValidation(data.location, data.propertyData);
      return aiValidation;
    }
    
    // For regular locations (roads, residential areas), allow through
    return {
      isValid: true,
      issues: [],
      recommendations: [],
      riskLevel: 'low',
      confidence: 95
    };
  } catch (error) {
    console.error('Smart validation error:', error);
    return {
      isValid: true,
      issues: [],
      recommendations: [],
      riskLevel: 'low',
      confidence: 0
    };
  }
}

async function checkLocationViability(location: { lat: number; lng: number; address: string }) {
  try {
    const issues: string[] = [];
    
    // Check address for restricted area keywords
    const addressLower = location.address.toLowerCase();
    
    // Water bodies - more specific to avoid false positives
    const waterKeywords = [
      'in the river', 'middle of lake', 'ocean floor', 'sea bed', 'bay area', 'creek bed',
      'river bed', 'lake shore', 'ocean view', 'sea front', 'harbor area', 'marina complex',
      'dam reservoir', 'estuary mouth', 'lagoon center'
    ];
    
    // Enhanced forest and protected area detection
    const forestKeywords = [
      'national park', 'national forest', 'wildlife sanctuary', 'nature reserve', 
      'forest reserve', 'tiger reserve', 'protected forest', 'conservation area',
      'biodiversity park', 'ecological reserve', 'wetland', 'mangrove',
      'rainforest', 'woodland', 'jungle', 'safari park', 'game reserve',
      'biosphere reserve', 'world heritage site', 'unesco site'
    ];
    
    // Government and military areas
    const governmentKeywords = [
      'military', 'army', 'naval', 'air force', 'defense', 'cantonment',
      'restricted area', 'prohibited zone', 'security zone', 'base',
      'embassy', 'consulate', 'parliament', 'capitol', 'secretariat',
      'ministry', 'government complex'
    ];

    // Enhanced desert and uninhabitable area detection
    const uninhabitableKeywords = [
      'desert', 'canyon', 'grand canyon', 'death valley', 'badlands', 'monument valley',
      'antarctica', 'arctic', 'sahara', 'mojave', 'gobi', 'kalahari',
      'uninhabited', 'barren', 'wasteland', 'glacier', 'iceberg', 'ice sheet',
      'mountain peak', 'volcano', 'crater', 'polar', 'tundra', 'permafrost',
      'wilderness area', 'remote forest', 'deep jungle', 'outback'
    ];

    // Water body detection
    const waterBodyKeywords = [
      'ocean', 'sea', 'lake', 'river', 'bay', 'harbor', 'marina',
      'reservoir', 'dam', 'waterfall', 'rapids', 'estuary', 'lagoon',
      'creek', 'stream', 'pond', 'marsh', 'swamp'
    ];
    
    // Check for all water bodies (original + enhanced)
    const allWaterKeywords = [...waterKeywords, ...waterBodyKeywords];
    const foundWater = allWaterKeywords.find(keyword => addressLower.includes(keyword));
    if (foundWater) {
      issues.push(`This location is in/near a water body (${foundWater}). Property development is not possible here.`);
    }
    
    // Check for forests/protected areas with enhanced detection
    const foundForest = forestKeywords.find(keyword => addressLower.includes(keyword));
    if (foundForest) {
      issues.push(`This location is in a protected/forest area (${foundForest}). Property development is restricted here.`);
    }
    
    // Check for government/military areas
    const foundGovernment = governmentKeywords.find(keyword => addressLower.includes(keyword));
    if (foundGovernment) {
      issues.push(`This location is in a government/military area (${foundGovernment}). Property development is restricted here.`);
    }

    // Check for desert/uninhabitable areas with enhanced detection
    const foundUninhabitable = uninhabitableKeywords.find(keyword => addressLower.includes(keyword));
    if (foundUninhabitable) {
      issues.push(`This location appears to be in an uninhabitable area (${foundUninhabitable}). No infrastructure or amenities available for property development.`);
    }

    // Advanced infrastructure check via Google Places API
    if (process.env.GOOGLE_MAPS_API_KEY && !foundUninhabitable) {
      try {
        // Quick check for nearby places to detect truly remote locations
        const nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=5000&type=establishment&key=${process.env.GOOGLE_MAPS_API_KEY}`;
        
        const response = await fetch(nearbyUrl);
        const data = await response.json();
        
        if (data.status === 'OK') {
          const nearbyPlaces = data.results || [];
          
          // If less than 3 establishments within 5km, it's likely uninhabitable
          if (nearbyPlaces.length < 3) {
            // Check if it's in India (allow rural Indian locations)
            const isInIndia = addressLower.includes('india') || 
                             addressLower.includes('karnataka') || 
                             addressLower.includes('kerala') || 
                             addressLower.includes('tamil nadu') ||
                             addressLower.includes('maharashtra') ||
                             addressLower.includes('gujarat') ||
                             addressLower.includes('rajasthan');
            
            if (!isInIndia) {
              issues.push(`This location appears to be in a remote area with no nearby infrastructure. Found only ${nearbyPlaces.length} establishments within 5km radius. Property development may not be viable due to lack of essential services.`);
            }
          }
        }
        
        // Rate limiting to avoid quota issues
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error('Infrastructure check error:', error);
        // Don't add issues if API check fails
      }
    }
    
    return issues;
    
  } catch (error) {
    console.error('Location viability check error:', error);
    return [];
  }
}

async function performAILocationValidation(
  location: { lat: number; lng: number; address: string },
  propertyData: any
): Promise<ValidationResult> {
  try {
    // Import Gemini AI
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    
    if (!process.env.GEMINI_API_KEY) {
      console.log('Gemini API key not available, skipping AI validation');
      return {
        isValid: true,
        issues: [],
        recommendations: [],
        riskLevel: 'low',
        confidence: 50
      };
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Analyze this location for property development suitability:

Location: ${location.address}
Coordinates: ${location.lat}, ${location.lng}
Property Type: ${propertyData.propertyType}
Investment Amount: ${propertyData.amount} ${propertyData.currency || 'USD'}

CRITICAL VALIDATION CRITERIA - ONLY FLAG THESE SPECIFIC ISSUES:

1. INSTITUTIONAL PREMISES: Schools, colleges, universities, hospitals within their campus boundaries
2. PUBLIC FACILITIES: Playgrounds, parks, sports stadiums, government buildings
3. PROTECTED AREAS: National parks, wildlife sanctuaries, restricted military zones
4. UNINHABITABLE: Deserts, deep water bodies, extreme remote areas with zero infrastructure

DO NOT flag general rural areas, roads, or locations just because they lack detailed information.
DO NOT require "on-site verification" for normal property locations.
ONLY flag if you can clearly identify it as one of the 4 categories above.

RESPOND WITH THIS EXACT JSON FORMAT:
{
  "isValid": boolean,
  "issues": ["specific issue 1", "specific issue 2"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "riskLevel": "low|medium|high",
  "confidence": number (0-100),
  "locationCategory": "residential|commercial|institutional|public|restricted|unsuitable",
  "developmentViability": "excellent|good|fair|poor|impossible",
  "specificConcerns": ["concern 1", "concern 2"]
}

BE PERMISSIVE: If location appears to be a normal road, residential area, or commercial zone - mark as VALID.
ONLY block obvious institutional/public/protected/uninhabitable areas.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid AI response format');
    }

    const aiAnalysis = JSON.parse(jsonMatch[0]);

    // Convert AI analysis to ValidationResult format
    // Only block if clearly identified as problematic (confidence > 70 and truly unsuitable)
    const shouldBlock = aiAnalysis.developmentViability === 'impossible' || 
                       (aiAnalysis.confidence > 70 && 
                        aiAnalysis.locationCategory === 'institutional' || 
                        aiAnalysis.locationCategory === 'public' || 
                        aiAnalysis.locationCategory === 'restricted' ||
                        aiAnalysis.locationCategory === 'unsuitable');
    
    return {
      isValid: !shouldBlock,
      issues: shouldBlock ? (aiAnalysis.issues || []) : [],
      recommendations: shouldBlock ? (aiAnalysis.recommendations || []) : [],
      riskLevel: shouldBlock ? 'high' : 'low',
      confidence: aiAnalysis.confidence || 75
    };

  } catch (error) {
    console.error('AI validation error:', error);
    // Fallback to permissive validation if AI fails
    return {
      isValid: true,
      issues: [],
      recommendations: ['AI validation unavailable - manual review recommended'],
      riskLevel: 'medium',
      confidence: 30
    };
  }
}