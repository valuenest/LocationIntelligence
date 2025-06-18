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
    
    return issues;
    
  } catch (error) {
    console.error('Location viability check error:', error);
    return [];
  }
}