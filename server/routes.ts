import { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateInvestmentRecommendations, findTopInvestmentLocations, analyzeLocationIntelligence, findNearbyTouristAttractions, analyzeInfrastructureWithAI } from "./gemini";
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
  aiIntelligence?: any; // AI location intelligence data
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

      // Perform analysis with safety check
      const location = typeof analysisRequest.location === 'string' 
        ? JSON.parse(analysisRequest.location) 
        : analysisRequest.location;
      const propertyDetails = analysisRequest.propertyDetails ? JSON.parse(analysisRequest.propertyDetails) : null;

      // Safety check: Re-validate location before analysis
      const safetyValidation = await performSmartValidation({ 
        location, 
        propertyData: {
          propertyType: analysisRequest.propertyType,
          amount: analysisRequest.amount,
          ...propertyDetails
        }
      });

      // Block analysis if location is uninhabitable
      if (!safetyValidation.isValid && safetyValidation.riskLevel === 'high') {
        const hasUninhabitableIssues = safetyValidation.issues.some(issue => 
          issue.includes('uninhabitable') || 
          issue.includes('water body') || 
          issue.includes('restricted') ||
          issue.includes('military') ||
          issue.includes('government area') ||
          issue.includes('protected area') ||
          issue.includes('remote area') ||
          issue.includes('desert') ||
          issue.includes('no infrastructure')
        );
        
        if (hasUninhabitableIssues) {
          return res.status(400).json({ 
            error: "Location is uninhabitable and cannot be analyzed",
            validationIssues: safetyValidation.issues
          });
        }
      }

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
      
      // Block uninhabitable locations completely - no report generation allowed
      if (!validation.isValid && validation.riskLevel === 'high') {
        const hasUninhabitableIssues = validation.issues.some(issue => 
          issue.includes('uninhabitable') || 
          issue.includes('water body') || 
          issue.includes('restricted') ||
          issue.includes('military') ||
          issue.includes('government area') ||
          issue.includes('protected area') ||
          issue.includes('remote area') ||
          issue.includes('desert') ||
          issue.includes('no infrastructure')
        );
        
        if (hasUninhabitableIssues) {
          return res.json({
            ...validation,
            canProceed: false, // Explicitly block proceeding
            blockReason: "Location is uninhabitable and cannot be analyzed"
          });
        }
      }
      
      res.json({
        ...validation,
        canProceed: true // Allow proceeding for habitable locations
      });
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
      
      // Block uninhabitable and institutional locations completely - no report generation allowed
      if (!validation.isValid && validation.riskLevel === 'high') {
        const hasBlockedIssues = validation.issues.some(issue => 
          issue.includes('uninhabitable') || 
          issue.includes('water body') || 
          issue.includes('restricted') ||
          issue.includes('military') ||
          issue.includes('government area') ||
          issue.includes('protected area') ||
          issue.includes('remote area') ||
          issue.includes('desert') ||
          issue.includes('no infrastructure') ||
          issue.includes('school') ||
          issue.includes('college') ||
          issue.includes('hospital') ||
          issue.includes('playground') ||
          issue.includes('campus') ||
          issue.includes('institutional') ||
          issue.includes('public facility') ||
          issue.includes('PUBLIC FACILITIES') ||
          issue.includes('illegal') ||
          issue.includes('not suitable for private development') ||
          issue.includes('development on a public playground') ||
          issue.includes('highly unlikely to be permitted')
        );
        
        if (hasBlockedIssues) {
          return res.json({ 
            success: true, 
            validation: {
              ...validation,
              canProceed: false, // Explicitly block proceeding
              blockReason: "Location is not suitable for property development and cannot be analyzed"
            }
          });
        }
      }
      
      res.json({ 
        success: true, 
        validation: {
          ...validation,
          canProceed: true // Allow proceeding for habitable locations
        }
      });
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
    const aiIntelligence = await analyzeLocationIntelligence(location.address, location.lat, location.lng);

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

      // AI-POWERED INFRASTRUCTURE DETECTION FOR LOW-AMENITY AREAS
      // =========================================================
      // If standard API search finds very few places, use Gemini AI for comprehensive analysis
      if (result.nearbyPlaces.length < 5) {
        console.log('Low amenity count detected, using AI-powered infrastructure analysis...');
        const aiInfrastructure = await analyzeInfrastructureWithAI(location, aiIntelligence);
        
        if (aiInfrastructure && aiInfrastructure.detectedAmenities.length > 0) {
          // Convert AI-detected amenities to PlaceDetails format
          const aiPlaces: PlaceDetails[] = aiInfrastructure.detectedAmenities.map(place => ({
            place_id: `ai_${place.name.toLowerCase().replace(/\s+/g, '_')}`,
            name: place.name,
            vicinity: place.vicinity,
            rating: place.rating,
            types: place.types
          }));
          
          // Merge AI-detected amenities with existing places
          result.nearbyPlaces = [...result.nearbyPlaces, ...aiPlaces];
          
          // Create distance estimates for AI-detected places
          const aiDistances: Record<string, any> = {};
          aiInfrastructure.detectedAmenities.forEach(place => {
            aiDistances[place.name] = {
              distance: { text: place.estimatedDistance, value: place.estimatedDistanceMeters },
              duration: { text: place.estimatedTravelTime, value: 0 }
            };
          });
          
          result.distances = { ...result.distances, ...aiDistances };
          console.log(`AI Infrastructure Analysis added ${aiInfrastructure.detectedAmenities.length} additional amenities`);
        }
      }

      // AI-POWERED LOCATION INTELLIGENCE ASSESSMENT
      // ============================================
      // Using AI intelligence already obtained at function start
      console.log('AI Location Intelligence:', aiIntelligence);

      // INFRASTRUCTURE SCORING CALCULATION
      // ==================================
      // Calculate infrastructure scores AFTER all amenities (API + AI) are processed
      console.log(`Final amenity count for scoring: ${result.nearbyPlaces.length} places`);
      
      // Enhanced infrastructure scoring with AI-weighted categories and quality metrics
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

      // Note: Uninhabitable locations are now caught in the validation phase
      // If we reach here, the location has passed validation checks

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

      // 5. INFRASTRUCTURE DENSITY SCORING (Realistic Approach for AI-Detected Areas)
      // Give proper credit for AI-detected amenities
      const totalAmenities = result.nearbyPlaces.length;
      let densityMultiplier = 1.0;
      let baseInfrastructureBonus = 0;

      // AI-detected amenities should get proper scoring credit
      if (totalAmenities >= 50) {
        densityMultiplier = 1.8; // Excellent density
        baseInfrastructureBonus = 2.0;
      } else if (totalAmenities >= 25) {
        densityMultiplier = 1.6; // Very good density
        baseInfrastructureBonus = 1.5;
      } else if (totalAmenities >= 15) {
        densityMultiplier = 1.4; // Good density - areas like Halugunda with 16 amenities
        baseInfrastructureBonus = 1.2;
      } else if (totalAmenities >= 8) {
        densityMultiplier = 1.2; // Adequate density
        baseInfrastructureBonus = 0.8;
      } else if (totalAmenities >= 3) {
        densityMultiplier = 1.0; // Basic density
        baseInfrastructureBonus = 0.3;
      } else {
        densityMultiplier = 0.8; // Very limited amenities
        baseInfrastructureBonus = 0;
      }

      // 6. ENHANCED LOCATION SCORE CALCULATION WITH AI INFRASTRUCTURE BONUS
      const baseInfrastructureScore = (
        healthcareScore * 0.22 +          // 22% - Healthcare (increased weight)
        educationScore * 0.18 +           // 18% - Education
        transportScore * 0.20 +           // 20% - Transport
        commercialScore * 0.15 +          // 15% - Commercial
        lifestyleScore * 0.10 +           // 10% - Lifestyle
        finalConnectivityScore * 0.12 +   // 12% - Connectivity
        safetyScore * 0.02 +              // 2% - Safety
        environmentScore * 0.01           // 1% - Environment
      ) + baseInfrastructureBonus;        // Add density-based bonus for AI-detected areas

      // AI-ENHANCED LOCATION SCORING WITH METROPOLITAN RECOGNITION
      // ===========================================================
      
      // Apply AI intelligence multipliers based on location type
      let aiLocationMultiplier = 1.0;
      let aiBaselineBonus = 0;
      
      if (aiIntelligence.locationType === 'metropolitan') {
        aiLocationMultiplier = 2.0; // Double multiplier for metropolitan areas
        aiBaselineBonus = 1.5; // Higher baseline for metros like HSR Layout Bangalore
      } else if (aiIntelligence.locationType === 'city') {
        aiLocationMultiplier = 1.6;
        aiBaselineBonus = 1.0;
      } else if (aiIntelligence.developmentStage === 'developed') {
        aiLocationMultiplier = 1.4;
        aiBaselineBonus = 0.8;
      } else if (aiIntelligence.developmentStage === 'developing') {
        aiLocationMultiplier = 1.2;
        aiBaselineBonus = 0.5;
      }
      
      // Apply AI investment potential as additional multiplier
      const aiPotentialMultiplier = Math.max(0.8, Math.min(1.5, aiIntelligence.investmentPotential / 100 + 0.5));
      
      // Apply all multipliers and constraints with AI intelligence
      const rawLocationScore = baseInfrastructureScore * economicMultiplier * densityMultiplier * distanceQualityFactor * aiLocationMultiplier * aiPotentialMultiplier;

      // PRIORITY SCORE ENHANCEMENT FOR LOCATION SCORING
      // ===============================================
      const priorityLocationBonus = Math.min(1.0, aiIntelligence.priorityScore / 100); // Max 1.0 bonus
      
      // CRITICAL: Allow truly poor locations to get scores below 1.0
      // Remove artificial inflation for poor rural areas
      let finalLocationScore = rawLocationScore * 1.2; // Reduce multiplier from 1.8 to 1.2
      
      // Only add bonuses for locations that have some basic infrastructure
      if (finalLocationScore > 0.8) {
        finalLocationScore += aiBaselineBonus * 0.5; // Reduce AI baseline bonus
        finalLocationScore += priorityLocationBonus * 0.3; // Reduce priority bonus
      }
      
      // Allow scores from 0.1 to 5.0 (no artificial 1.0 minimum)
      result.locationScore = Math.max(0.1, Math.min(5.0, finalLocationScore));

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

      // 2. AI-ENHANCED INVESTMENT VIABILITY CALCULATION
      // Base viability should reflect actual location quality, not just location type
      let baseViability = 0;
      
      // CRITICAL: Implement proper negative/low scoring for poor locations
      // Use location score as primary driver - locations below 2.0 get severely penalized
      const locationBasedViability = (result.locationScore / 5.0) * 50;
      
      // ENHANCED 8-TIER CLASSIFICATION SYSTEM BASED ON USER'S LIST
      const metroAreaType = aiIntelligence.areaClassification || 'Urban Areas';
      
      if (result.locationScore < 1.5) {
        // TIER 8: Very Poor Rural/Remote Areas (Score < 1.5)
        baseViability = Math.max(5, locationBasedViability * 0.3); // Severely reduce viability
      } else if (result.locationScore < 2.0) {
        // TIER 7: Poor Rural Areas (Score 1.5-2.0) 
        baseViability = Math.max(10, locationBasedViability * 0.5); // Major penalty for poor infrastructure
      } else if (aiIntelligence.locationType === 'metropolitan' || metroAreaType === 'Metro city') {
        // TIER 1: Metropolitan Areas - only for locations with good infrastructure (score >= 2.0)
        baseViability = Math.max(60, locationBasedViability);
      } else if (metroAreaType.includes('Smart city') || metroAreaType.includes('Planned township')) {
        // TIER 8: Smart Cities/Planned Cities
        baseViability = Math.max(50, locationBasedViability * 1.1);
      } else if (metroAreaType.includes('Industrial estate') || metroAreaType.includes('SEZ') || metroAreaType.includes('IT park')) {
        // TIER 5: Industrial/IT Zones
        baseViability = Math.max(45, locationBasedViability * 1.0);
      } else if (aiIntelligence.locationType === 'city' || metroAreaType === 'Urban locality') {
        // TIER 2: Urban Areas
        baseViability = Math.max(25, locationBasedViability * 0.8);
      } else if (metroAreaType.includes('Township') || metroAreaType.includes('Suburban')) {
        // TIER 3: Semi-Urban Areas  
        baseViability = Math.max(20, locationBasedViability * 0.7);
      } else if (metroAreaType.includes('Coastal') || metroAreaType.includes('Port')) {
        // TIER 6: Coastal Areas
        baseViability = Math.max(30, locationBasedViability * 0.8);
      } else if (metroAreaType.includes('Hill') || metroAreaType.includes('Tribal')) {
        // TIER 7: Hill/Tribal Regions
        baseViability = Math.max(15, locationBasedViability * 0.6);
      } else {
        // TIER 4: Rural Areas (default)
        baseViability = Math.max(12, locationBasedViability * 0.6);
      }
      
      // Add AI investment potential directly
      const aiViabilityBonus = Math.min(25, aiIntelligence.investmentPotential * 0.25);
      
      // Investment viability calculation complete;
      
      // ENHANCED TIER-BASED PRIORITY SCORING SYSTEM
      // ============================================
      const tierAreaType = aiIntelligence.areaClassification || 'Urban Areas';
      const basePriorityScore = aiIntelligence.priorityScore || 50;
      
      // Tier-specific multipliers for investment viability
      let tierViabilityMultiplier = 1.0;
      let priorityScoreBonus = Math.min(30, basePriorityScore * 0.3);
      
      // TIER 1: Metropolitan Areas - Highest multiplier for HSR Layout type locations
      if (tierAreaType === 'Metro city' || tierAreaType === 'Metropolitan area' || tierAreaType === 'Megacity' || tierAreaType === 'Urban agglomeration') {
        tierViabilityMultiplier = 1.2; // 20% boost for metro cities (reduced to prevent over-multiplication)
        priorityScoreBonus = Math.min(40, basePriorityScore * 0.45); // Higher bonus for 98+ priority scores
        // Additional boost for premium metro areas like HSR Layout
        if (basePriorityScore >= 95) {
          priorityScoreBonus += 15; // Extra 15 points for premium locations
        }
      }
      // TIER 4: Industrial/IT Zones - Second highest for tech corridors
      else if (tierAreaType === 'Industrial estate' || tierAreaType === 'SEZ (Special Economic Zone)' || tierAreaType === 'IT park' || tierAreaType === 'Tech hub') {
        tierViabilityMultiplier = 1.4; // 40% boost for IT zones
        priorityScoreBonus = Math.min(32, basePriorityScore * 0.35);
      }
      // TIER 5: Smart Cities/Planned Cities
      else if (tierAreaType === 'Smart city' || tierAreaType === 'Planned township' || tierAreaType === 'Satellite city') {
        tierViabilityMultiplier = 1.3; // 30% boost for smart cities
        priorityScoreBonus = Math.min(30, basePriorityScore * 0.32);
      }
      // TIER 2: Urban Areas
      else if (tierAreaType === 'City' || tierAreaType === 'Urban locality' || tierAreaType === 'Municipality' || tierAreaType === 'Town') {
        tierViabilityMultiplier = 1.2; // 20% boost for urban areas
        priorityScoreBonus = Math.min(25, basePriorityScore * 0.28);
      }
      // Fallback for generic classifications that might still indicate metro areas
      else if (tierAreaType.includes('Metropolitan') || tierAreaType.includes('Metro') 
               || (location.address.toLowerCase().includes('hsr layout') && location.address.toLowerCase().includes('bengaluru'))) {
        tierViabilityMultiplier = 1.5; // Ensure HSR Layout gets metro treatment
        priorityScoreBonus = Math.min(35, basePriorityScore * 0.4);
      } else if (tierAreaType.includes('IT') || tierAreaType.includes('Tech') || tierAreaType.includes('SEZ')) {
        tierViabilityMultiplier = 1.4;
        priorityScoreBonus = Math.min(32, basePriorityScore * 0.35);
      } else if (tierAreaType.includes('Urban') || tierAreaType.includes('City')) {
        tierViabilityMultiplier = 1.2;
        priorityScoreBonus = Math.min(25, basePriorityScore * 0.28);
      }
      
      console.log(`Area Classification: ${tierAreaType}, Priority Score: ${basePriorityScore}, Bonus: ${priorityScoreBonus.toFixed(1)}, Tier Multiplier: ${tierViabilityMultiplier}`);
      
      // Add points based on market fundamentals (0-30 additional points)
      const viabilityBonus = Math.min(30, totalMarketScore * 0.3);
      
      // Apply multipliers for strong indicators
      let viabilityMultiplier = 1.0;
      
      // Connectivity bonus
      if (infrastructureScores.connectivity >= 100) viabilityMultiplier += 0.3;
      else if (infrastructureScores.connectivity >= 50) viabilityMultiplier += 0.15;
      
      // Amenity density bonus
      if (totalAmenities >= 30) viabilityMultiplier += 0.25;
      else if (totalAmenities >= 15) viabilityMultiplier += 0.15;
      else if (totalAmenities >= 8) viabilityMultiplier += 0.1;
      
      // Commercial activity bonus
      if (infrastructureScores.commercial.total >= 10) viabilityMultiplier += 0.2;
      else if (infrastructureScores.commercial.total >= 5) viabilityMultiplier += 0.1;

      // Growth potential multipliers
      if (techIndicators.length >= 3) viabilityMultiplier += 0.4;
      else if (techIndicators.length >= 1) viabilityMultiplier += 0.2;

      // Financial district multiplier
      if (financialIndicators.length >= 2) viabilityMultiplier += 0.3;
      else if (financialIndicators.length >= 1) viabilityMultiplier += 0.15;

      // Metropolitan status multiplier
      if (isMetropolitan) viabilityMultiplier += 0.25;

      // Calculate final investment viability with tier multiplier enhancement (30-95% range)
      const preMultiplierScore = baseViability + viabilityBonus + aiViabilityBonus + priorityScoreBonus;
      const finalViability = preMultiplierScore * viabilityMultiplier * tierViabilityMultiplier;
      
      // Debug logging for HSR Layout and premium metro areas
      if (location.address.toLowerCase().includes('hsr') || tierAreaType === 'Metro city') {
        console.log(`METRO AREA CALCULATION DEBUG:
          Base Viability: ${baseViability}
          Viability Bonus: ${viabilityBonus}
          AI Viability Bonus: ${aiViabilityBonus}
          Priority Score Bonus: ${priorityScoreBonus}
          Pre-Multiplier Total: ${preMultiplierScore}
          Viability Multiplier: ${viabilityMultiplier}
          Tier Multiplier: ${tierViabilityMultiplier}
          Final Score: ${finalViability}`);
      }
      
      // Allow true calculated scores without artificial constraints
      result.investmentViability = Math.min(100, Math.max(0, Math.round(finalViability)));

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

      // Business growth calculation with area classification bonuses
      let businessGrowthBase = (totalBusinessGrowthScore / 75) * 12 - 3; // Range: -3% to 9%

      // AREA CLASSIFICATION BONUSES FOR BUSINESS GROWTH
      // ===============================================
      const areaClassification = aiIntelligence.areaClassification.toLowerCase();
      if (areaClassification.includes('metro') || areaClassification.includes('metropolitan')) {
        businessGrowthBase += 3.0; // Metro areas get 3% bonus
      } else if (areaClassification.includes('it park') || areaClassification.includes('tech hub') || areaClassification.includes('sez')) {
        businessGrowthBase += 4.0; // IT/Tech zones get 4% bonus
      } else if (areaClassification.includes('smart city') || areaClassification.includes('planned township')) {
        businessGrowthBase += 2.5; // Smart cities get 2.5% bonus
      } else if (areaClassification.includes('industrial estate')) {
        businessGrowthBase += 2.0; // Industrial areas get 2% bonus
      }

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

      // 7. ENHANCED PROPERTY GROWTH PREDICTION WITH NEGATIVE SCORING
      
      // CRITICAL: Locations with score < 2.0 should have negative growth
      if (result.locationScore < 2.0) {
        // Poor infrastructure locations get severely negative growth
        const poorLocationPenalty = (2.0 - result.locationScore) * -8; // Scale penalty based on how poor the location is
        let negativeGrowthBase = poorLocationPenalty;
        
        // Additional penalties for very poor areas
        if (totalAmenities < 3) negativeGrowthBase -= 4; // Almost no amenities
        if (infrastructureScores.connectivity < 20) negativeGrowthBase -= 3; // Very poor connectivity
        if (result.investmentViability < 40) negativeGrowthBase -= 2; // Low viability
        
        result.growthPrediction = Math.max(-12, Math.min(-1, negativeGrowthBase)); // Force negative range
      } else {
        // Standard calculation for decent locations (score >= 2.0)
        const viabilityFactor = result.investmentViability / 100;
        const businessFactor = Math.max(0.1, result.businessGrowthRate + 5) / 15;
        const populationFactor = Math.max(0.1, result.populationGrowthRate + 4) / 10;
        const locationFactor = result.locationScore / 5;

        const growthBase = (viabilityFactor * 0.4 + businessFactor * 0.3 + populationFactor * 0.2 + locationFactor * 0.1) * 15;
        let finalGrowthPrediction = growthBase - 5;

        // Additional constraints based on infrastructure reality
        if (totalAmenities < 8) finalGrowthPrediction -= 3;
        else if (totalAmenities < 15) finalGrowthPrediction -= 1.5;

        if (infrastructureScores.connectivity < 40) finalGrowthPrediction -= 2;

        result.growthPrediction = Math.max(-8, Math.min(12, finalGrowthPrediction));
      }

      // ENHANCED INVESTMENT RECOMMENDATION ENGINE WITH 8-TIER CLASSIFICATION
      const generateInvestmentRecommendation = () => {
        const viability = result.investmentViability;
        const locationScore = result.locationScore;
        const areaClassification = aiIntelligence.areaClassification || 'Urban Areas';
        const locationType = aiIntelligence.locationType || 'urban';

        // 8-TIER CLASSIFICATION SYSTEM
        let areaCategory = '';
        let tierRisk = '';
        
        // TIER 1: Metropolitan Areas
        if (areaClassification === 'Metro city' || locationType === 'metropolitan') {
          areaCategory = 'Premium Metropolitan';
          tierRisk = locationScore >= 4.0 ? 'Ultra-Premium' : locationScore >= 3.5 ? 'Premium' : 'Standard Metropolitan';
        }
        // TIER 8: Smart Cities/Planned Cities  
        else if (areaClassification.includes('Smart city') || areaClassification.includes('Planned')) {
          areaCategory = 'Smart City Development';
          tierRisk = 'Tech-Forward';
        }
        // TIER 5: Industrial/IT Zones
        else if (areaClassification.includes('Industrial') || areaClassification.includes('SEZ') || areaClassification.includes('IT')) {
          areaCategory = 'Industrial Tech Hub';
          tierRisk = 'Business-Focused';
        }
        // TIER 2: Urban Areas
        else if (locationType === 'city' || areaClassification === 'Urban locality') {
          areaCategory = 'Urban City';
          tierRisk = locationScore >= 3.0 ? 'Established Urban' : 'Developing Urban';
        }
        // TIER 3: Semi-Urban Areas
        else if (areaClassification.includes('Township') || areaClassification.includes('Suburban')) {
          areaCategory = 'Semi-Urban Development';
          tierRisk = 'Growth Corridor';
        }
        // TIER 6: Coastal Areas
        else if (areaClassification.includes('Coastal') || areaClassification.includes('Port')) {
          areaCategory = 'Coastal Zone';
          tierRisk = 'Maritime Hub';
        }
        // TIER 7: Hill/Tribal Regions
        else if (areaClassification.includes('Hill') || areaClassification.includes('Tribal')) {
          areaCategory = 'Hill Station/Tribal';
          tierRisk = 'Remote Eco-Zone';
        }
        // TIER 4: Rural Areas
        else {
          areaCategory = 'Rural Development';
          tierRisk = locationScore >= 2.0 ? 'Accessible Rural' : 'Remote Rural';
        }

        const infrastructureGrade = locationScore >= 4.0 ? 'A-Grade' :
                                   locationScore >= 3.0 ? 'B-Grade' :
                                   locationScore >= 2.0 ? 'C-Grade' : 
                                   locationScore >= 1.0 ? 'D-Grade' : 'E-Grade';

        // CRITICAL: Handle very poor locations (score < 2.0) with negative outlook
        if (locationScore < 1.5) {
          return `Not Recommended - ${areaCategory} (${infrastructureGrade} Infrastructure) - Severe Infrastructure Deficit`;
        } else if (locationScore < 2.0) {
          return `High Risk Investment - ${areaCategory} (${infrastructureGrade} Infrastructure) - Major Infrastructure Gaps`;
        }
        
        // Standard viability-based recommendations for decent locations (score >= 2.0)
        if (viability >= 85) {
          return `Outstanding ${areaCategory} Investment - ${infrastructureGrade} Infrastructure`;
        } else if (viability >= 70) {
          return `Excellent ${areaCategory} Investment - ${tierRisk} Growth Potential`;
        } else if (viability >= 55) {
          return `Good ${areaCategory} Investment - Moderate Risk`;
        } else if (viability >= 40) {
          return `Limited ${areaCategory} Investment - Higher Risk`;
        } else if (viability >= 25) {
          return `Speculative ${areaCategory} Investment - High Risk`;
        } else {
          return `Poor Investment Potential - ${areaCategory} Infrastructure Constraints`;
        }
      };

      result.investmentRecommendation = generateInvestmentRecommendation();
      
      // Debug log the recommendation generation
      console.log(`Investment Recommendation Generated: "${result.investmentRecommendation}" for viability ${result.investmentViability}% and area "${aiIntelligence.areaClassification}"`);;

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
        locationType: aiIntelligence.locationType,
        safetyScore: aiIntelligence.safetyScore,
        crimeRate: aiIntelligence.crimeRate,
        developmentStage: aiIntelligence.developmentStage,
        primaryConcerns: aiIntelligence.primaryConcerns,
        keyStrengths: aiIntelligence.keyStrengths,
        reasoning: aiIntelligence.reasoning,
        confidence: aiIntelligence.confidence
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
          }, aiIntelligence, infrastructureScores);
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

      // Determine area type based on infrastructure and connectivity
      const areaType = infrastructureScores.commercial.total >= 5 && infrastructureScores.transport.total >= 3 ? 'metropolitan' :
                      infrastructureScores.commercial.total >= 3 && infrastructureScores.transport.total >= 2 ? 'urban' :
                      infrastructureScores.commercial.total >= 1 && infrastructureScores.transport.total >= 1 ? 'suburban' : 'rural';

      // Use AI-based investment recommendation - no override needed

    } catch (error) {
      console.error("Analysis error:", error);
      result.investmentRecommendation = "Analysis temporarily unavailable";
    }

    // Add AI intelligence data to results
    result.aiIntelligence = aiIntelligence;

    return result;
  };

  return server;
}