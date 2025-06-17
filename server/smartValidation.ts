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
    
    // Then validate property price against market rates
    const priceCheck = await validatePropertyPrice(data);
    
    // Combine all validation results
    const validationResult = await performComprehensiveValidation(data, locationCheck, priceCheck);
    
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
    
    // Check for water bodies, forests, rivers, etc.
    const unbuildableTypes = [
      'natural_feature', 'park', 'campground', 'rv_park', 
      'national_park', 'zoo', 'aquarium', 'cemetery'
    ];
    
    const restrictedTypes = [
      'airport', 'bus_station', 'subway_station', 'train_station',
      'gas_station', 'hospital', 'police', 'fire_station'
    ];
    
    const nearbyPlaces = data.results || [];
    const issues = [];
    
    // Check if location is in water/forest/restricted area
    for (const place of nearbyPlaces.slice(0, 10)) {
      const types = place.types || [];
      
      if (types.some((type: string) => unbuildableTypes.includes(type))) {
        issues.push(`Location appears to be near ${place.name} which may be unbuildable`);
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

async function validatePropertyPrice(data: ValidationRequest) {
  const { location, propertyData } = data;
  
  // Calculate expected price range based on location and property details
  const cityTier = getCityTier(location.address);
  const baseRates = getBaseRates(cityTier, propertyData.country);
  
  // Calculate expected price per sqft
  const sizeInSqFt = propertyData.sizeUnit === 'sqm' ? 
    propertyData.propertySize * 10.764 : propertyData.propertySize;
  
  const expectedMinPrice = baseRates.min * sizeInSqFt;
  const expectedMaxPrice = baseRates.max * sizeInSqFt;
  
  const userPrice = propertyData.amount;
  const issues = [];
  
  if (userPrice < expectedMinPrice * 0.3) {
    issues.push(`Property price ₹${userPrice.toLocaleString()} seems unusually low for ${location.address}. Expected range: ₹${expectedMinPrice.toLocaleString()} - ₹${expectedMaxPrice.toLocaleString()}`);
  }
  
  if (userPrice > expectedMaxPrice * 3) {
    issues.push(`Property price ₹${userPrice.toLocaleString()} seems unusually high for ${location.address}. Expected range: ₹${expectedMinPrice.toLocaleString()} - ₹${expectedMaxPrice.toLocaleString()}`);
  }
  
  return {
    isRealistic: issues.length === 0,
    issues,
    expectedRange: { min: expectedMinPrice, max: expectedMaxPrice },
    confidence: Math.min(100, Math.max(0, 100 - (issues.length * 30)))
  };
}

async function performComprehensiveValidation(
  data: ValidationRequest, 
  locationCheck: any, 
  priceCheck: any
): Promise<ValidationResult> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `
    As a real estate expert, analyze this property investment for potential issues:
    
    Location: ${data.location.address} (${data.location.lat}, ${data.location.lng})
    Property: ${data.propertyData.propertyType}
    Price: ₹${data.propertyData.amount.toLocaleString()}
    Size: ${data.propertyData.propertySize} ${data.propertyData.sizeUnit}
    Age: ${data.propertyData.propertyAge}
    Bedrooms: ${data.propertyData.bedrooms}
    
    Location Analysis Issues: ${locationCheck.issues.join(', ') || 'None'}
    Price Analysis Issues: ${priceCheck.issues.join(', ') || 'None'}
    
    Provide a JSON response with:
    {
      "isValid": boolean,
      "issues": ["list of specific issues"],
      "recommendations": ["list of actionable recommendations"],
      "riskLevel": "low|medium|high",
      "confidence": number (0-100),
      "reasoning": "brief explanation"
    }
    
    Consider:
    1. Is this location buildable for residential/commercial property?
    2. Is the price realistic for the area and property specifications?
    3. Are there any red flags in the property details?
    4. What recommendations would you give?
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
        ...priceCheck.issues,
        ...validation.issues
      ];
      
      return {
        isValid: allIssues.length === 0 && validation.isValid,
        issues: allIssues,
        recommendations: validation.recommendations || [],
        riskLevel: allIssues.length > 3 ? 'high' : allIssues.length > 1 ? 'medium' : 'low',
        confidence: Math.min(validation.confidence, priceCheck.confidence)
      };
    }
    
    // Fallback if JSON parsing fails
    return {
      isValid: locationCheck.isViable && priceCheck.isRealistic,
      issues: [...locationCheck.issues, ...priceCheck.issues],
      recommendations: ['Please verify property details and location suitability'],
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

function getCityTier(address: string): 'tier1' | 'tier2' | 'tier3' | 'rural' {
  const tier1Cities = ['mumbai', 'delhi', 'bangalore', 'hyderabad', 'pune', 'chennai', 'kolkata', 'ahmedabad'];
  const tier2Cities = ['jaipur', 'lucknow', 'kanpur', 'nagpur', 'indore', 'thane', 'bhopal', 'visakhapatnam', 'patna', 'vadodara'];
  
  const lowerAddress = address.toLowerCase();
  
  if (tier1Cities.some(city => lowerAddress.includes(city))) return 'tier1';
  if (tier2Cities.some(city => lowerAddress.includes(city))) return 'tier2';
  if (lowerAddress.includes('village') || lowerAddress.includes('rural')) return 'rural';
  return 'tier3';
}

function getBaseRates(cityTier: string, country: string) {
  // Base rates per sqft in INR
  const rates = {
    tier1: { min: 8000, max: 25000 },
    tier2: { min: 4000, max: 12000 },
    tier3: { min: 2000, max: 6000 },
    rural: { min: 500, max: 2000 }
  };
  
  return rates[cityTier as keyof typeof rates] || rates.tier3;
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