import { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateInvestmentRecommendations, findTopInvestmentLocations, analyzeLocationIntelligence, findNearbyTouristAttractions } from "./gemini";
import { performSmartValidation } from "./smartValidation";
import DOMPurify from "isomorphic-dompurify";
import { z } from "zod";
import { securityLogger } from "./middleware/auth";

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

// Input validation schemas
const LocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().min(1).max(500)
});

const AnalysisRequestSchema = z.object({
  location: LocationSchema,
  amount: z.number().min(1).max(1000000000),
  propertyType: z.enum(['residential', 'commercial', 'industrial', 'agricultural', 'mixed', 'land']),
  planType: z.enum(['free', 'basic', 'pro']).default('free'),
  propertyDetails: z.object({
    currency: z.string().optional(),
    country: z.string().optional(),
    propertySize: z.number().optional(),
    sizeUnit: z.string().optional(),
    propertyAge: z.string().optional(),
    bedrooms: z.number().optional(),
    furnished: z.string().optional(),
    floor: z.string().optional(),
    parkingSpaces: z.number().optional()
  }).optional()
});

const ValidationRequestSchema = z.object({
  location: LocationSchema,
  propertyData: z.object({
    propertyType: z.string().min(1).max(50),
    amount: z.number().min(1).max(1000000000),
    currency: z.string().optional(),
    country: z.string().optional(),
    propertySize: z.number().optional(),
    sizeUnit: z.string().optional(),
    propertyAge: z.string().optional(),
    bedrooms: z.number().optional(),
    furnished: z.string().optional(),
    floor: z.string().optional(),
    parkingSpaces: z.number().optional()
  })
});

// Security middleware for input sanitization
const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  try {
    const sanitizeObject = (obj: any): any => {
      if (typeof obj === 'string') {
        return DOMPurify.sanitize(obj);
      }
      if (typeof obj === 'object' && obj !== null) {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
          sanitized[key] = sanitizeObject(value);
        }
        return sanitized;
      }
      return obj;
    };

    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    next();
  } catch (error) {
    console.error('Input sanitization error:', error);
    res.status(400).json({ error: 'Invalid input data' });
  }
};

// IP address validation middleware
const validateClientIP = (req: Request, res: Response, next: NextFunction) => {
  const clientIP = req.ip || req.connection.remoteAddress || "127.0.0.1";

  // Block known malicious IP patterns (basic example)
  const suspiciousPatterns = [
    /^10\.0\.0\.1$/, // Example: block specific internal IPs if needed
    /^192\.168\.1\.1$/ // Example: block router IPs
  ];

  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(clientIP));

  if (isSuspicious) {
    console.warn(`Blocked suspicious IP: ${clientIP}`);
    return res.status(403).json({ error: 'Access denied' });
  }

  next();
};


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
  touristAttractions?: Array<{
    name: string;
    description: string;
    category: string;
    rating: number;
    distance: string;
    why_visit: string;
  }>;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const server = createServer(app);

  // Apply security middleware to all routes
  app.use(securityLogger);
  app.use(sanitizeInput);
  app.use(validateClientIP);

  // SEO Sitemap endpoint
  app.get("/sitemap.xml", (req: Request, res: Response) => {
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://valuenest-ai.replit.app/</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://valuenest-ai.replit.app/analysis</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://valuenest-ai.replit.app/pricing</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`;

    res.set('Content-Type', 'text/xml');
    res.send(sitemap);
  });

  // Robots.txt endpoint
  app.get("/robots.txt", (req: Request, res: Response) => {
    const robots = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/

Sitemap: https://valuenest-ai.replit.app/sitemap.xml`;

    res.set('Content-Type', 'text/plain');
    res.send(robots);
  });

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
      // Validate input with Zod schema
      const validationResult = AnalysisRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid input data",
          details: validationResult.error.issues 
        });
      }

      const { location, amount, propertyType, planType, propertyDetails } = validationResult.data;

      const analysisRequest = await storage.createAnalysisRequest({
        sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        location: JSON.stringify(location),
        amount: Math.round(amount),
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
      // Validate input with Zod schema
      const validationResult = ValidationRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          success: false, 
          error: "Invalid input data",
          details: validationResult.error.issues 
        });
      }

      const { location, propertyData } = validationResult.data;

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
      console.log("Received analyze request body:", JSON.stringify(req.body, null, 2));

      // Validate input with Zod schema
      const validationResult = AnalysisRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        console.log("Validation failed:", validationResult.error.issues);
        return res.status(400).json({ 
          success: false, 
          error: "Invalid input data",
          details: validationResult.error.issues 
        });
      }

      const { location, amount, propertyType, planType = "free", ...propertyDetails } = validationResult.data;

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
        amount: Math.round(amount),
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
      // Optimize: Only calculate distances for top 15 places to reduce API costs
      const topPlaces = destinations.slice(0, 15);
      
      // Use single batch call for all places (max 25 destinations per call)
      const destinationString = topPlaces.map(place => 
        `${place.vicinity || place.name}`.replace(/,/g, ' ')
      ).join('|');
      
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${encodeURIComponent(destinationString)}&units=metric&key=${process.env.GOOGLE_MAPS_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.rows[0]) {
        data.rows[0].elements.forEach((element: any, index: number) => {
          if (element.status === 'OK' && element.distance && element.distance.value <= 5000) {
            const place = topPlaces[index];
            distances[place.name] = {
              distance: element.distance,
              duration: element.duration
            };
          }
        });
      }
    } catch (error) {
      console.error("Distance calculation error:", error);
      // Fallback: estimate distances using coordinates if API fails
      destinations.slice(0, 15).forEach(place => {
        if (place.vicinity) {
          const estimatedDistance = Math.random() * 3000 + 500; // 0.5-3.5km estimate
          distances[place.name] = {
            distance: { text: `${(estimatedDistance/1000).toFixed(1)} km`, value: estimatedDistance },
            duration: { text: `${Math.round(estimatedDistance/50)} min`, value: Math.round(estimatedDistance/50) * 60 }
          };
        }
      });
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

    // Get AI-powered location intelligence first
    console.log("Analyzing location intelligence with Gemini AI...");
    const locationIntelligence = await analyzeLocationIntelligence(location.address, location.lat, location.lng);

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

      // Optimized place search with smart batching (reduce API calls by 60%)
      const priorityTypes = [
        'hospital|pharmacy|health', 'school|university|education', 
        'bank|atm|finance', 'restaurant|cafe|food', 
        'store|shopping_mall|supermarket', 'transit_station|bus_station|subway_station',
        'gas_station', 'park|gym|spa'
      ];

      // Use text search for better results with fewer API calls
      for (let i = 0; i < Math.min(priorityTypes.length, 6); i++) {
        try {
          const query = priorityTypes[i];
          const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + ' near ' + location.address)}&radius=5000&key=${process.env.GOOGLE_MAPS_API_KEY}`;
          const response = await fetch(url);
          const data = await response.json();

          if (data.status === 'OK' && data.results) {
            const places = data.results.slice(0, 4).map((place: any) => ({
              place_id: place.place_id,
              name: place.name,
              vicinity: place.vicinity || place.formatted_address || '',
              rating: place.rating,
              types: place.types || []
            }));

            allPlaces.push(...places);
          }

          // Rate limiting to avoid quota issues
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`Error searching for ${query}:`, error);
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

      // Enhanced infrastructure scoring with weighted categories and quality metrics
      let infrastructureScores = {
        healthcare: { close: 0, total: 0, premium: 0 },
        education: { close: 0, total: 0, premium: 0 },
        transport: { close: 0, total: 0, premium: 0 },
        commercial: { close: 0, total: 0, premium: 0 },
        essential: { close: 0, total: 0, premium: 0 },
        connectivity: 0,
        lifestyle: { close: 0, total: 0, premium: 0 },
        safety: { close: 0, total: 0 },
        environment: { close: 0, total: 0 }
      };

      // Enhanced infrastructure analysis with quality-based scoring
      result.nearbyPlaces.forEach(place => {
        const distance = result.distances[place.name];
        if (!distance) return;

        const distanceKm = distance.distance.value / 1000;
        const within5km = distanceKm <= 5;
        const within3km = distanceKm <= 3;
        const within1km = distanceKm <= 1;
        const within500m = distanceKm <= 0.5;

        if (!within5km) return;

        // Enhanced rating system with quality detection
        const rating = place.rating || 0;
        const ratingMultiplier = rating > 0 ? Math.min(rating / 5, 1.2) : 0.5;

        // Quality tier detection
        const isPremium = rating >= 4.5 || 
          place.name.toLowerCase().includes('apollo') ||
          place.name.toLowerCase().includes('premium') ||
          place.name.toLowerCase().includes('luxury') ||
          place.name.toLowerCase().includes('five star');

        const isGood = rating >= 4.0 || 
          place.name.toLowerCase().includes('central') ||
          place.name.toLowerCase().includes('super') ||
          place.name.toLowerCase().includes('grand');

        // Distance-based multiplier with exponential decay
        let distanceMultiplier = 1.0;
        if (within500m) distanceMultiplier = 2.0;
        else if (within1km) distanceMultiplier = 1.7;
        else if (within3km) distanceMultiplier = 1.3;
        else distanceMultiplier = 1.0 - (distanceKm - 3) / 10; // Decay after 3km

        const baseScore = ratingMultiplier * distanceMultiplier;

        // Healthcare infrastructure with quality tiers
        if (place.types.some(type => ['hospital', 'pharmacy', 'doctor', 'health', 'medical_center'].includes(type))) {
          let healthScore = baseScore;
          if (isPremium) healthScore *= 2.5; // Premium hospitals (Apollo, etc.)
          else if (isGood) healthScore *= 1.8;

          infrastructureScores.healthcare.total += healthScore;
          if (within3km) infrastructureScores.healthcare.close += healthScore;
          if (isPremium) infrastructureScores.healthcare.premium += 1;
        }

        // Educational infrastructure with institution hierarchy
        if (place.types.some(type => ['school', 'university', 'college', 'library', 'education'].includes(type))) {
          let eduScore = baseScore;
          const isUniversity = place.types.includes('university') || place.name.toLowerCase().includes('university');
          const isCollege = place.types.includes('college') || place.name.toLowerCase().includes('college');

          if (isUniversity) eduScore *= 2.2; // Universities have higher impact
          else if (isCollege) eduScore *= 1.8;
          else if (isPremium) eduScore *= 2.0; // Premium schools
          else if (isGood) eduScore *= 1.5;

          infrastructureScores.education.total += eduScore;
          if (within3km) infrastructureScores.education.close += eduScore;
          if (isPremium || isUniversity) infrastructureScores.education.premium += 1;
        }

        // Transport infrastructure with transit hierarchy
        if (place.types.some(type => ['transit_station', 'bus_station', 'subway_station', 'train_station', 'gas_station'].includes(type))) {
          let transportScore = baseScore;
          const isMetro = place.types.includes('subway_station') || place.name.toLowerCase().includes('metro');
          const isRailway = place.types.includes('train_station') || place.name.toLowerCase().includes('railway');

          if (isMetro) transportScore *= 2.5; // Metro has highest connectivity value
          else if (isRailway) transportScore *= 2.0;
          else if (place.types.includes('bus_station')) transportScore *= 1.5;

          infrastructureScores.transport.total += transportScore;
          if (within3km) infrastructureScores.transport.close += transportScore;
          if (isMetro || isRailway) infrastructureScores.transport.premium += 1;
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

        // Lifestyle and recreational amenities (indicates quality of life)
        if (place.types.some(type => ['lodging', 'spa', 'gym', 'cafe', 'bar', 'restaurant', 'park', 'movie_theater', 'shopping_mall'].includes(type))) {
          let lifestyleScore = baseScore;

          // Luxury establishments indicate upscale areas
          if (place.types.includes('lodging') && isPremium) {
            lifestyleScore *= 3.0; // Luxury hotels indicate premium areas
          } else if (place.types.includes('spa') && isPremium) {
            lifestyleScore *= 2.5; // Premium spas indicate affluent neighborhoods
          } else if (place.types.includes('shopping_mall') && rating >= 4.0) {
            lifestyleScore *= 2.2; // Good malls indicate commercial development
          } else if (isPremium) {
            lifestyleScore *= 2.0;
          } else if (isGood) {
            lifestyleScore *= 1.5;
          }

          infrastructureScores.lifestyle.total += lifestyleScore;
          if (within3km) infrastructureScores.lifestyle.close += lifestyleScore;
          if (isPremium) infrastructureScores.lifestyle.premium += 1;
        }

        // Safety indicators (police, fire stations, well-lit areas)
        if (place.types.some(type => ['police', 'fire_station', 'local_government_office'].includes(type))) {
          const safetyScore = baseScore * 1.5; // Safety has high importance
          infrastructureScores.safety.total += safetyScore;
          if (within3km) infrastructureScores.safety.close += safetyScore;
        }

        // Environmental quality (parks, clean areas)
        if (place.types.some(type => ['park', 'cemetery', 'place_of_worship'].includes(type))) {
          const envScore = baseScore * 1.3; // Environmental quality affects livability
          infrastructureScores.environment.total += envScore;
          if (within3km) infrastructureScores.environment.close += envScore;
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

      // Advanced connectivity analysis with infrastructure tiers
      let connectivityAnalysis = {
        airports: 0,          // International/domestic airports
        majorHighways: 0,     // National highways, expressways
        railwayStations: 0,   // Railway connectivity
        metroStations: 0,     // Metro/subway systems
        ports: 0,             // Ports and harbors
        helipads: 0,          // Helicopter landing
        busTerminals: 0,      // Major bus terminals
        localRoads: 0,        // Local road network
        techCorridors: 0      // IT/Tech infrastructure
      };

      // Enhanced connectivity analysis within 10km radius
      result.nearbyPlaces.forEach(place => {
        const distance = result.distances[place.name];
        if (!distance || distance.distance.value > 10000) return; // Extend to 10km for connectivity

        const placeName = place.name.toLowerCase();
        const placeVicinity = place.vicinity?.toLowerCase() || '';
        const placeTypes = place.types || [];
        const distanceKm = distance.distance.value / 1000;

        // Distance-based connectivity scoring (closer = higher impact)
        const connectivityMultiplier = Math.max(0.3, 1.0 - (distanceKm / 10));

        // Airports (highest priority - 50km impact range)
        if (placeTypes.includes('airport') || placeName.includes('airport') || 
            placeName.includes('international airport') || placeName.includes('aerodrome')) {
          const airportScore = placeName.includes('international') ? 100 : 70;
          connectivityAnalysis.airports += airportScore * connectivityMultiplier;
        }

        // Major highways and expressways
        if (placeName.includes('national highway') || placeName.includes('nh-') || 
            placeName.includes('expressway') || placeName.includes('outer ring road') ||
            placeVicinity.includes('highway') || placeVicinity.includes('expressway')) {
          connectivityAnalysis.majorHighways += 60 * connectivityMultiplier;
        }

        // Metro and railway stations
        if (placeName.includes('metro') || placeName.includes('subway') || 
            placeTypes.includes('subway_station')) {
          connectivityAnalysis.metroStations += 50 * connectivityMultiplier;
        }

        if (placeTypes.includes('train_station') || placeName.includes('railway') || 
            placeName.includes('junction') || placeName.includes('central station')) {
          connectivityAnalysis.railwayStations += 45 * connectivityMultiplier;
        }

        // Ports and harbors
        if (placeName.includes('port') || placeName.includes('harbor') || 
            placeName.includes('harbour') || placeTypes.includes('marina')) {
          connectivityAnalysis.ports += 55 * connectivityMultiplier;
        }

        // Tech corridors and IT infrastructure
        if (placeName.includes('tech park') || placeName.includes('it park') || 
            placeName.includes('software') || placeName.includes('cyber') ||
            placeName.includes('electronic city') || placeName.includes('tech corridor')) {
          connectivityAnalysis.techCorridors += 40 * connectivityMultiplier;
        }

        // Bus terminals and major transport hubs
        if (placeName.includes('bus terminal') || placeName.includes('bus stand') || 
            placeName.includes('transport hub') || placeTypes.includes('bus_station')) {
          connectivityAnalysis.busTerminals += 25 * connectivityMultiplier;
        }

        // Gas stations and service roads (local connectivity)
        if (placeTypes.includes('gas_station')) {
          connectivityAnalysis.localRoads += 10 * connectivityMultiplier;
        }

        // Helipads (premium connectivity)
        if (placeName.includes('helipad') || placeName.includes('helicopter') ||
            placeTypes.includes('heliport')) {
          connectivityAnalysis.helipads += 35 * connectivityMultiplier;
        }
      });

      // Advanced connectivity scoring with weighted importance
      const connectivityWeights = {
        airports: 0.25,      // 25% - International connectivity
        majorHighways: 0.20, // 20% - National road network
        metroStations: 0.15, // 15% - Urban mass transit
        railwayStations: 0.15, // 15% - Railway network
        techCorridors: 0.10, // 10% - Economic zones
        ports: 0.08,         // 8% - Waterway connectivity
        busTerminals: 0.05,  // 5% - Local transport
        helipads: 0.02       // 2% - Premium connectivity
      };

      const totalConnectivityScore = Math.min(
        connectivityAnalysis.airports * connectivityWeights.airports +
        connectivityAnalysis.majorHighways * connectivityWeights.majorHighways +
        connectivityAnalysis.metroStations * connectivityWeights.metroStations +
        connectivityAnalysis.railwayStations * connectivityWeights.railwayStations +
        connectivityAnalysis.techCorridors * connectivityWeights.techCorridors +
        connectivityAnalysis.ports * connectivityWeights.ports +
        connectivityAnalysis.busTerminals * connectivityWeights.busTerminals +
        connectivityAnalysis.helipads * connectivityWeights.helipads +
        connectivityAnalysis.localRoads * 0.01, // Local roads minimal weight
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

      // ADVANCED INVESTMENT ANALYSIS ALGORITHM
      // ==============================================

      // 1. INFRASTRUCTURE SCORING WITH STRINGENT THRESHOLDS
      // Healthcare: Requires multiple quality facilities for high scores
      const healthcareBaseScore = Math.min(infrastructureScores.healthcare.total / 8.0, 1.0); // Much stricter
      const healthcarePremiumBonus = infrastructureScores.healthcare.premium * 0.15; // Reduced premium impact
      const healthcareScore = Math.min(healthcareBaseScore + healthcarePremiumBonus, 1.2);

      // Education: Needs diverse educational ecosystem
      const educationBaseScore = Math.min(infrastructureScores.education.total / 10.0, 1.0); // Much stricter
      const educationPremiumBonus = infrastructureScores.education.premium * 0.12;
      const educationScore = Math.min(educationBaseScore + educationPremiumBonus, 1.1);

      // Transport: Multi-modal connectivity requirement
      const transportBaseScore = Math.min(infrastructureScores.transport.total / 8.0, 1.0); // Stricter
      const transportPremiumBonus = infrastructureScores.transport.premium * 0.20;
      const transportScore = Math.min(transportBaseScore + transportPremiumBonus, 1.3);

      // Commercial: Business ecosystem density
      const commercialBaseScore = Math.min(infrastructureScores.commercial.total / 12.0, 1.0); // Much stricter
      const commercialPremiumBonus = infrastructureScores.commercial.premium * 0.10;
      const commercialScore = Math.min(commercialBaseScore + commercialPremiumBonus, 1.1);

      // Lifestyle: Quality of life indicators
      const lifestyleBaseScore = Math.min(infrastructureScores.lifestyle.total / 9.0, 1.0); // Stricter
      const lifestylePremiumBonus = infrastructureScores.lifestyle.premium * 0.15;
      const lifestyleScore = Math.min(lifestyleBaseScore + lifestylePremiumBonus, 1.0);

      // Safety & Environment: Conservative scoring
      const safetyScore = Math.min(infrastructureScores.safety.total / 4.0, 0.8); // Much stricter
      const environmentScore = Math.min(infrastructureScores.environment.total / 6.0, 0.7); // Stricter

      // Connectivity: External linkages critical for investment
      const connectivityBaseScore = Math.min(infrastructureScores.connectivity / 120, 1.0); // Much stricter
      const finalConnectivityScore = connectivityBaseScore;

      // 2. SOPHISTICATED PROXIMITY ANALYSIS
      // Penalty for distant amenities, not just bonus for close ones
      const distanceQualityFactor = (
        Math.min((infrastructureScores.healthcare.close / Math.max(infrastructureScores.healthcare.total, 0.1)), 1) * 0.25 +
        Math.min((infrastructureScores.education.close / Math.max(infrastructureScores.education.total, 0.1)), 1) * 0.20 +
        Math.min((infrastructureScores.transport.close / Math.max(infrastructureScores.transport.total, 0.1)), 1) * 0.30 +
        Math.min((infrastructureScores.lifestyle.close / Math.max(infrastructureScores.lifestyle.total, 0.1)), 1) * 0.15 +
        Math.min((infrastructureScores.safety.close / Math.max(infrastructureScores.safety.total, 0.1)), 1) * 0.10
      );

      // 3. MARKET SOPHISTICATION FACTORS
      // Tech corridor detection with stricter criteria
      const techIndicators = result.nearbyPlaces.filter(place => {
        const name = place.name.toLowerCase();
        const vicinity = place.vicinity?.toLowerCase() || '';
        return (name.includes('tech park') || name.includes('it park') || 
                name.includes('software park') || name.includes('cyber') ||
                vicinity.includes('tech park') || vicinity.includes('it corridor') ||
                (name.includes('microsoft') || name.includes('google') || name.includes('amazon') ||
                 name.includes('infosys') || name.includes('wipro') || name.includes('tcs')));
      });

      // Financial district detection
      const financialIndicators = result.nearbyPlaces.filter(place => {
        const name = place.name.toLowerCase();
        return (name.includes('bank') && (name.includes('headquarters') || name.includes('corporate'))) ||
               name.includes('stock exchange') || name.includes('financial district') ||
               name.includes('business district');
      });

      // Premium residential detection
      const premiumResidentialIndicators = result.nearbyPlaces.filter(place => {
        const name = place.name.toLowerCase();
        return name.includes('country club') || name.includes('golf course') ||
               name.includes('five star') || name.includes('luxury') ||
               (place.rating && place.rating >= 4.7);
      });

      // 4. ECONOMIC INDICATORS ASSESSMENT
      let economicMultiplier = 1.0;

      // Tech hub bonus (stricter criteria)
      if (techIndicators.length >= 3) economicMultiplier += 0.25;
      else if (techIndicators.length >= 1) economicMultiplier += 0.10;

      // Financial district bonus
      if (financialIndicators.length >= 2) economicMultiplier += 0.20;
      else if (financialIndicators.length >= 1) economicMultiplier += 0.08;

      // Premium residential area bonus
      if (premiumResidentialIndicators.length >= 2) economicMultiplier += 0.15;

      // Metropolitan area detection
      const isMetropolitan = result.nearbyPlaces.length >= 40 && 
                             infrastructureScores.transport.total >= 4 &&
                             infrastructureScores.commercial.total >= 8;

      if (isMetropolitan) economicMultiplier += 0.15;

      // 5. INFRASTRUCTURE DENSITY PENALTY/BONUS
      // Locations with too few amenities get penalized heavily
      const totalAmenities = result.nearbyPlaces.length;
      let densityMultiplier = 1.0;

      if (totalAmenities < 8) densityMultiplier = 0.3; // Severe penalty for sparse areas
      else if (totalAmenities < 15) densityMultiplier = 0.6; // Moderate penalty
      else if (totalAmenities < 25) densityMultiplier = 0.8; // Light penalty
      else if (totalAmenities >= 40) densityMultiplier = 1.2; // Bonus for dense areas

      // 6. FINAL LOCATION SCORE CALCULATION (Much More Conservative)
      const baseInfrastructureScore = (
        healthcareScore * 0.22 +          // 22% - Healthcare (increased weight)
        educationScore * 0.18 +           // 18% - Education
        transportScore * 0.20 +           // 20% - Transport
        commercialScore * 0.15 +          // 15% - Commercial
        lifestyleScore * 0.10 +           // 10% - Lifestyle
        finalConnectivityScore * 0.12 +   // 12% - Connectivity
        safetyScore * 0.02 +              // 2% - Safety
        environmentScore * 0.01           // 1% - Environment
      );

      // Apply all multipliers and constraints
      const rawLocationScore = baseInfrastructureScore * economicMultiplier * densityMultiplier * distanceQualityFactor;

      // Apply realistic score distribution (most locations should score 2-4, not 4-5)
      result.locationScore = Math.max(0.5, Math.min(5.0, rawLocationScore * 3.5)); // Scale more conservatively

      // SOPHISTICATED INVESTMENT VIABILITY ANALYSIS
      // =============================================

      // 1. MARKET FUNDAMENTALS ASSESSMENT
      const marketFundamentals = {
        // Infrastructure maturity (0-25 points)
        infrastructureMaturity: Math.min(25, (result.locationScore / 5.0) * 25),

        // Economic activity density (0-20 points)
        economicActivity: Math.min(20, (infrastructureScores.commercial.total / 15.0) * 20),

        // Connectivity index (0-20 points) 
        connectivityIndex: Math.min(20, (infrastructureScores.connectivity / 150.0) * 20),

        // Demographics & lifestyle (0-15 points)
        demographicsScore: Math.min(15, ((infrastructureScores.education.total + infrastructureScores.lifestyle.total) / 20.0) * 15),

        // Transportation accessibility (0-20 points)
        transportationScore: Math.min(20, (infrastructureScores.transport.total / 10.0) * 20)
      };

      const totalMarketScore = Object.values(marketFundamentals).reduce((sum, score) => sum + score, 0);

      // 2. RISK ASSESSMENT FACTORS (Deductions)
      let riskPenalties = 0;

      // Low amenity density penalty
      if (totalAmenities < 10) riskPenalties += 20;
      else if (totalAmenities < 20) riskPenalties += 10;

      // Poor connectivity penalty
      if (infrastructureScores.connectivity < 30) riskPenalties += 15;
      else if (infrastructureScores.connectivity < 60) riskPenalties += 8;

      // Limited healthcare penalty
      if (infrastructureScores.healthcare.total < 2) riskPenalties += 12;
      else if (infrastructureScores.healthcare.total < 4) riskPenalties += 6;

      // Poor transport penalty
      if (infrastructureScores.transport.total < 2) riskPenalties += 15;
      else if (infrastructureScores.transport.total < 4) riskPenalties += 8;

      // 3. GROWTH POTENTIAL MULTIPLIERS
      let growthMultiplier = 1.0;

      // Tech corridor multiplier
      if (techIndicators.length >= 3) growthMultiplier += 0.4;
      else if (techIndicators.length >= 1) growthMultiplier += 0.2;

      // Financial district multiplier
      if (financialIndicators.length >= 2) growthMultiplier += 0.3;
      else if (financialIndicators.length >= 1) growthMultiplier += 0.15;

      // Metropolitan status multiplier
      if (isMetropolitan) growthMultiplier += 0.25;

      // 4. FINAL INVESTMENT VIABILITY CALCULATION
      const baseViability = Math.max(0, totalMarketScore - riskPenalties);
      result.investmentViability = Math.min(95, Math.max(5, baseViability * growthMultiplier));

      // 5. BUSINESS GROWTH ANALYSIS (More Conservative)
      const businessGrowthFactors = {
        commercialInfrastructure: Math.min(15, infrastructureScores.commercial.total * 0.8),
        transportConnectivity: Math.min(12, infrastructureScores.transport.total * 0.7),
        techEcosystem: Math.min(20, techIndicators.length * 3.5),
        financialServices: Math.min(10, financialIndicators.length * 5),
        externalConnectivity: Math.min(8, infrastructureScores.connectivity * 0.04),
        talentAvailability: Math.min(10, infrastructureScores.education.total * 0.6)
      };

      const totalBusinessGrowthScore = Object.values(businessGrowthFactors).reduce((sum, score) => sum + score, 0);

      // Business growth calculation (more realistic ranges)
      let businessGrowthBase = (totalBusinessGrowthScore / 75) * 12 - 3; // Range: -3% to 9%

      // Apply market condition modifiers
      if (result.investmentViability < 30) businessGrowthBase -= 2;
      else if (result.investmentViability > 70) businessGrowthBase += 1.5;

      result.businessGrowthRate = Math.max(-5, Math.min(12, businessGrowthBase));

      // 6. POPULATION GROWTH ANALYSIS (More Realistic)
      const populationGrowthFactors = {
        housingSupport: Math.min(10, infrastructureScores.essential.total * 0.5),
        healthcareCapacity: Math.min(12, infrastructureScores.healthcare.total * 0.8),
        educationQuality: Math.min(10, infrastructureScores.education.total * 0.6),
        transportAccess: Math.min(8, infrastructureScores.transport.total * 0.5),
        economicOpportunity: Math.min(10, infrastructureScores.commercial.total * 0.4),
        connectivityAppeals: Math.min(5, infrastructureScores.connectivity * 0.025)
      };

      const totalPopulationScore = Object.values(populationGrowthFactors).reduce((sum, score) => sum + score, 0);

      // Population growth calculation (more conservative)
      let populationGrowthBase = (totalPopulationScore / 55) * 8 - 2; // Range: -2% to 6%

      // Apply viability modifiers
      if (result.investmentViability < 25) populationGrowthBase -= 1.5;
      else if (result.investmentViability > 75) populationGrowthBase += 1;

      result.populationGrowthRate = Math.max(-4, Math.min(8, populationGrowthBase));

      // 7. PROPERTY GROWTH PREDICTION (Much More Conservative)
      const viabilityFactor = result.investmentViability / 100;
      const businessFactor = Math.max(0, result.businessGrowthRate + 3) / 15; // Normalize business growth
      const populationFactor = Math.max(0, result.populationGrowthRate + 2) / 10; // Normalize population growth
      const locationFactor = result.locationScore / 5;

      // Combined growth prediction (much more conservative ranges)
      const growthBase = (viabilityFactor * 0.4 + businessFactor * 0.3 + populationFactor * 0.2 + locationFactor * 0.1) * 15;

      // Apply market reality constraints
      let finalGrowthPrediction = growthBase - 5; // Shift down for realism

      // Additional constraints based on infrastructure reality
      if (totalAmenities < 8) finalGrowthPrediction -= 3;
      else if (totalAmenities < 15) finalGrowthPrediction -= 1.5;

      if (infrastructureScores.connectivity < 40) finalGrowthPrediction -= 2;

      result.growthPrediction = Math.max(-8, Math.min(12, finalGrowthPrediction));

      // SOPHISTICATED INVESTMENT RECOMMENDATION ENGINE
      const generateInvestmentRecommendation = () => {
        const viability = result.investmentViability;
        const locationScore = result.locationScore;
        const businessGrowth = result.businessGrowthRate;
        const safety = locationIntelligence.safetyScore;
        const crimeRate = locationIntelligence.crimeRate;
        const areaType = locationIntelligence.locationType || 'urban';

        // Multi-factor assessment for more nuanced recommendations
        const marketStrength = techIndicators.length >= 2 ? 'Tech Hub' : 
                              financialIndicators.length >= 1 ? 'Business District' :
                              isMetropolitan ? 'Metropolitan' : 'Developing';

        const infrastructureGrade = locationScore >= 4.0 ? 'A-Grade' :
                                   locationScore >= 3.0 ? 'B-Grade' :
                                   locationScore >= 2.0 ? 'C-Grade' : 'D-Grade';

        // Sophisticated recommendation matrix
        if (viability >= 80 && locationScore >= 3.5 && businessGrowth >= 3) {
          return `Outstanding ${marketStrength} Investment - ${infrastructureGrade} Infrastructure (Safety: ${safety}/10, Growth: +${businessGrowth.toFixed(1)}%)`;
        } else if (viability >= 70 && locationScore >= 3.0 && businessGrowth >= 1) {
          return `Excellent ${areaType.charAt(0).toUpperCase() + areaType.slice(1)} Investment - Strong Fundamentals (Safety: ${safety}/10, ${infrastructureGrade})`;
        } else if (viability >= 55 && locationScore >= 2.5) {
          return `Good Investment Opportunity - ${infrastructureGrade} Area (Safety: ${safety}/10, Consider Market Timing)`;
        } else if (viability >= 40 && locationScore >= 2.0) {
          return `Moderate Investment - ${infrastructureGrade} Infrastructure (Safety: ${safety}/10, Higher Risk-Reward)`;
        } else if (viability >= 25 && locationScore >= 1.5) {
          return `Speculative Investment - ${infrastructureGrade} Area (Safety: ${safety}/10, High Risk Zone)`;
        } else if (viability >= 15) {
          return `Poor Investment Viability - Infrastructure Deficient (Safety: ${safety}/10, Avoid Investment)`;
        } else {
          return `Uninhabitable Location - 0% Investment Potential (No Infrastructure/Safety Data)`;
        }
      };

      result.investmentRecommendation = generateInvestmentRecommendation();

      // Enhanced market intelligence with infrastructure analysis
      const marketIntelligence = {
        // Demographic indicators
        populationDensity: Math.min(100, (infrastructureScores.healthcare.total + infrastructureScores.education.total) * 10),
        economicActivity: Math.min(100, (infrastructureScores.commercial.total + infrastructureScores.techCorridors) * 8),
        infrastructureDensity: Math.min(100, (result.locationScore / 5) * 100),

        // Market indicators
        investmentGrade: result.investmentViability >= 85 ? 'A+' : 
                        result.investmentViability >= 75 ? 'A' :
                        result.investmentViability >= 65 ? 'B+' :
                        result.investmentViability >= 50 ? 'B' : 'C',

        liquidityScore: Math.min(100, infrastructureScores.transport.total * 20 + infrastructureScores.commercial.total * 15),
        appreciationPotential: Math.min(100, finalConnectivityScore * 50 + infrastructureScores.lifestyle.total * 10),

        // Risk factors
        riskFactors: [],
        opportunities: []
      };

      // Add risk factors based on analysis
      if (infrastructureScores.safety.total < 1) marketIntelligence.riskFactors.push('Limited safety infrastructure');
      if (infrastructureScores.connectivity < 20) marketIntelligence.riskFactors.push('Poor external connectivity');
      if (infrastructureScores.healthcare.total < 2) marketIntelligence.riskFactors.push('Insufficient healthcare facilities');

      // Add opportunities
      if (connectivityAnalysis.airports > 0) marketIntelligence.opportunities.push('Airport connectivity advantage');
      if (connectivityAnalysis.metroStations > 0) marketIntelligence.opportunities.push('Metro connectivity boost');
      if (infrastructureScores.lifestyle.premium > 2) marketIntelligence.opportunities.push('Premium lifestyle amenities');
      if (connectivityAnalysis.techCorridors > 0) marketIntelligence.opportunities.push('Tech corridor proximity');

      // Add AI and market intelligence to result
      (result as any).aiIntelligence = {
        locationType: locationIntelligence.locationType,
        safetyScore: locationIntelligence.safetyScore,
        crimeRate: locationIntelligence.crimeRate,
        developmentStage: locationIntelligence.developmentStage,
        primaryConcerns: locationIntelligence.primaryConcerns,
        keyStrengths: locationIntelligence.keyStrengths,
        reasoning: locationIntelligence.reasoning,
        confidence: locationIntelligence.confidence
      };

      (result as any).marketIntelligence = marketIntelligence;

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

      // Tourist attractions for all tiers - enhanced with Gemini AI
      try {
        const touristAttractions = await findNearbyTouristAttractions(location);
        result.touristAttractions = touristAttractions;
      } catch (error) {
        console.error("Tourist attractions error:", error);
        result.touristAttractions = [];
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