
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// API key validation middleware (if you implement API keys later)
export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  
  // Skip API key validation in development
  if (process.env.NODE_ENV === 'development') {
    return next();
  }
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  // Add your API key validation logic here
  // For now, we'll allow all requests in development
  next();
};

// Session validation middleware
export const validateSession = (req: Request, res: Response, next: NextFunction) => {
  const sessionId = req.headers['x-session-id'] as string;
  
  if (!sessionId) {
    return res.status(401).json({ error: 'Session ID required' });
  }
  
  // Basic session ID format validation
  const sessionIdSchema = z.string().regex(/^session_\d+_[a-z0-9]{9}$/);
  const validationResult = sessionIdSchema.safeParse(sessionId);
  
  if (!validationResult.success) {
    return res.status(401).json({ error: 'Invalid session ID format' });
  }
  
  next();
};

// Request logging middleware for security monitoring
export const securityLogger = (req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent');
  const method = req.method;
  const url = req.url;
  
  // Log suspicious activity
  if (method === 'POST' && req.body) {
    const bodySize = JSON.stringify(req.body).length;
    if (bodySize > 100000) { // Large payload
      console.warn(`Large payload detected: ${ip} - ${method} ${url} - ${bodySize} bytes`);
    }
  }
  
  // Log all API requests for security monitoring
  if (url.startsWith('/api/')) {
    console.log(`API Request: ${timestamp} - ${ip} - ${method} ${url} - ${userAgent}`);
  }
  
  next();
};
