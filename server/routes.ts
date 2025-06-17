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
        paymentStatus: planType === "free" ? "completed" : "pending",
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

      if (analysisRequest.paymentStatus !== "completed") {
        return res.status(402).json({ error: "Payment required" });
      }

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

      if (analysisRequest.paymentStatus !== "completed") {
        return res.status(402).json({ error: "Payment required" });
      }

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

      // Analysis not completed yet
      return res.status(202).json({ 
        success: false, 
        message: "Analysis in progress",
        status: analysisRequest.status 
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
        paymentStatus: planType === "free" ? "completed" : "pending",
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
      // Enhanced place search with comprehensive types
      const placeTypes = [
        'restaurant', 'food', 'meal_takeaway', 'cafe', 'bakery',
        'hospital', 'pharmacy', 'doctor', 'health', 'medical_center',
        'school', 'university', 'library', 'education',
        'bank', 'atm', 'finance', 'accounting',
        'store', 'supermarket', 'grocery_or_supermarket', 'shopping_mall',
        'gas_station', 'car_repair', 'automotive',
        'gym', 'park', 'recreation', 'entertainment',
        'transit_station', 'bus_station', 'subway_station',
        'police', 'fire_station', 'local_government_office',
        'church', 'mosque', 'hindu_temple', 'place_of_worship',
        'real_estate_agency', 'moving_company', 'storage'
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

      // Count services within 3km radius for habitability assessment
      let closeEssentialServices = 0;
      Object.entries(result.distances).forEach(([placeName, dist]) => {
        const place = result.nearbyPlaces.find(p => p.name === placeName);
        if (place && dist.distance.value <= 3000) { // 3km radius
          closeEssentialServices++;
        }
      });
      
      // DESERT/REMOTE LOCATION DETECTION: Zero infrastructure = 0% recommendation
      if (result.nearbyPlaces.length === 0 || closeEssentialServices === 0) {
        result.locationScore = 0.0;
        result.investmentViability = 0;
        result.growthPrediction = -10; // Negative growth for uninhabitable areas
        result.businessGrowthRate = -5.0;
        result.populationGrowthRate = -3.0;
        result.investmentRecommendation = "Uninhabitable Location - 0% Investment Potential";
        return result;
      }

      // Calculate location score based on nearby services
      const totalServices = result.nearbyPlaces.length;
      const serviceScore = Math.min(totalServices / 10, 1.0); // Max score at 10+ services
      const proximityScore = closeEssentialServices / Math.max(totalServices, 1);
      
      result.locationScore = (serviceScore * 0.6 + proximityScore * 0.4) * 100;

      // Street View URL for all tiers
      result.streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=800x400&location=${location.lat},${location.lng}&heading=0&pitch=0&key=${process.env.GOOGLE_MAPS_API_KEY}`;

      // Base investment metrics
      result.investmentViability = Math.min(result.locationScore * 0.8, 95); // Cap at 95%
      result.businessGrowthRate = Math.min(result.locationScore * 0.15, 12); // Cap at 12%
      result.populationGrowthRate = Math.min(result.locationScore * 0.08, 6); // Cap at 6%
      result.growthPrediction = Math.min(result.locationScore * 0.2, 15); // Cap at 15%

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