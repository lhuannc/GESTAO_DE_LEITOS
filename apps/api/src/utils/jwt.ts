import jwt from 'jsonwebtoken';

// Environment-based configuration
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production-min-32-chars';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'; // 7 days

export interface JWTPayload {
  userId: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * Sign a JWT token with user information
 */
export function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { 
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'gestao-leitos-api',
  });
}

/**
 * Verify and decode a JWT token
 * @throws Error if token is invalid or expired
 */
export function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'gestao-leitos-api',
    }) as JWTPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expirado. Faça login novamente.');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Token inválido.');
    }
    throw error;
  }
}

/**
 * Get cookie options based on environment
 * In production (HTTPS), cookies will have Secure flag
 */
export function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    httpOnly: true, // Cannot be accessed by JavaScript (XSS protection)
    secure: isProduction, // HTTPS only in production
    sameSite: 'lax' as const, // CSRF protection
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    path: '/', // Available for all routes
    domain: process.env.COOKIE_DOMAIN, // Optional: set for subdomain sharing
  };
}
