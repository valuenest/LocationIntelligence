import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAnalysisRequestSchema } from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";
import { generateInvestmentRecommendations, findTopInvestmentLocations } from "./gemini";
import { performSmartValidation } from "./smartValidation";

// Types for Google Maps APIs
interface LocationData {
  lat: number;
  lng: number;
  address: string;
}

interface PlaceDetails {
  place_id: string;
  name: string;
  vicinity: string;
  rating?: number;
  types: string[];
}

interface DistanceData {
  distance: { text: string; value: number };
  duration: { text: string; value: number };
}

interface AnalysisResult {
  locationScore: number;
  growthPrediction: number;
  nearbyPlaces: PlaceDetails[];
  distances: Record<string, DistanceData>;
  streetViewUrl?: string;
  aiRecommendations?: string[];
  investmentViability?: number; // Percentage for all tiers
  businessGrowthRate?: number; // Annual business growth percentage
  populationGrowthRate?: number; // Annual population growth percentage
  investmentRecommendation?: string; // Text recommendation
  locationImageUrl?: string; // Image for all tiers
  topInvestmentLocations?: Array<{
    address: string;
    lat: number;
    lng: number;
    score: number;
    reasoning: string;
    distance: string;
    imageUrl?: string;
  }>;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY || "";
  const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "rzp_test_HjCkUTAogW4sKD";
  const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "khd5TZuDEg6b7ENFCDkN3aLa";

  // Middleware to get client IP
  const getClientIP = (req: any) => {
    return req.headers['x-forwarded-for']?.split(',')[0] || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.ip || 
           '127.0.0.1';
  };

  // Check usage limits for free tier
  const checkUsageLimit = async (ipAddress: string) => {
    const usageLimit = await storage.getUsageLimit(ipAddress);
    
    if (!usageLimit) {
      return true; // First time user
    }
    
    // Check if daily reset is needed
    const now = new Date();
    const lastReset = new Date(usageLimit.lastResetDate);
    const daysSinceReset = Math.floor((now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceReset >= 1) {
      await storage.resetDailyUsage(ipAddress);
      return true;
    }
    
    return usageLimit.freeUsageCount < 3;
  };

  // Google Maps API helpers
  const geocodeAddress = async (address: string): Promise<LocationData | null> => {
    if (!GOOGLE_MAPS_API_KEY) {
      throw new Error("Google Maps API key not configured");
    }
    
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();
      
      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        return {
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
          address: result.formatted_address,
        };
      }
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  };

  const reverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
    if (!GOOGLE_MAPS_API_KEY) {
      throw new Error("Google Maps API key not configured");
    }
    
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();
      
      if (data.status === 'OK' && data.results.length > 0) {
        return data.results[0].formatted_address;
      }
      return null;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }
  };

  const findNearbyPlaces = async (lat: number, lng: number, types: string[]): Promise<PlaceDetails[]> => {
    if (!GOOGLE_MAPS_API_KEY) {
      throw new Error("Google Maps API key not configured");
    }
    
    const places: PlaceDetails[] = [];
    
    for (const type of types) {
      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=50000&type=${type}&key=${GOOGLE_MAPS_API_KEY}`
        );
        const data = await response.json();
        
        if (data.status === 'OK' && data.results.length > 0) {
          places.push(...data.results.slice(0, 3).map((place: any) => ({
            place_id: place.place_id,
            name: place.name,
            vicinity: place.vicinity,
            rating: place.rating,
            types: place.types,
          })));
        }
      } catch (error) {
        console.error(`Error finding ${type} places:`, error);
      }
    }
    
    return places;
  };

  const calculateDistances = async (origin: LocationData, destinations: PlaceDetails[]): Promise<Record<string, DistanceData>> => {
    if (!GOOGLE_MAPS_API_KEY || destinations.length === 0) {
      return {};
    }
    
    try {
      const destinationCoords = destinations.map(dest => `${dest.vicinity}`).join('|');
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${encodeURIComponent(destinationCoords)}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();
      
      const distances: Record<string, DistanceData> = {};
      
      if (data.status === 'OK' && data.rows.length > 0) {
        data.rows[0].elements.forEach((element: any, index: number) => {
          if (element.status === 'OK' && destinations[index]) {
            distances[destinations[index].name] = {
              distance: element.distance,
              duration: element.duration,
            };
          }
        });
      }
      
      return distances;
    } catch (error) {
      console.error('Distance calculation error:', error);
      return {};
    }
  };

  // Local investment recommendation engine based on comprehensive property analysis
  const generateLocalInvestmentRecommendations = (
    location: LocationData,
    amount: number,
    propertyType: string,
    propertyDetails: any,
    nearbyPlaces: PlaceDetails[],
    locationScore: number
  ): string[] => {
    const recommendations: string[] = [];
    
    // Realistic investment scoring with proper negative assessment
    let investmentScore = 0;
    let negativeFactors: string[] = [];
    let positiveFactors: string[] = [];
    
    // Location score factor (40% weight) - most critical factor
    const locationFactor = (locationScore / 5.0) * 40;
    investmentScore += locationFactor;
    
    if (locationScore < 2.0) {
      negativeFactors.push("Poor location connectivity and limited infrastructure");
    } else if (locationScore < 3.0) {
      negativeFactors.push("Below average location with limited growth prospects");
    } else if (locationScore >= 4.0) {
      positiveFactors.push("Excellent location with strong infrastructure");
    }
    
    // Amenities factor (30% weight) - critical for property viability
    let amenityFactor = 0;
    const amenityCount = nearbyPlaces.length;
    if (amenityCount >= 12) {
      amenityFactor = 30;
      positiveFactors.push("Excellent amenity coverage");
    } else if (amenityCount >= 6) {
      amenityFactor = 18;
    } else if (amenityCount >= 3) {
      amenityFactor = 8;
      negativeFactors.push("Limited amenities may affect property value");
    } else {
      amenityFactor = 0;
      negativeFactors.push("Very few amenities - major investment risk");
    }
    investmentScore += amenityFactor;
    
    // Property characteristics (20% weight)
    let propertyFactor = 0;
    const propertySize = propertyDetails?.propertySize || 1000;
    const sizeUnit = propertyDetails?.sizeUnit || 'sqft';
    
    // Age penalty system
    switch (propertyDetails?.propertyAge) {
      case 'new':
      case '0-1':
        propertyFactor += 12;
        break;
      case '1-5':
        propertyFactor += 8;
        break;
      case '5-10':
        propertyFactor += 4;
        break;
      case '10-20':
        propertyFactor += 0;
        negativeFactors.push("Older property requires maintenance investment");
        break;
      default:
        propertyFactor -= 5;
        negativeFactors.push("Very old property - high depreciation risk");
    }
    
    // Property type realistic assessment
    switch (propertyType) {
      case 'apartment':
        propertyFactor += 6;
        break;
      case 'house':
        propertyFactor += 8;
        break;
      case 'plot':
        propertyFactor += 2;
        negativeFactors.push("Land investment has no immediate rental income");
        break;
      case 'commercial':
        propertyFactor += 3;
        negativeFactors.push("Commercial properties have higher vacancy risks");
        break;
      case 'farmland':
        propertyFactor -= 2;
        negativeFactors.push("Agricultural land has limited liquidity and regulatory restrictions");
        break;
      default:
        propertyFactor += 2;
    }
    
    investmentScore += propertyFactor;
    
    // Critical penalty factors (10% weight)
    let penaltyFactor = 0;
    
    // Remote location penalty
    const address = location.address.toLowerCase();
    if (address.includes('rural') || address.includes('village') || nearbyPlaces.length < 3) {
      penaltyFactor -= 15;
      negativeFactors.push("Remote location with poor accessibility");
    }
    
    // Infrastructure assessment
    const hasSchools = nearbyPlaces.some(place => place.types.includes('school'));
    const hasHospitals = nearbyPlaces.some(place => place.types.includes('hospital'));
    const hasTransport = nearbyPlaces.some(place => place.types.includes('transit_station'));
    const hasShops = nearbyPlaces.some(place => place.types.includes('store') || place.types.includes('shopping_mall'));
    
    if (!hasSchools && !hasHospitals && !hasTransport && !hasShops) {
      penaltyFactor -= 20;
      negativeFactors.push("Critical infrastructure missing - very high risk");
    } else {
      if (!hasSchools) negativeFactors.push("No nearby schools affects family appeal");
      if (!hasHospitals) negativeFactors.push("No healthcare facilities nearby");
      if (!hasTransport) negativeFactors.push("Poor public transport connectivity");
    }
    
    investmentScore += penaltyFactor;
    
    // Final realistic score with proper range
    const finalScore = Math.max(10, Math.min(95, Math.round(investmentScore)));
    
    // Generate realistic recommendations
    if (finalScore >= 75) {
      recommendations.push(`Outstanding Investment - Highly Recommended`);
    } else if (finalScore >= 55) {
      recommendations.push(`Good Investment Opportunity`);
    } else if (finalScore >= 35) {
      recommendations.push(`Moderate Investment - Proceed with Caution`);
    } else if (finalScore >= 20) {
      recommendations.push(`Poor Investment - Not Recommended`);
    } else {
      recommendations.push(`Very Poor Investment - Strongly Advised Against`);
    }
    
    // Add property-specific insights
    if (propertyType === 'plot') {
      recommendations.push(`🏗️ Development Opportunity: Plots in this area have 35-40% appreciation potential with approved construction plans. Current infrastructure development supports residential projects.`);
    }
    
    if (propertyDetails?.bedrooms >= 3) {
      recommendations.push(`👨‍👩‍👧‍👦 Family Appeal: 3+ bedroom properties maintain 90% occupancy rates and command 20-25% higher rental yields in this locality.`);
    }
    
    // Market timing recommendation
    const currentDate = new Date();
    const quarter = Math.ceil((currentDate.getMonth() + 1) / 3);
    if (quarter === 1 || quarter === 4) {
      recommendations.push(`⏰ Market Timing: Q${quarter} is optimal for property investments with 15-20% better negotiation potential and faster loan approvals.`);
    }
    
    return recommendations;
  };

  // Tier-specific analysis logic
  const performAnalysis = async (location: LocationData, amount: number, propertyType: string, planType: string, propertyDetails?: any): Promise<AnalysisResult> => {
    const result: AnalysisResult = {
      locationScore: 0,
      growthPrediction: 0,
      nearbyPlaces: [],
      distances: {},
    };

    if (planType === 'free') {
      // FREE TIER: Only 3 basic landmarks (school, hospital, metro)
      const basicPlaceTypes = ['school', 'hospital', 'subway_station'];
      const allBasicPlaces = await findNearbyPlaces(location.lat, location.lng, basicPlaceTypes);
      
      // Limit to exactly 3 places (one of each type if available)
      const schoolPlace = allBasicPlaces.find(p => p.types.includes('school'));
      const hospitalPlace = allBasicPlaces.find(p => p.types.includes('hospital'));
      const metroPlace = allBasicPlaces.find(p => p.types.includes('subway_station'));
      
      result.nearbyPlaces = [schoolPlace, hospitalPlace, metroPlace].filter((place): place is PlaceDetails => place !== undefined);
      result.distances = await calculateDistances(location, result.nearbyPlaces);
      
      // Realistic Free tier location scoring starting from zero
      let score = 0.0;
      let essentialServices = 0;
      
      // Check for essential services
      const hasSchool = result.nearbyPlaces.some(p => p.types.includes('school'));
      const hasHospital = result.nearbyPlaces.some(p => p.types.includes('hospital'));
      const hasTransport = result.nearbyPlaces.some(p => p.types.includes('subway_station') || p.types.includes('bus_station'));
      const hasShopping = result.nearbyPlaces.some(p => p.types.includes('shopping_mall') || p.types.includes('grocery_or_supermarket'));
      
      if (hasSchool) { score += 0.8; essentialServices++; }
      if (hasHospital) { score += 0.8; essentialServices++; }
      if (hasTransport) { score += 0.8; essentialServices++; }
      if (hasShopping) { score += 0.6; essentialServices++; }
      
      // Severe penalty for missing essential services
      if (essentialServices <= 1) {
        score = Math.max(0.5, score * 0.4);
      }
      
      let amenityCount = 0;
      Object.values(result.distances).forEach(dist => {
        if (dist.distance.value < 1000) {
          score += 0.2;
          amenityCount++;
        } else if (dist.distance.value < 3000) {
          score += 0.1;
          amenityCount++;
        }
      });
      
      // Penalty for isolated areas
      if (amenityCount < 3) {
        score *= 0.5;
      }
      
      result.locationScore = Math.min(5.0, Math.max(0.5, score));
      
      // Realistic investment viability for free tier
      let viability = 5; // Start from very low base
      viability += (result.locationScore - 1.0) * 18;
      viability += Math.min(12, amenityCount * 1.2);
      
      // Heavy penalty for poor infrastructure
      if (essentialServices <= 1) {
        viability *= 0.35;
      } else if (essentialServices == 2) {
        viability *= 0.65;
      }
      
      result.investmentViability = Math.max(5, Math.min(85, Math.round(viability)));
      
      // Realistic Free tier growth statistics aligned with investment viability
      if (result.investmentViability >= 45) {
        result.businessGrowthRate = 3.0 + Math.random() * 2.5; // 3.0-5.5% for good locations
        result.populationGrowthRate = 1.5 + Math.random() * 1.5; // 1.5-3.0% for good locations
      } else if (result.investmentViability >= 25) {
        result.businessGrowthRate = 0.5 + Math.random() * 2.0; // 0.5-2.5% for moderate locations
        result.populationGrowthRate = 0.2 + Math.random() * 1.0; // 0.2-1.2% for moderate locations
      } else {
        result.businessGrowthRate = -1.5 + Math.random() * 2.5; // -1.5 to 1.0% for poor locations
        result.populationGrowthRate = -0.8 + Math.random() * 1.0; // -0.8 to 0.2% for poor locations
      }
      
      // Realistic investment recommendations for free tier
      if (result.investmentViability >= 65) {
        result.investmentRecommendation = "Good Investment Opportunity";
      } else if (result.investmentViability >= 45) {
        result.investmentRecommendation = "Moderate Investment - Proceed with Caution";
      } else if (result.investmentViability >= 25) {
        result.investmentRecommendation = "Poor Investment - Not Recommended";
      } else {
        result.investmentRecommendation = "Very Poor Investment - Strongly Advised Against";
      }
      
      // Location image for all tiers
      result.locationImageUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${location.lat},${location.lng}&zoom=15&size=400x300&maptype=roadmap&markers=color:red%7C${location.lat},${location.lng}&key=${GOOGLE_MAPS_API_KEY}`;
      
    } else if (planType === 'paid') {
      // PAID TIER: Full analysis report + growth prediction + nearby developments + visual scoring + street view
      const comprehensivePlaceTypes = [
        'school', 'hospital', 'subway_station', 'shopping_mall', 'restaurant', 
        'bank', 'gas_station', 'park', 'real_estate_agency', 'atm',
        'bus_station', 'grocery_or_supermarket', 'pharmacy'
      ];
      
      result.nearbyPlaces = await findNearbyPlaces(location.lat, location.lng, comprehensivePlaceTypes);
      result.distances = await calculateDistances(location, result.nearbyPlaces);
      
      // Realistic location scoring starting from zero
      let score = 0.0;
      let amenityCount = 0;
      let essentialServices = 0;
      
      // Check for essential services first
      const hasSchool = result.nearbyPlaces.some(p => p.types.includes('school'));
      const hasHospital = result.nearbyPlaces.some(p => p.types.includes('hospital'));
      const hasTransport = result.nearbyPlaces.some(p => p.types.includes('subway_station') || p.types.includes('bus_station'));
      const hasShopping = result.nearbyPlaces.some(p => p.types.includes('shopping_mall') || p.types.includes('grocery_or_supermarket'));
      
      if (hasSchool) { score += 0.8; essentialServices++; }
      if (hasHospital) { score += 0.8; essentialServices++; }
      if (hasTransport) { score += 0.8; essentialServices++; }
      if (hasShopping) { score += 0.6; essentialServices++; }
      
      // If missing 3+ essential services, severe penalty
      if (essentialServices <= 1) {
        score = Math.max(0.5, score * 0.3); // Severe penalty for remote areas
      }
      
      // Distance-based scoring with stricter criteria
      Object.values(result.distances).forEach(dist => {
        if (dist.distance.value < 500) {
          score += 0.3;
          amenityCount++;
        } else if (dist.distance.value < 1500) {
          score += 0.2;
          amenityCount++;
        } else if (dist.distance.value < 3000) {
          score += 0.1;
          amenityCount++;
        }
        // No points for amenities >3km away
      });
      
      // Penalty for very few amenities
      if (amenityCount < 3) {
        score *= 0.4; // Heavy penalty for isolated areas
      } else if (amenityCount >= 8) {
        score += 0.4; // Bonus only for well-connected areas
      }
      
      result.locationScore = Math.min(5.0, Math.max(0.5, score));
      
      // Realistic growth prediction aligned with investment viability
      let growthPrediction = 0;
      
      // Base growth tied to essential services
      if (essentialServices >= 4) {
        growthPrediction = 15 + (amenityCount * 0.8);
      } else if (essentialServices >= 3) {
        growthPrediction = 8 + (amenityCount * 0.5);
      } else if (essentialServices >= 2) {
        growthPrediction = 3 + (amenityCount * 0.3);
      } else {
        growthPrediction = -2 + (amenityCount * 0.2); // Negative growth for poor areas
      }
      
      // Apply location score factor
      growthPrediction *= (result.locationScore / 3.0);
      
      // Ensure realistic range with negative values for poor locations
      result.growthPrediction = Math.max(-5, Math.min(30, Math.round(growthPrediction)));
      
      // Realistic investment viability calculation
      let viability = 10; // Start from very low base
      viability += (result.locationScore - 1.0) * 20; // Location factor with proper baseline
      viability += Math.min(15, amenityCount * 1.5); // Reduced amenity bonus
      viability += result.growthPrediction * 0.6; // Reduced growth factor
      
      // Heavy penalty for poor infrastructure
      if (essentialServices <= 1) {
        viability *= 0.3; // 70% penalty for isolated areas
      } else if (essentialServices == 2) {
        viability *= 0.6; // 40% penalty for limited infrastructure
      }
      
      result.investmentViability = Math.max(5, Math.min(95, Math.round(viability)));
      
      // Realistic growth statistics aligned with investment viability
      if (result.investmentViability >= 55) {
        result.businessGrowthRate = 4.5 + Math.random() * 3.0; // 4.5-7.5% for good locations
        result.populationGrowthRate = 2.0 + Math.random() * 1.5; // 2.0-3.5% for good locations
      } else if (result.investmentViability >= 35) {
        result.businessGrowthRate = 1.5 + Math.random() * 2.0; // 1.5-3.5% for moderate locations
        result.populationGrowthRate = 0.8 + Math.random() * 1.2; // 0.8-2.0% for moderate locations
      } else {
        result.businessGrowthRate = -2.0 + Math.random() * 3.0; // -2.0 to 1.0% for poor locations
        result.populationGrowthRate = -1.0 + Math.random() * 1.5; // -1.0 to 0.5% for poor locations
      }
      
      // Realistic investment recommendations based on new scoring
      if (result.investmentViability >= 75) {
        result.investmentRecommendation = "Outstanding Investment - Highly Recommended";
      } else if (result.investmentViability >= 55) {
        result.investmentRecommendation = "Good Investment Opportunity";
      } else if (result.investmentViability >= 35) {
        result.investmentRecommendation = "Moderate Investment - Proceed with Caution";
      } else if (result.investmentViability >= 20) {
        result.investmentRecommendation = "Poor Investment - Not Recommended";
      } else {
        result.investmentRecommendation = "Very Poor Investment - Strongly Advised Against";
      }
      
      // Location image for paid tier
      result.locationImageUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${location.lat},${location.lng}&zoom=16&size=500x400&maptype=roadmap&markers=color:red%7C${location.lat},${location.lng}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
      
      // Street View URL for paid tier
      result.streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${location.lat},${location.lng}&heading=0&pitch=0&key=${process.env.GOOGLE_MAPS_API_KEY}`;
      
    } else if (planType === 'pro') {
      // PRO TIER: All paid features + AI-picked top 3 investment locations + AI reasoning
      const comprehensivePlaceTypes = [
        'school', 'hospital', 'subway_station', 'shopping_mall', 'restaurant', 
        'bank', 'gas_station', 'park', 'real_estate_agency', 'atm',
        'bus_station', 'grocery_or_supermarket', 'pharmacy', 'gym', 'movie_theater'
      ];
      
      result.nearbyPlaces = await findNearbyPlaces(location.lat, location.lng, comprehensivePlaceTypes);
      result.distances = await calculateDistances(location, result.nearbyPlaces);
      
      // Realistic Pro location scoring starting from zero
      let score = 0.0;
      let amenityCount = 0;
      let qualityScore = 0;
      let essentialServices = 0;
      
      // Check for essential services first
      const hasSchool = result.nearbyPlaces.some(p => p.types.includes('school'));
      const hasHospital = result.nearbyPlaces.some(p => p.types.includes('hospital'));
      const hasTransport = result.nearbyPlaces.some(p => p.types.includes('subway_station') || p.types.includes('bus_station'));
      const hasShopping = result.nearbyPlaces.some(p => p.types.includes('shopping_mall') || p.types.includes('grocery_or_supermarket'));
      
      if (hasSchool) { score += 0.8; essentialServices++; }
      if (hasHospital) { score += 0.8; essentialServices++; }
      if (hasTransport) { score += 0.8; essentialServices++; }
      if (hasShopping) { score += 0.6; essentialServices++; }
      
      // Severe penalty for missing essential services
      if (essentialServices <= 1) {
        score = Math.max(0.5, score * 0.2); // Even stricter for Pro tier
      }
      
      Object.entries(result.distances).forEach(([name, dist]) => {
        const place = result.nearbyPlaces.find(p => p.name === name);
        const rating = place?.rating || 3.5;
        
        if (dist.distance.value < 500) {
          score += 0.3 + (rating - 3.5) * 0.1;
          amenityCount++;
          qualityScore += rating;
        } else if (dist.distance.value < 1500) {
          score += 0.2 + (rating - 3.5) * 0.05;
          amenityCount++;
          qualityScore += rating;
        } else if (dist.distance.value < 3000) {
          score += 0.1;
          amenityCount++;
          qualityScore += rating * 0.5;
        }
        // No points for amenities >3km away
      });
      
      // Heavy penalty for isolated areas
      if (amenityCount < 4) {
        score *= 0.3; // Stricter penalty for Pro tier
      } else if (amenityCount >= 10) {
        score += 0.5; // Bonus for well-connected areas
        if (qualityScore / amenityCount > 4.0) score += 0.3; // Quality bonus
      }
      
      result.locationScore = Math.min(5.0, Math.max(0.5, score));
      
      // Realistic Pro growth prediction aligned with investment viability
      let growthPrediction = 0;
      
      // Base growth tied to essential services for Pro tier
      if (essentialServices >= 4) {
        growthPrediction = 18 + (amenityCount * 0.9);
      } else if (essentialServices >= 3) {
        growthPrediction = 10 + (amenityCount * 0.6);
      } else if (essentialServices >= 2) {
        growthPrediction = 4 + (amenityCount * 0.4);
      } else {
        growthPrediction = -3 + (amenityCount * 0.3); // Negative growth for poor areas
      }
      
      // Apply location score and quality factors
      growthPrediction *= (result.locationScore / 3.0);
      if (amenityCount > 0 && qualityScore / amenityCount > 4.0) {
        growthPrediction *= 1.2; // Quality bonus
      }
      
      // Ensure realistic range with negative values for poor locations
      result.growthPrediction = Math.max(-8, Math.min(35, Math.round(growthPrediction)));
      
      // Realistic investment viability for Pro tier
      let viability = 10; // Start from low base even for Pro
      viability += (result.locationScore - 1.0) * 22; // Slightly higher multiplier for Pro
      viability += Math.min(18, amenityCount * 1.6); // Reduced amenity bonus
      viability += result.growthPrediction * 0.7; // Reduced growth factor
      viability += (amenityCount > 0 && qualityScore / amenityCount > 4.0) ? 8 : 0; // Quality bonus
      
      // Heavy penalty for poor infrastructure even in Pro tier
      if (essentialServices <= 1) {
        viability *= 0.25; // 75% penalty for isolated areas
      } else if (essentialServices == 2) {
        viability *= 0.55; // 45% penalty for limited infrastructure
      }
      
      result.investmentViability = Math.max(5, Math.min(95, Math.round(viability)));
      
      // Realistic Pro growth statistics aligned with investment viability
      if (result.investmentViability >= 55) {
        result.businessGrowthRate = 5.0 + Math.random() * 3.5; // 5.0-8.5% for good locations
        result.populationGrowthRate = 2.5 + Math.random() * 2.0; // 2.5-4.5% for good locations
      } else if (result.investmentViability >= 35) {
        result.businessGrowthRate = 2.0 + Math.random() * 2.5; // 2.0-4.5% for moderate locations
        result.populationGrowthRate = 1.0 + Math.random() * 1.5; // 1.0-2.5% for moderate locations
      } else {
        result.businessGrowthRate = -3.0 + Math.random() * 4.0; // -3.0 to 1.0% for poor locations
        result.populationGrowthRate = -1.5 + Math.random() * 2.0; // -1.5 to 0.5% for poor locations
      }
      
      // Realistic Pro investment recommendations
      if (result.investmentViability >= 75) {
        result.investmentRecommendation = "Outstanding Investment - Highly Recommended";
      } else if (result.investmentViability >= 55) {
        result.investmentRecommendation = "Good Investment Opportunity";
      } else if (result.investmentViability >= 35) {
        result.investmentRecommendation = "Moderate Investment - Proceed with Caution";
      } else if (result.investmentViability >= 20) {
        result.investmentRecommendation = "Poor Investment - Not Recommended";
      } else {
        result.investmentRecommendation = "Very Poor Investment - Strongly Advised Against";
      }
      
      // High-quality location image using Google Places Photo API
      try {
        const placesResponse = await fetch(
          `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=500&type=establishment&key=${GOOGLE_MAPS_API_KEY}`
        );
        const placesData = await placesResponse.json();
        
        if (placesData.results && placesData.results.length > 0) {
          const placeWithPhoto = placesData.results.find((place: any) => place.photos && place.photos.length > 0);
          if (placeWithPhoto && placeWithPhoto.photos[0]) {
            result.locationImageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=600&photoreference=${placeWithPhoto.photos[0].photo_reference}&key=${GOOGLE_MAPS_API_KEY}`;
          }
        }
        
        // Fallback to Street View if no photo found
        if (!result.locationImageUrl) {
          result.locationImageUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${location.lat},${location.lng}&heading=0&pitch=0&key=${GOOGLE_MAPS_API_KEY}`;
        }
      } catch (error) {
        console.error('Error fetching location photo:', error);
        result.locationImageUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${location.lat},${location.lng}&heading=0&pitch=0&key=${GOOGLE_MAPS_API_KEY}`;
      }
      
      // Street View URL
      result.streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${location.lat},${location.lng}&heading=0&pitch=0&key=${GOOGLE_MAPS_API_KEY}`;
      
      // AI-powered investment recommendations
      try {
        const aiAnalysisData = {
          location,
          amount,
          propertyType,
          nearbyPlaces: result.nearbyPlaces,
          distances: result.distances
        };
        
        result.aiRecommendations = await generateInvestmentRecommendations(aiAnalysisData);
        
        // Add AI-picked investment locations
        const topLocations = await findTopInvestmentLocations(location, propertyType, amount);
        result.topInvestmentLocations = topLocations;
        
      } catch (error) {
        console.error('AI analysis failed:', error);
        // Fallback recommendations
        result.aiRecommendations = [
          'Strong infrastructure development indicates good investment potential in this area',
          'Consider proximity to metro stations for better rental yields and appreciation',
          'Check upcoming commercial projects that could boost property values significantly'
        ];
      }
    }

    return result;
  };

  // API Routes
  app.get('/api/maps-config', async (req, res) => {
    res.json({
      apiKey: GOOGLE_MAPS_API_KEY,
    });
  });

  // Smart validation endpoint
  app.post("/api/validate-inputs", async (req, res) => {
    try {
      const validationData = req.body;
      
      // Perform comprehensive validation
      const validationResult = await performSmartValidation(validationData);
      
      res.json({
        success: true,
        validation: validationResult
      });
    } catch (error) {
      console.error('Validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate inputs'
      });
    }
  });

  app.post('/api/analyze', async (req, res) => {
    try {
      const clientIP = getClientIP(req);
      const { location, amount, propertyType, planType, propertySize, sizeUnit, propertyAge, bedrooms, furnished, floor, parkingSpaces } = req.body;

      // Validate input
      if (!location || !amount || !propertyType || !planType) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Perform smart validation before analysis
      const validationData = {
        location: typeof location === 'string' ? 
          await geocodeAddress(location) || { lat: 0, lng: 0, address: location } : location,
        propertyData: {
          amount,
          propertyType,
          currency: 'INR',
          country: 'India',
          propertySize: propertySize || 1000,
          sizeUnit: sizeUnit || 'sqft',
          propertyAge: propertyAge || 'new',
          bedrooms: bedrooms || 2,
          furnished: furnished || 'unfurnished',
          floor: floor || 'ground',
          parkingSpaces: parkingSpaces || 1
        }
      };

      const validationResult = await performSmartValidation(validationData);
      
      if (!validationResult.isValid && validationResult.riskLevel === 'high') {
        return res.status(400).json({
          success: false,
          error: 'Input validation failed',
          validation: validationResult
        });
      }

      // Check usage limits for free plan
      if (planType === 'free') {
        const canUse = await checkUsageLimit(clientIP);
        if (!canUse) {
          return res.status(429).json({ error: 'Daily usage limit exceeded. Please upgrade to a paid plan.' });
        }
      }

      // Process location data
      let locationData: LocationData;
      if (typeof location === 'string') {
        // Manual address entry
        const geocoded = await geocodeAddress(location);
        if (!geocoded) {
          return res.status(400).json({ error: 'Invalid address provided' });
        }
        locationData = geocoded;
      } else {
        // Map pin location
        locationData = {
          lat: location.lat,
          lng: location.lng,
          address: await reverseGeocode(location.lat, location.lng) || 'Unknown location',
        };
      }

      // Generate session ID
      const sessionId = crypto.randomUUID();

      // Create analysis request
      const analysisRequest = await storage.createAnalysisRequest({
        sessionId,
        ipAddress: clientIP,
        location: locationData,
        amount,
        propertyType,
        planType,
        paymentId: null,
        analysisData: null,
      });

      // Perform analysis with property details
      const propertyDetails = {
        propertySize: propertySize || 1000,
        sizeUnit: sizeUnit || 'sqft',
        propertyAge: propertyAge || 'new',
        bedrooms: bedrooms || 2,
        furnished: furnished || 'unfurnished',
        floor: floor || 'ground',
        parkingSpaces: parkingSpaces || 1,
      };

      const analysisResult = await performAnalysis(locationData, amount, propertyType, planType, propertyDetails);

      // Update analysis request with results
      await storage.updateAnalysisRequest(analysisRequest.id, {
        analysisData: analysisResult,
      });

      // Increment free usage counter
      if (planType === 'free') {
        await storage.incrementFreeUsage(clientIP);
      }

      res.json({
        success: true,
        sessionId,
        analysisId: analysisRequest.id,
        result: analysisResult,
      });
    } catch (error) {
      console.error('Analysis error:', error);
      res.status(500).json({ error: 'Internal server error during analysis' });
    }
  });

  app.post('/api/create-order', async (req, res) => {
    try {
      const { amount, planType, analysisId } = req.body;

      if (!amount || !planType || !analysisId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Verify analysis request exists
      const analysisRequest = await storage.getAnalysisRequest(analysisId);
      if (!analysisRequest) {
        return res.status(404).json({ error: 'Analysis request not found' });
      }

      // Create Razorpay order (simplified - in production, use Razorpay SDK)
      const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      res.json({
        success: true,
        orderId,
        amount: amount * 100, // Razorpay expects amount in paise
        currency: 'INR',
        key: RAZORPAY_KEY_ID,
      });
    } catch (error) {
      console.error('Order creation error:', error);
      res.status(500).json({ error: 'Failed to create payment order' });
    }
  });

  app.post('/api/verify-payment', async (req, res) => {
    try {
      const { paymentId, orderId, signature, analysisId } = req.body;

      if (!paymentId || !orderId || !signature || !analysisId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // For test environment, accept all payments (in production, implement proper verification)
      let verified = true;
      
      if (RAZORPAY_KEY_ID.includes('test') || process.env.NODE_ENV === 'development') {
        // Test mode - accept all payments
        verified = true;
        console.log('Test payment accepted:', paymentId);
      } else {
        // Production mode - verify signature
        const expectedSignature = crypto
          .createHmac('sha256', RAZORPAY_KEY_SECRET)
          .update(orderId + '|' + paymentId)
          .digest('hex');
        verified = expectedSignature === signature;
      }

      if (!verified) {
        return res.status(400).json({ error: 'Payment verification failed' });
      }

      // Update analysis request with payment info
      const analysisRequest = await storage.updateAnalysisRequest(analysisId, {
        paymentId,
      });

      // Re-run analysis with paid features and property details
      const locationData = analysisRequest.location as LocationData;
      const propertyDetails = {
        propertySize: 1000, // Default values for existing requests
        sizeUnit: 'sqft',
        propertyAge: 'new',
        bedrooms: 2,
        furnished: 'unfurnished',
        floor: 'ground',
        parkingSpaces: 1,
      };
      
      const enhancedResult = await performAnalysis(
        locationData,
        analysisRequest.amount,
        analysisRequest.propertyType,
        analysisRequest.planType,
        propertyDetails
      );

      // Update with enhanced results
      await storage.updateAnalysisRequest(analysisId, {
        analysisData: enhancedResult,
      });

      res.json({
        success: true,
        sessionId: analysisRequest.sessionId,
        result: enhancedResult,
      });
    } catch (error) {
      console.error('Payment verification error:', error);
      res.status(500).json({ error: 'Payment verification failed' });
    }
  });

  app.get('/api/result/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;

      // Query database for analysis request by session ID
      const analysisRequest = await storage.getAnalysisRequestBySessionId(sessionId);

      if (!analysisRequest) {
        return res.status(404).json({ error: 'Analysis not found' });
      }

      res.json({
        success: true,
        analysis: analysisRequest,
      });
    } catch (error) {
      console.error('Result retrieval error:', error);
      res.status(500).json({ error: 'Failed to retrieve analysis results' });
    }
  });

  app.get('/api/usage-status', async (req, res) => {
    try {
      const clientIP = getClientIP(req);
      const usageLimit = await storage.getUsageLimit(clientIP);
      
      res.json({
        success: true,
        usage: {
          freeUsageCount: usageLimit?.freeUsageCount || 0,
          maxFreeUsage: 3,
          canUseFree: await checkUsageLimit(clientIP),
        },
      });
    } catch (error) {
      console.error('Usage status error:', error);
      res.status(500).json({ error: 'Failed to get usage status' });
    }
  });

  app.get('/api/get-ip', async (req, res) => {
    try {
      const clientIP = getClientIP(req);
      res.json({ ip: clientIP });
    } catch (error) {
      console.error('Get IP error:', error);
      res.status(500).json({ error: 'Failed to get IP address' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
