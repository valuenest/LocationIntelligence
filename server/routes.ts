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
            if (element.status === 'OK' && element.distance) {
              // Only include if within 5km (5000 meters)
              if (element.distance.value <= 5000) {
                const place = batch[index];
                distances[place.name] = {
                  distance: element.distance,
                  duration: element.duration
                };
              }
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
      const priorityTypes = [
        'restaurant', 'hospital', 'school', 'bank', 'store', 'gas_station', 
        'park', 'transit_station', 'shopping_mall', 'pharmacy', 'atm',
        'establishment', 'finance', 'real_estate_agency', 'lodging',
        'gym', 'spa', 'cafe', 'bar'
      ];
      const searchTypes = priorityTypes.slice(0, 16); // Expanded to capture lifestyle amenities
      
      for (const type of searchTypes) {
        try {
          const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=5000&type=${type}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
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

      // Calculate distances for all places and filter to 5km
      if (result.nearbyPlaces.length > 0) {
        result.distances = await calculateDistances(location, result.nearbyPlaces);
        
        // Since distance calculation now filters to 5km, update nearbyPlaces to match
        const placesWithDistances = result.nearbyPlaces.filter(place => 
          result.distances[place.name] !== undefined
        );
        
        result.nearbyPlaces = placesWithDistances;
        console.log(`Showing ${result.nearbyPlaces.length} places within 5km radius`);
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

      // Infrastructure analysis within 10km radius with weighted scoring
      result.nearbyPlaces.forEach(place => {
        const distance = result.distances[place.name];
        if (!distance) return;

        const distanceKm = distance.distance.value / 1000;
        const within5km = distanceKm <= 5;   // 5km radius for infrastructure analysis
        const within3km = distanceKm <= 3;   // Close proximity bonus
        const within1km = distanceKm <= 1;   // Very close proximity bonus

        if (!within5km) return; // Only consider places within 5km

        // Calculate rating bonus based on place rating
        const ratingMultiplier = place.rating ? Math.min(place.rating / 5, 1) : 0.6; // Default 0.6 for unrated

        // Healthcare infrastructure with rating consideration
        if (place.types.some(type => ['hospital', 'pharmacy', 'doctor', 'health', 'medical_center'].includes(type))) {
          infrastructureScores.healthcare.total += ratingMultiplier;
          if (within3km) infrastructureScores.healthcare.close += ratingMultiplier;
        }

        // Educational infrastructure with rating consideration
        if (place.types.some(type => ['school', 'university', 'college', 'library', 'education'].includes(type))) {
          infrastructureScores.education.total += ratingMultiplier;
          if (within3km) infrastructureScores.education.close += ratingMultiplier;
        }

        // Transport infrastructure with rating consideration
        if (place.types.some(type => ['transit_station', 'bus_station', 'subway_station', 'train_station', 'gas_station'].includes(type))) {
          infrastructureScores.transport.total += ratingMultiplier;
          if (within3km) infrastructureScores.transport.close += ratingMultiplier;
        }

        // Commercial infrastructure with rating consideration (expanded for business districts)
        if (place.types.some(type => [
          'store', 'supermarket', 'grocery_or_supermarket', 'shopping_mall', 'bank', 'atm',
          'establishment', 'finance', 'insurance_agency', 'real_estate_agency', 'accounting',
          'lawyer', 'point_of_interest', 'business_center', 'office_building'
        ].includes(type))) {
          let commercialScore = ratingMultiplier;
          // Business/financial establishments get higher weighting
          if (place.types.some(type => ['finance', 'bank', 'insurance_agency', 'real_estate_agency'].includes(type))) {
            commercialScore *= 1.5; // 50% bonus for financial services
          }
          infrastructureScores.commercial.total += commercialScore;
          if (within3km) infrastructureScores.commercial.close += commercialScore;
        }

        // Premium lifestyle amenities scoring (indicates upscale areas)
        if (place.types.some(type => ['lodging', 'spa', 'gym', 'cafe', 'bar', 'restaurant'].includes(type))) {
          let lifestyleScore = ratingMultiplier;
          
          // Premium establishments get significant bonuses
          if (place.rating && place.rating >= 4.5) {
            lifestyleScore *= 2.0; // Double score for highly rated places
          } else if (place.rating && place.rating >= 4.0) {
            lifestyleScore *= 1.5; // 50% bonus for good rated places
          }
          
          // Luxury hotels and spas indicate premium areas
          if (place.types.includes('lodging') && (place.name.toLowerCase().includes('palace') || 
              place.name.toLowerCase().includes('luxury') || place.name.toLowerCase().includes('resort'))) {
            lifestyleScore *= 2.5; // Major bonus for luxury establishments
          }
          
          infrastructureScores.commercial.total += lifestyleScore;
          if (within3km) infrastructureScores.commercial.close += lifestyleScore;
        }

        // Essential services with proximity and rating weighting
        if (isEssentialService(place)) {
          let essentialScore = ratingMultiplier;
          if (within1km) essentialScore *= 1.8; // 80% bonus for very close
          else if (within3km) essentialScore *= 1.4; // 40% bonus for close
          else essentialScore *= 1.1; // 10% bonus for within 5km
          
          infrastructureScores.essential.total += essentialScore;
          if (within3km) infrastructureScores.essential.close += essentialScore;
        }
      });

      // Comprehensive connectivity scoring for National Highways, airports, ports, helipads
      let connectivityAnalysis = {
        nationalHighways: 0,
        localRoads: 0,
        airports: 0,
        ports: 0,
        helipads: 0,
        railwayStations: 0
      };
      
      // Analyze connectivity infrastructure within 5km
      result.nearbyPlaces.forEach(place => {
        const distance = result.distances[place.name];
        if (!distance || distance.distance.value > 5000) return; // Only within 5km
        
        const placeName = place.name.toLowerCase();
        const placeVicinity = place.vicinity?.toLowerCase() || '';
        const placeTypes = place.types || [];
        
        // National Highways and Major Roads
        if (placeName.includes('national highway') || placeName.includes('nh-') || 
            placeName.includes('highway') || placeName.includes('expressway') ||
            placeVicinity.includes('highway') || placeVicinity.includes('expressway')) {
          connectivityAnalysis.nationalHighways += 40; // High score for NH
        }
        
        // Gas stations indicate major road networks
        if (placeTypes.includes('gas_station')) {
          connectivityAnalysis.localRoads += 15;
        }
        
        // Airports and Aerodromes
        if (placeTypes.includes('airport') || placeName.includes('airport') || 
            placeName.includes('aerodrome') || placeName.includes('airfield')) {
          connectivityAnalysis.airports += 50; // Highest connectivity score
        }
        
        // Helipads
        if (placeName.includes('helipad') || placeName.includes('helicopter') ||
            placeTypes.includes('heliport')) {
          connectivityAnalysis.helipads += 30;
        }
        
        // Ports and Harbors
        if (placeName.includes('port') || placeName.includes('harbor') || 
            placeName.includes('harbour') || placeTypes.includes('marina')) {
          connectivityAnalysis.ports += 45;
        }
        
        // Railway Stations
        if (placeTypes.includes('transit_station') || placeTypes.includes('train_station') ||
            placeName.includes('railway') || placeName.includes('station')) {
          connectivityAnalysis.railwayStations += 35;
        }
      });
      
      // Calculate final connectivity score
      const totalConnectivityScore = Math.min(
        connectivityAnalysis.nationalHighways + 
        connectivityAnalysis.localRoads + 
        connectivityAnalysis.airports + 
        connectivityAnalysis.ports + 
        connectivityAnalysis.helipads + 
        connectivityAnalysis.railwayStations, 
        100
      );
      
      infrastructureScores.connectivity = totalConnectivityScore;
      
      // DESERT/REMOTE LOCATION DETECTION: Enhanced criteria with error handling
      const addressLower = location.address.toLowerCase();
      const totalInfrastructure = infrastructureScores.healthcare.total + infrastructureScores.education.total + 
                                  infrastructureScores.transport.total + infrastructureScores.commercial.total;
      
      // Check for API errors in distance calculations
      const hasDistanceErrors = Object.values(result.distances).some(dist => 
        dist.distance.value > 500000 // More than 500km indicates API error
      );
      
      // Enhanced desert detection - more lenient for business districts
      const isDesertOrRemote = !hasDistanceErrors ? (
        result.nearbyPlaces.length < 3 || 
        (totalInfrastructure < 2 && infrastructureScores.essential.total < 1) ||
        (infrastructureScores.connectivity < 5 && infrastructureScores.commercial.total < 1 && infrastructureScores.essential.total < 1)
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
      
      // Address-based urban/rural detection for area classification will be used later
      
      if (isDesertOrRemote || isKnownDesertArea) {
        result.locationScore = 0.0;
        result.investmentViability = 0;
        result.growthPrediction = -10; // Negative growth for uninhabitable areas
        result.businessGrowthRate = -5.0;
        result.populationGrowthRate = -3.0;
        result.investmentRecommendation = "Uninhabitable Location - 0% Investment Potential";
        return result;
      }

      // Enhanced infrastructure scoring for premium urban areas
      const healthcareScore = Math.min(infrastructureScores.healthcare.total / 2.5, 1.2); // Allow scores above 1.0
      const educationScore = Math.min(infrastructureScores.education.total / 3, 1.2); // Allow scores above 1.0
      const transportScore = Math.min(infrastructureScores.transport.total / 3, 1.2); // Allow scores above 1.0
      const commercialScore = Math.min(infrastructureScores.commercial.total / 4, 1.5); // Higher weighting for commercial
      const finalConnectivityScore = Math.min(infrastructureScores.connectivity / 80, 1.2); // Allow connectivity bonus
      
      // Proximity bonus for services within 3km (adjusted for 5km radius)
      const proximityBonus = (infrastructureScores.essential.close / Math.max(infrastructureScores.essential.total, 1)) * 0.7;
      
      // Premium area detection bonuses
      let premiumAreaBonus = 0;
      
      // Check for luxury/premium indicators in nearby places
      const luxuryIndicators = result.nearbyPlaces.filter(place => {
        const name = place.name.toLowerCase();
        const vicinity = place.vicinity?.toLowerCase() || '';
        const isLuxury = name.includes('palace') || name.includes('luxury') || 
                        name.includes('premium') || name.includes('resort') ||
                        name.includes('five star') || name.includes('grand') ||
                        name.includes('leela') || name.includes('keys select') ||
                        name.includes('apollo') || vicinity.includes('hotel');
        const isHighRated = place.rating && place.rating >= 4.2;
        const isPremiumService = name.includes('apollo') || name.includes('vasan') ||
                               name.includes('portico') || name.includes('lemon tree');
        return isLuxury || isHighRated || isPremiumService;
      });
      
      if (luxuryIndicators.length >= 2) premiumAreaBonus += 1.0; // Significant premium area bonus
      else if (luxuryIndicators.length >= 1) premiumAreaBonus += 0.5; // Moderate premium bonus
      
      // Tech hub detection for IT corridors
      const techIndicators = result.nearbyPlaces.filter(place => {
        const name = place.name.toLowerCase();
        const vicinity = place.vicinity?.toLowerCase() || '';
        return name.includes('tech') || name.includes('it ') || name.includes('software') ||
               vicinity.includes('tech park') || vicinity.includes('it park') ||
               place.types.includes('establishment');
      });
      
      if (techIndicators.length >= 4) premiumAreaBonus += 0.8; // Tech hub bonus
      
      // Enhanced infrastructure scoring for premium urban recognition
      result.locationScore = (
        healthcareScore * 0.20 +      // 20% - Healthcare infrastructure
        educationScore * 0.15 +       // 15% - Educational infrastructure  
        transportScore * 0.20 +       // 20% - Transport/Connectivity
        commercialScore * 0.30 +      // 30% - Commercial & lifestyle infrastructure (increased)
        finalConnectivityScore * 0.15      // 15% - Highway/Road connectivity
      ) * 5 + proximityBonus + premiumAreaBonus; // Scale to 5-star + bonuses

      // Street View URL for all tiers
      result.streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=800x400&location=${location.lat},${location.lng}&heading=0&pitch=0&key=${process.env.GOOGLE_MAPS_API_KEY}`;

      // Area classification based on infrastructure and urban indicators
      const totalPlaces = result.nearbyPlaces.length;
      const totalInfrastructureForClassification = infrastructureScores.healthcare.total + infrastructureScores.education.total + 
                                  infrastructureScores.transport.total + infrastructureScores.commercial.total;
      
      let areaType = 'village'; // Default classification
      let maxViability = 35; // Village max 35%
      
      // More stringent metropolitan indicators
      const realMetroIndicators = result.nearbyPlaces.filter(place => {
        const name = place.name.toLowerCase();
        const vicinity = place.vicinity?.toLowerCase() || '';
        return (name.includes('airport') || vicinity.includes('airport')) ||
               (name.includes('metro') || vicinity.includes('metro')) ||
               (name.includes('mall') && name.includes('shopping')) ||
               (name.includes('hospital') && place.rating && place.rating >= 4.0) ||
               (name.includes('university') || name.includes('college'));
      });
      
      // Premium commercial indicators for cities
      const commercialIndicators = result.nearbyPlaces.filter(place => {
        const name = place.name.toLowerCase();
        return name.includes('bank') || name.includes('hotel') || 
               name.includes('restaurant') || name.includes('store');
      });
      
      // Check if address indicates rural area
      const isRuralByAddress = addressLower.includes('village') || addressLower.includes('rural') || 
                              addressLower.includes('farm') || addressLower.includes('countryside');
      
      console.log(`Classification Debug: Places=${totalPlaces}, Infrastructure=${totalInfrastructureForClassification}, RealMetro=${realMetroIndicators.length}, Commercial=${commercialIndicators.length}, RuralAddress=${isRuralByAddress}`);
      
      // Known tech hubs override other classifications
      const isTechHub = addressLower.includes('hsr') || addressLower.includes('electronic city') || 
                       addressLower.includes('whitefield') || addressLower.includes('koramangala') ||
                       addressLower.includes('indiranagar') || addressLower.includes('marathahalli') ||
                       addressLower.includes('sarjapur') || addressLower.includes('bellandur');
      
      // If address explicitly mentions rural/village, cap at village level
      if (isRuralByAddress) {
        areaType = 'village';
        maxViability = 35;
      }
      // Known tech hubs get metropolitan status
      else if (isTechHub) {
        areaType = 'metropolitan';
        maxViability = 95;
      }
      // Metropolitan classification based on infrastructure
      else if (totalPlaces >= 15 && totalInfrastructureForClassification >= 20 && 
          realMetroIndicators.length >= 2 && commercialIndicators.length >= 5) {
        areaType = 'metropolitan';
        maxViability = 95;
      } 
      // City classification
      else if (totalPlaces >= 12 && totalInfrastructureForClassification >= 15 && 
               commercialIndicators.length >= 3) {
        areaType = 'city';
        maxViability = 70;
      } 
      // Town classification
      else if (totalPlaces >= 8 && totalInfrastructureForClassification >= 10 && 
               commercialIndicators.length >= 2) {
        areaType = 'town';
        maxViability = 50;
      }
      // Default to village for lower infrastructure
      else {
        areaType = 'village';
        maxViability = 35;
      }
      
      console.log(`Classified as: ${areaType} (max: ${maxViability}%)`);
      
      // Enhanced investment viability calculation with area-based caps
      const scoreAsPercentage = Math.min((result.locationScore / 5) * 100, 120);
      
      // Premium area multipliers (only for cities and metros)
      let viabilityMultiplier = 1.0;
      if (areaType !== 'village') {
        if (premiumAreaBonus >= 1.0) viabilityMultiplier = 1.4; // Luxury areas get 40% boost
        else if (premiumAreaBonus >= 0.5) viabilityMultiplier = 1.2; // Premium areas get 20% boost
      }
      
      result.investmentViability = Math.min(scoreAsPercentage * viabilityMultiplier, maxViability);
      
      // Enhanced business growth rate based on infrastructure, amenities & population indicators
      const businessGrowthFactors = {
        infrastructure: infrastructureScores.essential.total * 1.5, // Essential services drive business
        commercial: infrastructureScores.commercial.total * 2.0, // Commercial density indicates business activity
        connectivity: infrastructureScores.connectivity * 0.15, // Transport connectivity enables business
        education: infrastructureScores.education.total * 1.2, // Education creates skilled workforce
        population: Math.min(infrastructureScores.healthcare.total * 1.0, 15) // Healthcare indicates population density
      };
      
      const totalBusinessScore = Object.values(businessGrowthFactors).reduce((sum, score) => sum + score, 0);
      result.businessGrowthRate = Math.max(-8, Math.min(18, 
        (totalBusinessScore / 15) + // Base growth from infrastructure
        (result.locationScore / 8) - 1 // Location score adjustment
      ));
      
      // Population growth rate based on infrastructure capacity and amenities
      const populationGrowthFactors = {
        housing: Math.min(infrastructureScores.essential.total * 0.8, 12), // Essential services support population
        healthcare: infrastructureScores.healthcare.total * 1.2, // Healthcare capacity indicates population support
        education: infrastructureScores.education.total * 1.0, // Schools indicate family-friendly areas
        transport: infrastructureScores.transport.total * 0.9, // Transport enables population movement
        connectivity: infrastructureScores.connectivity * 0.08 // External connectivity attracts migration
      };
      
      const totalPopulationScore = Object.values(populationGrowthFactors).reduce((sum, score) => sum + score, 0);
      result.populationGrowthRate = Math.max(-5, Math.min(12, 
        (totalPopulationScore / 12) + // Base growth from infrastructure capacity
        (result.locationScore / 15) - 0.5 // Location score adjustment
      ));
      
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
          const topLocations = await findTopInvestmentLocations(location, propertyType, amount);
          result.topInvestmentLocations = topLocations;
        } catch (error) {
          console.error("Top locations error:", error);
          result.topInvestmentLocations = [];
        }
      }

      // Investment recommendation text based on area type and viability
      if (areaType === 'metropolitan') {
        if (result.investmentViability >= 80) {
          result.investmentRecommendation = "Excellent Metropolitan Investment - Premium Location";
        } else if (result.investmentViability >= 60) {
          result.investmentRecommendation = "Good Metropolitan Investment - Strong Growth Potential";
        } else if (result.investmentViability >= 40) {
          result.investmentRecommendation = "Fair Metropolitan Investment - Moderate Growth";
        } else {
          result.investmentRecommendation = "Limited Metropolitan Investment - Consider Alternatives";
        }
      } else if (areaType === 'city') {
        if (result.investmentViability >= 50) {
          result.investmentRecommendation = "Good City Investment - Stable Urban Growth";
        } else if (result.investmentViability >= 30) {
          result.investmentRecommendation = "Fair City Investment - Moderate Potential";
        } else {
          result.investmentRecommendation = "Limited City Investment - High Risk";
        }
      } else if (areaType === 'town') {
        if (result.investmentViability >= 35) {
          result.investmentRecommendation = "Fair Town Investment - Basic Infrastructure Available";
        } else if (result.investmentViability >= 20) {
          result.investmentRecommendation = "Limited Town Investment - Minimal Growth Expected";
        } else {
          result.investmentRecommendation = "Poor Town Investment - Not Recommended";
        }
      } else { // village
        if (result.investmentViability >= 25) {
          result.investmentRecommendation = "Limited Village Investment - Rural Development Potential";
        } else if (result.investmentViability >= 15) {
          result.investmentRecommendation = "Poor Village Investment - Minimal Infrastructure";
        } else {
          result.investmentRecommendation = "Not Suitable for Investment - Insufficient Infrastructure";
        }
      }

    } catch (error) {
      console.error("Analysis error:", error);
      result.investmentRecommendation = "Analysis temporarily unavailable";
    }

    return result;
  };

  return server;
}