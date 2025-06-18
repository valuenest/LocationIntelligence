
import crypto from 'crypto';

// Generate secure session IDs
export const generateSecureSessionId = (): string => {
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(16).toString('hex');
  return `session_${timestamp}_${randomBytes.substring(0, 9)}`;
};

// Hash sensitive data
export const hashData = (data: string): string => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

// Generate secure random tokens
export const generateSecureToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

// Validate email format
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Remove sensitive information from logs
export const sanitizeForLogging = (obj: any): any => {
  const sensitive = ['password', 'apiKey', 'token', 'secret', 'key'];
  const sanitized = { ...obj };
  
  for (const key in sanitized) {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    }
  }
  
  return sanitized;
};

// Check for SQL injection patterns
export const detectSQLInjection = (input: string): boolean => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
    /(\-\-|\#|\/\*|\*\/)/,
    /(\b(OR|AND)\b.*[=<>])/i,
    /('.*'|".*")/
  ];
  
  return sqlPatterns.some(pattern => pattern.test(input));
};

// Check for XSS patterns
export const detectXSS = (input: string): boolean => {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi
  ];
  
  return xssPatterns.some(pattern => pattern.test(input));
};
