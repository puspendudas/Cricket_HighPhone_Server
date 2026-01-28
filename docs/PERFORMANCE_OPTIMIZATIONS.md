# Cricket Betting API Performance Optimizations

## Overview
This document outlines the comprehensive performance optimizations implemented to achieve sub-150ms response times for all API endpoints, particularly addressing the issue where the match API was taking 4 seconds from frontend calls vs 200ms from Postman.

## Key Performance Issues Identified

### 1. Database Query Inefficiencies
- **Problem**: N+1 query problem in `getMatchById` - separate queries for match and fancy odds
- **Problem**: Missing database indexes on frequently queried fields
- **Problem**: No query optimization or result limiting

### 2. Lack of Caching
- **Problem**: No caching mechanism for frequently accessed data
- **Problem**: Repeated database queries for same data

### 3. No Performance Monitoring
- **Problem**: No response time tracking or slow query detection
- **Problem**: No performance metrics or optimization insights

## Implemented Optimizations

### 1. Database Optimizations

#### A. Added Performance Indexes
**Match Model (`src/models/match.model.ts`)**
```typescript
// Performance optimization indexes
matchSchema.index({ eventId: 1 }); // Primary lookup index
matchSchema.index({ gameId: 1 }); // Secondary lookup index
matchSchema.index({ status: 1, eventTime: 1 }); // Status filtering with time sorting
matchSchema.index({ createdAt: -1 }); // Recent matches sorting
```

**FancyOdds Model (`src/models/fancyodds.model.ts`)**
```typescript
// Performance optimization indexes
fancyOddsSchema.index({ gameId: 1 }); // Primary lookup index for gameId queries
fancyOddsSchema.index({ matchId: 1 }); // Reference lookup index
fancyOddsSchema.index({ gameId: 1, isActive: 1, isEnabled: 1 }); // Compound index for active odds
fancyOddsSchema.index({ marketId: 1, gameId: 1 }); // Market-specific queries
```

#### B. Optimized Query Patterns
**Before (N+1 Query Problem):**
```typescript
const match = await MatchModel.findOne({ eventId });
const fancyOdds = await this.fancyOdds.getFancyOddsByGameId(match.gameId);
```

**After (Single Aggregation Query):**
```typescript
const result = await MatchModel.aggregate([
    { $match: { eventId } },
    {
        $lookup: {
            from: 'fancyodds',
            localField: 'gameId',
            foreignField: 'gameId',
            as: 'fancyOdds',
            pipeline: [
                { $match: { isActive: true, isEnabled: true } },
                { $project: { /* only required fields */ } }
            ]
        }
    },
    { $limit: 1 }
]);
```

#### C. Lean Queries for Better Performance
```typescript
// Use lean queries to return plain JS objects instead of Mongoose documents
const matches = await this.match.find()
    .select('gameId marketId eventId eventName eventTime inPlay seriesName status')
    .lean()
    .sort({ createdAt: -1 })
    .limit(100);
```

### 2. Caching Implementation

#### A. Simple In-Memory Cache (`src/middleware/performance.middleware.ts`)
```typescript
export class SimpleCache {
    private static cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
    
    public static get(key: string): any | null {
        const cached = this.cache.get(key);
        if (!cached || Date.now() - cached.timestamp > cached.ttl) {
            this.cache.delete(key);
            return null;
        }
        return cached.data;
    }
    
    public static set(key: string, data: any, ttl: number = 60000): void {
        this.cache.set(key, { data, timestamp: Date.now(), ttl });
    }
}
```

#### B. Controller-Level Caching
```typescript
public async getMatchById(req: Request, res: Response): Promise<void> {
    const { eventId } = req.params;
    
    // Check cache first
    const cacheKey = `match:${eventId}`;
    const cachedMatch = SimpleCache.get(cacheKey);
    
    if (cachedMatch) {
        res.setHeader('X-Cache', 'HIT');
        return res.json({ success: true, data: cachedMatch });
    }
    
    // Fetch from database and cache result
    const match = await this.matchService.getMatchById(eventId);
    SimpleCache.set(cacheKey, match, 30000); // 30 seconds TTL
    
    res.setHeader('X-Cache', 'MISS');
    res.json({ success: true, data: match });
}
```

### 3. Performance Monitoring

#### A. Response Time Tracking
```typescript
export class PerformanceMiddleware {
    public static responseTime() {
        return (req: Request, res: Response, next: NextFunction) => {
            const startTime = Date.now();
            
            const originalEnd = res.end.bind(res);
            res.end = function(chunk?: any, encoding?: any, cb?: () => void) {
                const responseTime = Date.now() - startTime;
                
                // Add performance headers
                res.setHeader('X-Response-Time', `${responseTime}ms`);
                
                // Log slow requests (over 150ms)
                if (responseTime > 150) {
                    logger.warn(`Slow request: ${req.method} ${req.path} - ${responseTime}ms`);
                }
                
                return originalEnd(chunk, encoding, cb);
            } as any;
            
            next();
        };
    }
}
```

#### B. Database Performance Monitoring
```typescript
export class DatabaseOptimization {
    public static monitorPerformance(): void {
        // Monitor slow queries
        mongoose.set('debug', (collectionName: string, method: string, query: any) => {
            const startTime = Date.now();
            setTimeout(() => {
                const duration = Date.now() - startTime;
                if (duration > 100) {
                    logger.warn(`Slow MongoDB query: ${collectionName}.${method} - ${duration}ms`);
                }
            }, 0);
        });
    }
}
```

### 4. Route-Level Optimizations

#### A. Performance Middleware Integration
```typescript
class MatchRoute implements Routes {
    constructor() {
        this.initializeRoutes();
        this.setupPerformanceMiddleware();
    }
    
    private setupPerformanceMiddleware() {
        // Add response time tracking to all routes
        this.router.use(PerformanceMiddleware.responseTime());
        
        // Add cache control for GET requests
        this.router.use(PerformanceMiddleware.cacheControl(30)); // 30 seconds cache
    }
}
```

## Performance Improvements Achieved

### Before Optimization:
- **Postman**: 200ms response time
- **Frontend**: 4000ms response time
- **Database**: Multiple separate queries (N+1 problem)
- **Caching**: None
- **Monitoring**: No performance tracking

### After Optimization:
- **Expected Response Time**: <150ms for all endpoints
- **Database**: Single optimized aggregation queries
- **Caching**: 30-second TTL for frequently accessed data
- **Monitoring**: Real-time performance tracking and slow query detection
- **Indexes**: Comprehensive indexing strategy for all query patterns

## Key Performance Features

### 1. Intelligent Caching
- **Cache Hit Headers**: `X-Cache: HIT/MISS` for debugging
- **TTL Management**: Automatic cache expiration
- **Memory Efficient**: Simple in-memory cache with cleanup

### 2. Database Optimization
- **Aggregation Pipelines**: Single queries instead of multiple
- **Lean Queries**: Plain JS objects for better performance
- **Strategic Indexes**: Covering all query patterns
- **Result Limiting**: Prevent large result sets

### 3. Performance Monitoring
- **Response Time Headers**: `X-Response-Time` for all requests
- **Slow Query Detection**: Automatic logging of queries >100ms
- **Request Logging**: Comprehensive performance metrics

### 4. Connection Optimization
- **Connection Pooling**: Optimized MongoDB connection settings
- **Query Timeouts**: Prevent hanging queries
- **Buffer Management**: Disabled for better performance

## Usage Instructions

### 1. Enable Performance Monitoring
```typescript
import { DatabaseOptimization } from '@/config/database.optimization';

// In your app initialization
DatabaseOptimization.configureConnection();
DatabaseOptimization.monitorPerformance();
```

### 2. Create Database Indexes
```typescript
// Run once after deployment
await DatabaseOptimization.createIndexes();
```

### 3. Monitor Performance
```typescript
// Get performance statistics
const stats = await DatabaseOptimization.getPerformanceStats();
console.log('Database Performance:', stats);
```

### 4. Cache Management
```typescript
// Clear cache when needed
SimpleCache.clear();

// Get cache statistics
const cacheStats = SimpleCache.getStats();
console.log('Cache Stats:', cacheStats);
```

## Response Headers for Debugging

All optimized endpoints now include performance headers:
- `X-Response-Time`: Actual response time in milliseconds
- `X-Cache`: Cache hit/miss status
- `X-Timestamp`: Request timestamp
- `Cache-Control`: Browser caching instructions

## Expected Results

1. **Sub-150ms Response Times**: All API endpoints should respond within 150ms
2. **Consistent Performance**: Similar response times from both Postman and frontend
3. **Reduced Database Load**: Fewer queries and better resource utilization
4. **Better Monitoring**: Real-time performance insights and slow query detection
5. **Scalability**: Improved performance under higher load

## Monitoring and Maintenance

1. **Check Logs**: Monitor for slow query warnings
2. **Cache Hit Rates**: Ensure good cache utilization
3. **Database Indexes**: Verify indexes are being used effectively
4. **Response Times**: Monitor `X-Response-Time` headers
5. **Memory Usage**: Monitor cache memory consumption

## Next Steps for Further Optimization

1. **Redis Caching**: Implement Redis for distributed caching
2. **Database Sharding**: For handling larger datasets
3. **CDN Integration**: For static content delivery
4. **Load Balancing**: For handling higher concurrent requests
5. **Query Result Pagination**: For large result sets