import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_MAPS_API_KEY || "");

interface ValidationRequest {
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  propertyData: {
    amount: number;
    propertyType: string;
    currency: string;
    country: string;
    propertySize: number;
    sizeUnit: string;
    propertyAge: string;
    bedrooms: number;
    furnished: string;
    floor: string;
    parkingSpaces: number;
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
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // First, check location viability using Google Places
    const locationCheck = await checkLocationViability(data.location);
    
    // Then validate property type compatibility with location
    const typeCheck = await validatePropertyTypeCompatibility(data);
    
    // Combine all validation results
    const validationResult = await performComprehensiveValidation(data, locationCheck, typeCheck);
    
    return validationResult;
  } catch (error) {
    console.error('Smart validation error:', error);
    return {
      isValid: true, // Default to allow if validation fails
      issues: [],
      recommendations: [],
      riskLevel: 'low',
      confidence: 0
    };
  }
}

async function checkLocationViability(location: { lat: number; lng: number; address: string }) {
  try {
    // Use Google Places API to check what type of location this is
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=100&key=${process.env.GOOGLE_MAPS_API_KEY}`
    );
    
    const data = await response.json();
    
    // Check for water bodies, forests, government areas, etc.
    const unbuildableTypes = [
      'natural_feature', 'park', 'campground', 'rv_park', 
      'national_park', 'zoo', 'aquarium', 'cemetery',
      'establishment', 'political' // Government buildings/areas
    ];
    
    const governmentRestrictedTypes = [
      'government_office', 'local_government_office', 'courthouse',
      'police', 'fire_station', 'military_base', 'embassy'
    ];
    
    const restrictedTypes = [
      'airport', 'bus_station', 'subway_station', 'train_station',
      'gas_station', 'hospital'
    ];
    
    const nearbyPlaces = data.results || [];
    const issues = [];
    
    // Check if location is in water/forest/restricted area
    for (const place of nearbyPlaces.slice(0, 10)) {
      const types = place.types || [];
      
      if (types.some((type: string) => unbuildableTypes.includes(type))) {
        issues.push(`Location appears to be near ${place.name} which may be unbuildable or protected area`);
      }
      
      if (types.some((type: string) => governmentRestrictedTypes.includes(type))) {
        issues.push(`This area contains ${place.name} - government property where private construction may be prohibited`);
      }
      
      if (types.some((type: string) => restrictedTypes.includes(type)) && place.geometry?.location) {
        const distance = calculateDistance(
          location.lat, location.lng,
          place.geometry.location.lat, place.geometry.location.lng
        );
        if (distance < 0.5) { // Less than 500m
          issues.push(`Very close to ${place.name} - may have building restrictions`);
        }
      }
    }
    
    return {
      isViable: issues.length === 0,
      issues,
      nearbyPlaces: nearbyPlaces.slice(0, 5)
    };
  } catch (error) {
    console.error('Location viability check failed:', error);
    return { isViable: true, issues: [], nearbyPlaces: [] };
  }
}

async function validatePropertyTypeCompatibility(data: ValidationRequest) {
  const { location, propertyData } = data;
  const issues = [];
  
  // Check property type compatibility with location
  if (propertyData.propertyType === 'villa' || propertyData.propertyType === 'house') {
    // Houses/villas should not be in commercial or industrial areas
    const address = location.address.toLowerCase();
    if (address.includes('industrial') || address.includes('commercial zone') || address.includes('market')) {
      issues.push(`You have selected "${propertyData.propertyType}" but the location appears to be in a commercial/industrial area. Consider selecting "commercial" property type instead.`);
    }
  }
  
  if (propertyData.propertyType === 'plot') {
    // Plots are fine in most areas, just warn about restrictions
    const address = location.address.toLowerCase();
    if (address.includes('reserved') || address.includes('government')) {
      issues.push(`This appears to be a government or reserved area. Plot development may have restrictions or may not be permitted.`);
    }
  }
  
  if (propertyData.propertyType === 'commercial') {
    // Commercial properties should ideally be in commercial zones
    const address = location.address.toLowerCase();
    if (address.includes('residential') && !address.includes('mixed')) {
      issues.push(`You have selected "commercial" property but this appears to be a residential area. Commercial activities may be restricted here.`);
    }
  }
  
  return {
    isCompatible: issues.length === 0,
    issues,
    confidence: Math.min(100, Math.max(0, 100 - (issues.length * 25)))
  };
}

async function performComprehensiveValidation(
  data: ValidationRequest, 
  locationCheck: any, 
  typeCheck: any
): Promise<ValidationResult> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `
    As a real estate expert, analyze this property selection for location and type compatibility:
    
    Location: ${data.location.address} (${data.location.lat}, ${data.location.lng})
    Selected Property Type: ${data.propertyData.propertyType}
    Size: ${data.propertyData.propertySize} ${data.propertyData.sizeUnit}
    
    Location Issues: ${locationCheck.issues.join(', ') || 'None'}
    Property Type Issues: ${typeCheck.issues.join(', ') || 'None'}
    
    Focus on these key concerns:
    1. Is this location suitable for the selected property type?
    2. Are there government restrictions or forest/water body issues?
    3. Is the property type appropriate for this area?
    4. Any zoning or legal concerns?
    
    Provide a JSON response with:
    {
      "isValid": boolean,
      "issues": ["list of specific issues"],
      "riskLevel": "low|medium|high",
      "confidence": number (0-100),
      "reasoning": "brief explanation of main concerns"
    }
    
    Do not include price analysis or recommendations in this validation.
    `;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const validation = JSON.parse(jsonMatch[0]);
      
      // Combine with our technical checks
      const allIssues = [
        ...locationCheck.issues,
        ...typeCheck.issues,
        ...validation.issues
      ];
      
      return {
        isValid: allIssues.length === 0 && validation.isValid,
        issues: allIssues,
        recommendations: [], // Removed recommendations from validation
        riskLevel: allIssues.length > 3 ? 'high' : allIssues.length > 1 ? 'medium' : 'low',
        confidence: Math.min(validation.confidence, typeCheck.confidence)
      };
    }
    
    // Fallback if JSON parsing fails
    return {
      isValid: locationCheck.isViable && typeCheck.isCompatible,
      issues: [...locationCheck.issues, ...typeCheck.issues],
      recommendations: [],
      riskLevel: 'medium',
      confidence: 50
    };
    
  } catch (error) {
    console.error('Comprehensive validation failed:', error);
    return {
      isValid: true,
      issues: [],
      recommendations: [],
      riskLevel: 'low',
      confidence: 0
    };
  }
}



function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c; // Distance in kilometers
  return d;
}