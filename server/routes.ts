import { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateInvestmentRecommendations, findTopInvestmentLocations } from "./gemini";
import { performSmartValidation } from "./smartValidation";

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
  const server = createServer(app);

  // Google Maps configuration endpoint
  app.get("/api/maps-config", (req: Request, res: Response) => {
    res.json({ 
      apiKey: process.env.GOOGLE_MAPS_API_KEY || "",
      isConfigured: !!process.env.GOOGLE_MAPS_API_KEY
    });
  });

  // Usage status endpoint  
  app.get("/api/usage-status", async (req: Request, res: Response) => {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress || "127.0.0.1";
      let usageLimit = await storage.getUsageLimit(ipAddress);
      
      if (!usageLimit) {
        usageLimit = await storage.createUsageLimit({
          ipAddress,
          freeUsageCount: 0,
          lastUsageDate: new Date().toISOString().split('T')[0]
        });
      }

      // Reset daily usage if it's a new day
      const today = new Date().toISOString().split('T')[0];
      if (usageLimit.lastUsageDate !== today) {
        usageLimit = await storage.resetDailyUsage(ipAddress);
      }

      res.json({
        freeUsageCount: usageLimit.freeUsageCount,
        canUseFree: usageLimit.freeUsageCount < 3,
        dailyLimit: 3
      });
    } catch (error) {
      console.error("Error getting usage status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Razorpay webhook handler
  app.post("/api/razorpay/webhook", async (req: Request, res: Response) => {
    try {
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
      
      if (!razorpay_payment_id || !razorpay_order_id) {
        return res.status(400).json({ error: "Missing payment details" });
      }

      // Find analysis request by payment ID
      const analysisRequest = await storage.getAnalysisRequestByPaymentId(razorpay_order_id);
      if (!analysisRequest) {
        return res.status(404).json({ error: "Analysis request not found" });
      }

      // Update analysis request with payment details
      await storage.updateAnalysisRequest(analysisRequest.id, {
        paymentStatus: "completed",
        paymentId: razorpay_payment_id
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Webhook processing error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create analysis request
  app.post("/api/analysis/create", async (req: Request, res: Response) => {
    try {
      const { location, amount, propertyType, planType, propertyDetails } = req.body;
      
      if (!location || !amount || !propertyType || !planType) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const analysisRequest = await storage.createAnalysisRequest({
        sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        location: JSON.stringify(location),
        amount: parseFloat(amount),
        propertyType,
        planType,
        propertyDetails: propertyDetails ? JSON.stringify(propertyDetails) : null,
        paymentStatus: "completed", // Bypass payment for all plans temporarily
        status: "pending"
      });

      res.json({ analysisId: analysisRequest.id, sessionId: analysisRequest.sessionId });
    } catch (error) {
      console.error("Error creating analysis request:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get analysis result
  app.get("/api/analysis/:sessionId", async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const analysisRequest = await storage.getAnalysisRequestBySessionId(sessionId);
      
      if (!analysisRequest) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      // Temporarily bypass payment verification for all plans
      // if (analysisRequest.paymentStatus !== "completed") {
      //   return res.status(402).json({ error: "Payment required" });
      // }

      if (analysisRequest.status === "completed" && analysisRequest.results) {
        const analysisData = JSON.parse(analysisRequest.results);
        return res.json({
          success: true,
          analysis: {
            id: analysisRequest.id,
            sessionId: analysisRequest.sessionId,
            location: typeof analysisRequest.location === 'string' 
              ? JSON.parse(analysisRequest.location) 
              : analysisRequest.location,
            amount: analysisRequest.amount,
            propertyType: analysisRequest.propertyType,
            planType: analysisRequest.planType,
            analysisData: analysisData,
            createdAt: analysisRequest.createdAt
          }
        });
      }

      // Perform analysis
      const location = typeof analysisRequest.location === 'string' 
        ? JSON.parse(analysisRequest.location) 
        : analysisRequest.location;
      const propertyDetails = analysisRequest.propertyDetails ? JSON.parse(analysisRequest.propertyDetails) : null;
      
      const result = await performAnalysis(
        location,
        analysisRequest.amount,
        analysisRequest.propertyType,
        analysisRequest.planType,
        propertyDetails
      );

      // Update analysis request with results
      await storage.updateAnalysisRequest(analysisRequest.id, {
        status: "completed",
        results: JSON.stringify(result)
      });

      // Return wrapped result
      res.json({
        success: true,
        analysis: {
          id: analysisRequest.id,
          sessionId: analysisRequest.sessionId,
          location: location,
          amount: analysisRequest.amount,
          propertyType: analysisRequest.propertyType,
          planType: analysisRequest.planType,
          analysisData: result,
          createdAt: analysisRequest.createdAt
        }
      });
    } catch (error) {
      console.error("Error getting analysis:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Frontend results endpoint (alias for analysis endpoint)
  app.get("/api/result/:sessionId", async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const analysisRequest = await storage.getAnalysisRequestBySessionId(sessionId);
      
      if (!analysisRequest) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      // Temporarily bypass payment verification for all plans
      // if (analysisRequest.paymentStatus !== "completed") {
      //   return res.status(402).json({ error: "Payment required" });
      // }

      if (analysisRequest.status === "completed" && analysisRequest.results) {
        const analysisData = JSON.parse(analysisRequest.results);
        return res.json({
          success: true,
          analysis: {
            id: analysisRequest.id,
            sessionId: analysisRequest.sessionId,
            location: typeof analysisRequest.location === 'string' 
              ? JSON.parse(analysisRequest.location) 
              : analysisRequest.location,
            amount: analysisRequest.amount,
            propertyType: analysisRequest.propertyType,
            planType: analysisRequest.planType,
            analysisData: analysisData,
            createdAt: analysisRequest.createdAt
          }
        });
      }

      // Perform analysis if not completed yet
      const location = typeof analysisRequest.location === 'string' 
        ? JSON.parse(analysisRequest.location) 
        : analysisRequest.location;
      const propertyDetails = analysisRequest.propertyDetails ? JSON.parse(analysisRequest.propertyDetails) : null;
      
      const result = await performAnalysis(
        location,
        analysisRequest.amount,
        analysisRequest.propertyType,
        analysisRequest.planType,
        propertyDetails
      );

      // Update analysis request with results
      await storage.updateAnalysisRequest(analysisRequest.id, {
        status: "completed",
        results: JSON.stringify(result)
      });

      // Return wrapped result
      res.json({
        success: true,
        analysis: {
          id: analysisRequest.id,
          sessionId: analysisRequest.sessionId,
          location: location,
          amount: analysisRequest.amount,
          propertyType: analysisRequest.propertyType,
          planType: analysisRequest.planType,
          analysisData: result,
          createdAt: analysisRequest.createdAt
        }
      });
    } catch (error) {
      console.error("Error getting analysis result:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Smart validation endpoint
  app.post("/api/validate", async (req: Request, res: Response) => {
    try {
      const { location, propertyData } = req.body;
      
      if (!location || !propertyData) {
        return res.status(400).json({ error: "Missing location or property data" });
      }

      const validation = await performSmartValidation({ location, propertyData });
      res.json(validation);
    } catch (error) {
      console.error("Validation error:", error);
      res.status(500).json({ error: "Validation failed" });
    }
  });

  // Frontend validation endpoint
  app.post("/api/validate-inputs", async (req: Request, res: Response) => {
    try {
      const { location, propertyData } = req.body;
      
      if (!location || !propertyData) {
        return res.status(400).json({ error: "Missing location or property data" });
      }

      const validation = await performSmartValidation({ location, propertyData });
      res.json({ success: true, validation });
    } catch (error) {
      console.error("Validation error:", error);
      res.json({ success: false, validation: null });
    }
  });

  // Frontend analysis endpoint
  app.post("/api/analyze", async (req: Request, res: Response) => {
    try {
      const { location, amount, propertyType, planType = "free", ...propertyDetails } = req.body;
      
      if (!location || !amount || !propertyType) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
      }

      // Get client IP for usage tracking
      const ipAddress = req.ip || req.connection.remoteAddress || "127.0.0.1";
      
      // Check usage limits for free tier
      if (planType === "free") {
        let usageLimit = await storage.getUsageLimit(ipAddress);
        
        if (!usageLimit) {
          usageLimit = await storage.createUsageLimit({
            ipAddress,
            freeUsageCount: 0,
            lastUsageDate: new Date().toISOString().split('T')[0]
          });
        }

        // Reset daily usage if it's a new day
        const today = new Date().toISOString().split('T')[0];
        if (usageLimit.lastUsageDate !== today) {
          usageLimit = await storage.resetDailyUsage(ipAddress);
        }

        if (usageLimit.freeUsageCount >= 3) {
          return res.status(429).json({ success: false, error: "Daily free usage limit reached" });
        }

        // Increment usage count
        await storage.incrementFreeUsage(ipAddress);
      }

      const analysisRequest = await storage.createAnalysisRequest({
        sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        location: JSON.stringify(location),
        amount: parseFloat(amount),
        propertyType,
        planType,
        propertyDetails: JSON.stringify(propertyDetails),
        paymentStatus: "completed", // Bypass payment for all plans temporarily
        status: "pending"
      });

      res.json({ success: true, sessionId: analysisRequest.sessionId, analysisId: analysisRequest.id });
    } catch (error) {
      console.error("Error creating analysis:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // Usage limit management
  app.get("/api/usage/:ipAddress", async (req: Request, res: Response) => {
    try {
      const { ipAddress } = req.params;
      let usageLimit = await storage.getUsageLimit(ipAddress);
      
      if (!usageLimit) {
        usageLimit = await storage.createUsageLimit({
          ipAddress,
          freeUsageCount: 0,
          lastUsageDate: new Date().toISOString().split('T')[0]
        });
      }

      // Reset daily usage if it's a new day
      const today = new Date().toISOString().split('T')[0];
      if (usageLimit.lastUsageDate !== today) {
        usageLimit = await storage.resetDailyUsage(ipAddress);
      }

      res.json(usageLimit);
    } catch (error) {
      console.error("Error getting usage:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/usage/:ipAddress/increment", async (req: Request, res: Response) => {
    try {
      const { ipAddress } = req.params;
      const usageLimit = await storage.incrementFreeUsage(ipAddress);
      res.json(usageLimit);
    } catch (error) {
      console.error("Error incrementing usage:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Enhanced essential service detection that counts ALL nearby places as valuable
  const isEssentialService = (place: PlaceDetails): boolean => {
    // Accept ALL place types as providing some essential value
    // This includes restaurants, stores, health facilities, transit, etc.
    return place.types && place.types.length > 0;
  };

  const calculateDistances = async (origin: LocationData, destinations: PlaceDetails[]): Promise<Record<string, DistanceData>> => {
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      throw new Error("Google Maps API key not configured");
    }

    const distances: Record<string, DistanceData> = {};
    
    try {
      // Process destinations in batches to avoid API limits
      const batchSize = 10;
      for (let i = 0; i < destinations.length; i += batchSize) {
        const batch = destinations.slice(i, i + batchSize);
        
        const destinationString = batch.map(place => `${place.vicinity}`).join('|');
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${encodeURIComponent(destinationString)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === 'OK' && data.rows[0]) {
          data.rows[0].elements.forEach((element: any, index: number) => {
            if (element.status === 'OK') {
              const place = batch[index];
              distances[place.name] = {
                distance: element.distance,
                duration: element.duration
              };
            }
          });
        }
        
        // Add delay between batches to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error("Distance calculation error:", error);
    }
    
    return distances;
  };

  const performAnalysis = async (location: LocationData, amount: number, propertyType: string, planType: string, propertyDetails?: any): Promise<AnalysisResult> => {
    const result: AnalysisResult = {
      locationScore: 0,
      growthPrediction: 0,
      nearbyPlaces: [],
      distances: {},
      investmentViability: 0,
      businessGrowthRate: 0,
      populationGrowthRate: 0,
      investmentRecommendation: "Analysis in progress..."
    };

    if (!process.env.GOOGLE_MAPS_API_KEY) {
      throw new Error("Google Maps API key not configured");
    }

    try {
      // Enhanced place search with infrastructure-focused types
      const placeTypes = [
        'hospital', 'pharmacy', 'doctor', 'health', 'medical_center',
        'school', 'university', 'college', 'library', 'education',
        'bank', 'atm', 'finance', 'accounting',
        'store', 'supermarket', 'grocery_or_supermarket', 'shopping_mall',
        'gas_station', 'car_repair', 'automotive',
        'transit_station', 'bus_station', 'subway_station', 'train_station',
        'police', 'fire_station', 'local_government_office',
        'restaurant', 'food', 'meal_takeaway', 'cafe',
        'gym', 'park', 'recreation', 'entertainment',
        'church', 'mosque', 'hindu_temple', 'place_of_worship'
      ];

      const allPlaces: PlaceDetails[] = [];
      
      // Search for places in optimized batches to avoid API timeouts
      const priorityTypes = ['restaurant', 'hospital', 'school', 'bank', 'store', 'gas_station', 'park', 'transit_station'];
      const searchTypes = priorityTypes.slice(0, 8); // Limit to 8 most important types
      
      for (const type of searchTypes) {
        try {
          const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=10000&type=${type}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
          const response = await fetch(url);
          const data = await response.json();
          
          if (data.status === 'OK' && data.results) {
            const places = data.results.slice(0, 3).map((place: any) => ({
              place_id: place.place_id,
              name: place.name,
              vicinity: place.vicinity || place.formatted_address || '',
              rating: place.rating,
              types: place.types || []
            }));
            
            allPlaces.push(...places);
          }
          
          // Reduced rate limiting for faster processing
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error searching for ${type}:`, error);
        }
      }

      // Remove duplicates based on place_id
      const uniquePlaces = allPlaces.filter((place, index, self) => 
        index === self.findIndex(p => p.place_id === place.place_id)
      );

      result.nearbyPlaces = uniquePlaces.slice(0, 25); // Limit to 25 best places

      // Calculate distances for all places
      if (result.nearbyPlaces.length > 0) {
        result.distances = await calculateDistances(location, result.nearbyPlaces);
      }

      // Advanced infrastructure scoring with categorized services
      let infrastructureScores = {
        healthcare: { close: 0, total: 0 },
        education: { close: 0, total: 0 },
        transport: { close: 0, total: 0 },
        commercial: { close: 0, total: 0 },
        essential: { close: 0, total: 0 },
        connectivity: 0
      };

      // Categorize and score places by infrastructure type
      result.nearbyPlaces.forEach(place => {
        const distance = result.distances[place.name];
        if (!distance) return;

        const isClose = distance.distance.value <= 3000; // 3km radius
        const isVeryClose = distance.distance.value <= 2000; // 2km radius

        // Healthcare infrastructure
        if (place.types.some(type => ['hospital', 'pharmacy', 'doctor', 'health', 'medical_center'].includes(type))) {
          infrastructureScores.healthcare.total++;
          if (isClose) infrastructureScores.healthcare.close++;
        }

        // Educational infrastructure
        if (place.types.some(type => ['school', 'university', 'college', 'library', 'education'].includes(type))) {
          infrastructureScores.education.total++;
          if (isClose) infrastructureScores.education.close++;
        }

        // Transport infrastructure
        if (place.types.some(type => ['transit_station', 'bus_station', 'subway_station', 'train_station', 'gas_station'].includes(type))) {
          infrastructureScores.transport.total++;
          if (isClose) infrastructureScores.transport.close++;
        }

        // Commercial infrastructure
        if (place.types.some(type => ['store', 'supermarket', 'grocery_or_supermarket', 'shopping_mall', 'bank', 'atm'].includes(type))) {
          infrastructureScores.commercial.total++;
          if (isClose) infrastructureScores.commercial.close++;
        }

        // Essential services (cumulative)
        if (isEssentialService(place)) {
          infrastructureScores.essential.total++;
          if (isClose) infrastructureScores.essential.close++;
        }
      });

      // Enhanced connectivity scoring using Google Roads API and place analysis
      let baseConnectivityScore = 0;
      
      // Base connectivity from transport infrastructure
      baseConnectivityScore += infrastructureScores.transport.total * 15; // 15 points per transport hub
      
      // Check for highway/major road indicators in nearby places
      const roadIndicators = result.nearbyPlaces.filter(place => 
        place.types.includes('gas_station') || 
        place.types.includes('rest_stop') ||
        place.name.toLowerCase().includes('highway') ||
        place.name.toLowerCase().includes('interstate') ||
        place.name.toLowerCase().includes('expressway') ||
        place.vicinity.toLowerCase().includes('highway') ||
        place.vicinity.toLowerCase().includes('interstate')
      );
      
      baseConnectivityScore += roadIndicators.length * 25; // 25 points per highway indicator
      
      // Bonus for multiple gas stations (indicates major road network)
      const gasStations = result.nearbyPlaces.filter(place => place.types.includes('gas_station'));
      if (gasStations.length >= 3) baseConnectivityScore += 30; // Highway corridor bonus
      
      infrastructureScores.connectivity = Math.min(baseConnectivityScore, 100); // Cap at 100%
      
      // DESERT/REMOTE LOCATION DETECTION: Enhanced criteria with error handling
      const addressLower = location.address.toLowerCase();
      const totalInfrastructure = infrastructureScores.healthcare.total + infrastructureScores.education.total + 
                                  infrastructureScores.transport.total + infrastructureScores.commercial.total;
      
      // Check for API errors in distance calculations
      const hasDistanceErrors = Object.values(result.distances).some(dist => 
        dist.distance.value > 500000 // More than 500km indicates API error
      );
      
      // If API errors, use basic place count and address analysis
      const isDesertOrRemote = !hasDistanceErrors ? (
        result.nearbyPlaces.length < 8 || 
        totalInfrastructure < 6 || 
        infrastructureScores.essential.close < 2 || 
        infrastructureScores.connectivity < 20
      ) : false; // Don't flag as desert if API has errors
      
      // Always check address-based desert detection
      const isKnownDesertArea = (
        addressLower.includes('desert') ||
        addressLower.includes('canyon') ||
        addressLower.includes('wilderness') ||
        addressLower.includes('national park') ||
        addressLower.includes('grand canyon') ||
        addressLower.includes('death valley') ||
        addressLower.includes('sahara') ||
        addressLower.includes('mojave') ||
        addressLower.includes('badlands') ||
        addressLower.includes('monument valley')
      );
      
      if (isDesertOrRemote || isKnownDesertArea) {
        result.locationScore = 0.0;
        result.investmentViability = 0;
        result.growthPrediction = -10; // Negative growth for uninhabitable areas
        result.businessGrowthRate = -5.0;
        result.populationGrowthRate = -3.0;
        result.investmentRecommendation = "Uninhabitable Location - 0% Investment Potential";
        return result;
      }

      // Advanced infrastructure-based location scoring (1-5 scale)
      const healthcareScore = Math.min(infrastructureScores.healthcare.total / 3, 1.0); // Max at 3+ healthcare facilities
      const educationScore = Math.min(infrastructureScores.education.total / 4, 1.0); // Max at 4+ educational institutions
      const transportScore = Math.min(infrastructureScores.transport.total / 5, 1.0); // Max at 5+ transport hubs
      const commercialScore = Math.min(infrastructureScores.commercial.total / 6, 1.0); // Max at 6+ commercial facilities
      const finalConnectivityScore = infrastructureScores.connectivity / 100; // Convert to 0-1 scale
      
      // Proximity bonus for services within 3km
      const proximityBonus = (infrastructureScores.essential.close / Math.max(infrastructureScores.essential.total, 1)) * 0.5;
      
      // Comprehensive infrastructure scoring with proper weightings
      result.locationScore = (
        healthcareScore * 0.25 +      // 25% - Healthcare infrastructure
        educationScore * 0.20 +       // 20% - Educational infrastructure  
        transportScore * 0.25 +       // 25% - Transport/Connectivity
        commercialScore * 0.15 +      // 15% - Commercial infrastructure
        connectivityScore * 0.15      // 15% - Highway/Road connectivity
      ) * 5 + proximityBonus; // Scale to 5-star + proximity bonus

      // Street View URL for all tiers
      result.streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=800x400&location=${location.lat},${location.lng}&heading=0&pitch=0&key=${process.env.GOOGLE_MAPS_API_KEY}`;

      // Base investment metrics (convert 5-star score to percentage)
      const scoreAsPercentage = (result.locationScore / 5) * 100;
      result.investmentViability = Math.min(scoreAsPercentage * 0.8, 95); // Cap at 95%
      result.businessGrowthRate = Math.min(scoreAsPercentage * 0.15, 12); // Cap at 12%
      result.populationGrowthRate = Math.min(scoreAsPercentage * 0.08, 6); // Cap at 6%
      result.growthPrediction = Math.min(scoreAsPercentage * 0.2, 15); // Cap at 15%

      // Tier-specific enhancements
      if (planType === "basic" || planType === "pro") {
        // AI recommendations for Basic and Pro tiers
        try {
          const aiRecommendations = await generateInvestmentRecommendations({
            location,
            amount,
            propertyType,
            nearbyPlaces: result.nearbyPlaces,
            distances: result.distances
          });
          result.aiRecommendations = aiRecommendations;
        } catch (error) {
          console.error("AI recommendations error:", error);
          result.aiRecommendations = ["AI analysis temporarily unavailable"];
        }

        // Location image for Basic and Pro tiers
        result.locationImageUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${location.lat},${location.lng}&zoom=15&size=600x400&maptype=satellite&key=${process.env.GOOGLE_MAPS_API_KEY}`;
      }

      if (planType === "pro") {
        // Top investment locations for Pro tier only
        try {
          const topLocations = await findTopInvestmentLocations(location, amount, propertyType);
          result.topInvestmentLocations = topLocations;
        } catch (error) {
          console.error("Top locations error:", error);
          result.topInvestmentLocations = [];
        }
      }

      // Investment recommendation text
      if (result.investmentViability >= 80) {
        result.investmentRecommendation = "Excellent Investment Opportunity - High Growth Potential";
      } else if (result.investmentViability >= 60) {
        result.investmentRecommendation = "Good Investment Potential - Moderate Growth Expected";
      } else if (result.investmentViability >= 40) {
        result.investmentRecommendation = "Fair Investment Opportunity - Stable Growth";
      } else if (result.investmentViability >= 20) {
        result.investmentRecommendation = "Limited Investment Potential - High Risk";
      } else {
        result.investmentRecommendation = "Poor Investment Location - Not Recommended";
      }

    } catch (error) {
      console.error("Analysis error:", error);
      result.investmentRecommendation = "Analysis temporarily unavailable";
    }

    return result;
  };

  return server;
}