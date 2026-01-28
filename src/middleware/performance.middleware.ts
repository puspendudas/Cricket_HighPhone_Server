// performance.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';

/**
 * Performance monitoring middleware
 * Tracks response times and adds performance headers
 */
export class PerformanceMiddleware {
    /**
     * Add response time tracking to requests
     */
    public static responseTime() {
        return (req: Request, res: Response, next: NextFunction) => {
            const startTime = Date.now();
            
            // Override res.end to capture response time
            const originalEnd = res.end.bind(res);
            res.end = function(chunk?: any, encoding?: any, cb?: () => void) {
                const responseTime = Date.now() - startTime;
                
                // Add performance headers
                res.setHeader('X-Response-Time', `${responseTime}ms`);
                res.setHeader('X-Timestamp', new Date().toISOString());
                
                // Log slow requests (over 150ms)
                if (responseTime > 150) {
                    logger.warn(`Slow request detected: ${req.method} ${req.path} - ${responseTime}ms`, {
                        method: req.method,
                        path: req.path,
                        responseTime,
                        userAgent: req.get('User-Agent'),
                        ip: req.ip
                    });
                }
                
                // Log all API response times for monitoring
                logger.info(`API Response: ${req.method} ${req.path} - ${responseTime}ms`);
                
                // Call original end method with proper return
                return originalEnd(chunk, encoding, cb);
            } as any;
            
            next();
        };
    }
    
    /**
     * Add cache control headers for static content
     */
    public static cacheControl(maxAge: number = 300) {
        return (req: Request, res: Response, next: NextFunction) => {
            // Add cache headers for GET requests
            if (req.method === 'GET') {
                res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
                res.setHeader('ETag', `"${Date.now()}"`);
            }
            next();
        };
    }
    
    /**
     * Compression middleware for response optimization
     */
    public static enableCompression() {
        return (req: Request, res: Response, next: NextFunction) => {
            // Enable gzip compression for JSON responses
            if (req.headers['accept-encoding']?.includes('gzip')) {
                res.setHeader('Content-Encoding', 'gzip');
            }
            next();
        };
    }
}

/**
 * Simple in-memory cache for frequently accessed data
 */
export class SimpleCache {
    private static cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
    
    /**
     * Get cached data
     */
    public static get(key: string): any | null {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        // Check if cache has expired
        if (Date.now() - cached.timestamp > cached.ttl) {
            this.cache.delete(key);
            return null;
        }
        
        return cached.data;
    }
    
    /**
     * Set cache data with TTL (time to live) in milliseconds
     */
    public static set(key: string, data: any, ttl: number = 60000): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });
    }
    
    /**
     * Clear specific cache entry
     */
    public static delete(key: string): void {
        this.cache.delete(key);
    }
    
    /**
     * Clear all cache entries
     */
    public static clear(): void {
        this.cache.clear();
    }
    
    /**
     * Get cache statistics
     */
    public static getStats(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}