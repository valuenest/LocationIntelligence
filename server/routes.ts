import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAnalysisRequestSchema } from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";

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
}

export async function registerRoutes(app: Express): Promise<Server> {
  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY || "";
  const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
  const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

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
          `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=5000&type=${type}&key=${GOOGLE_MAPS_API_KEY}`
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

  // Analysis logic
  const performAnalysis = async (location: LocationData, amount: number, propertyType: string, planType: string): Promise<AnalysisResult> => {
    const result: AnalysisResult = {
      locationScore: 0,
      growthPrediction: 0,
      nearbyPlaces: [],
      distances: {},
    };

    // Basic analysis for all plans
    const keyPlaceTypes = ['school', 'hospital', 'subway_station'];
    result.nearbyPlaces = await findNearbyPlaces(location.lat, location.lng, keyPlaceTypes);
    result.distances = await calculateDistances(location, result.nearbyPlaces);

    // Calculate location score based on proximity to key amenities
    let score = 3.0; // Base score
    Object.values(result.distances).forEach(dist => {
      if (dist.distance.value < 1000) score += 0.5; // Very close
      else if (dist.distance.value < 2000) score += 0.3; // Close
      else if (dist.distance.value < 5000) score += 0.1; // Moderate
    });
    result.locationScore = Math.min(5.0, score);

    // Enhanced analysis for paid plans
    if (planType === 'paid' || planType === 'pro') {
      // Add more place types for comprehensive analysis
      const extendedPlaceTypes = ['shopping_mall', 'restaurant', 'bank', 'gas_station', 'park'];
      const additionalPlaces = await findNearbyPlaces(location.lat, location.lng, extendedPlaceTypes);
      result.nearbyPlaces.push(...additionalPlaces);

      // Calculate growth prediction based on area development
      const developmentFactor = result.nearbyPlaces.length / 10; // Simple heuristic
      const baseGrowth = propertyType === 'apartment' ? 12 : 15; // Different growth for different property types
      result.growthPrediction = Math.min(25, baseGrowth + developmentFactor * 5);

      // Street View URL
      result.streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${location.lat},${location.lng}&key=${GOOGLE_MAPS_API_KEY}`;
    }

    // AI recommendations for pro plan
    if (planType === 'pro') {
      result.aiRecommendations = [
        'Consider checking upcoming infrastructure projects in this area',
        'Look for similar properties 2-3 km away for better pricing',
        'Metro connectivity planned for 2025 will boost property values',
      ];
    }

    return result;
  };

  // API Routes
  app.get('/api/maps-config', async (req, res) => {
    res.json({
      apiKey: GOOGLE_MAPS_API_KEY,
    });
  });

  app.post('/api/analyze', async (req, res) => {
    try {
      const clientIP = getClientIP(req);
      const { location, amount, propertyType, planType } = req.body;

      // Validate input
      if (!location || !amount || !propertyType || !planType) {
        return res.status(400).json({ error: 'Missing required fields' });
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

      // Perform analysis
      const analysisResult = await performAnalysis(locationData, amount, propertyType, planType);

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

      // Verify payment signature (simplified - in production, use proper verification)
      // const expectedSignature = crypto
      //   .createHmac('sha256', RAZORPAY_KEY_SECRET)
      //   .update(orderId + '|' + paymentId)
      //   .digest('hex');

      // For demo purposes, accept all payments
      const verified = true; // expectedSignature === signature;

      if (!verified) {
        return res.status(400).json({ error: 'Payment verification failed' });
      }

      // Update analysis request with payment info
      const analysisRequest = await storage.updateAnalysisRequest(analysisId, {
        paymentId,
      });

      // Re-run analysis with paid features
      const locationData = analysisRequest.location as LocationData;
      const enhancedResult = await performAnalysis(
        locationData,
        analysisRequest.amount,
        analysisRequest.propertyType,
        analysisRequest.planType
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

      // Find analysis request by session ID
      const analysisRequests = Array.from((storage as any).analysisRequests.values());
      const analysisRequest = analysisRequests.find((req: any) => req.sessionId === sessionId);

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

  const httpServer = createServer(app);
  return httpServer;
}
