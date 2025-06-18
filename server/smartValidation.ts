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
    // Only check if location is in restricted areas
    const locationIssues = await checkLocationViability(data.location);
    
    return {
      isValid: locationIssues.length === 0,
      issues: locationIssues,
      recommendations: [],
      riskLevel: locationIssues.length > 0 ? 'high' : 'low',
      confidence: locationIssues.length === 0 ? 95 : 85
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
    
    // Forests and protected areas - more specific
    const forestKeywords = [
      'dense forest', 'deep jungle', 'national park entrance', 'wildlife sanctuary',
      'forest reserve', 'tiger reserve', 'nature reserve area', 'protected forest',
      'conservation area', 'biodiversity hotspot', 'ecological reserve', 'wetland area',
      'mangrove forest', 'rainforest area', 'woodland reserve'
    ];
    
    // Government and military areas - more specific keywords
    const governmentKeywords = [
      'military base', 'army cantonment', 'naval base', 'air force station', 'defense facility',
      'restricted area', 'prohibited zone', 'military headquarters',
      'embassy compound', 'consulate general', 'high security zone',
      'ministry complex', 'parliament house', 'capitol building', 'government secretariat'
    ];

    // Desert/uninhabitable areas - check before analysis
    const desertKeywords = [
      'sahara desert', 'grand canyon national park', 'death valley national park',
      'mojave desert', 'badlands national park', 'monument valley tribal park',
      'antarctica', 'middle of ocean', 'arctic circle', 'uninhabited island',
      'desert wasteland', 'barren land'
    ];
    
    // Check for water bodies
    const foundWater = waterKeywords.find(keyword => addressLower.includes(keyword));
    if (foundWater) {
      issues.push(`This location is in/near a water body (${foundWater}). Property development is not possible here.`);
    }
    
    // Check for forests/protected areas
    const foundForest = forestKeywords.find(keyword => addressLower.includes(keyword));
    if (foundForest) {
      issues.push(`This location is in a protected/forest area (${foundForest}). Property development is restricted here.`);
    }
    
    // Check for government/military areas
    const foundGovernment = governmentKeywords.find(keyword => addressLower.includes(keyword));
    if (foundGovernment) {
      issues.push(`This location is in a government/military area (${foundGovernment}). Property development is restricted here.`);
    }

    // Check for desert/uninhabitable areas
    const foundDesert = desertKeywords.find(keyword => addressLower.includes(keyword));
    if (foundDesert) {
      issues.push(`This location appears to be in an uninhabitable area (${foundDesert}). No infrastructure or amenities available for property development.`);
    }

    // Advanced infrastructure check via Google Places API
    if (process.env.GOOGLE_MAPS_API_KEY && !foundDesert) {
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