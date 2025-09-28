import type { APIRoute } from 'astro';

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  responseTime?: number;
  error?: string;
  url?: string;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  frontend: {
    status: 'healthy';
    nodeVersion?: string;
    memoryUsage?: NodeJS.MemoryUsage;
  };
  services: ServiceStatus[];
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    unknown: number;
  };
}

// Helper function to check service health
async function checkService(name: string, url: string, timeout: number = 5000): Promise<ServiceStatus> {
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Frontend-Health-Check/1.0'
      }
    });
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      return {
        name,
        status: 'healthy',
        responseTime,
        url
      };
    } else {
      return {
        name,
        status: 'unhealthy',
        responseTime,
        error: `HTTP ${response.status}: ${response.statusText}`,
        url
      };
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      name,
      status: 'unhealthy',
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error',
      url
    };
  }
}

// Get environment variables with fallbacks
const getServiceUrls = () => {
  return {
    orchestrationApi: import.meta.env.ORCHESTRATION_API_URL || 'http://localhost:3001',
  };
};

export const GET: APIRoute = async () => {
  const startTime = Date.now();
  const serviceUrls = getServiceUrls();
  
  try {
    // Define services to check - only orchestration API as it handles all backend communication
    const servicesToCheck = [
      {
        name: 'Orchestration API',
        url: `${serviceUrls.orchestrationApi}/health`
      }
    ];

    // Check all services in parallel
    const serviceChecks = await Promise.all(
      servicesToCheck.map(service => 
        checkService(service.name, service.url)
      )
    );

    // Calculate summary
    const summary = {
      total: serviceChecks.length,
      healthy: serviceChecks.filter(s => s.status === 'healthy').length,
      unhealthy: serviceChecks.filter(s => s.status === 'unhealthy').length,
      unknown: serviceChecks.filter(s => s.status === 'unknown').length
    };

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (summary.healthy === summary.total) {
      overallStatus = 'healthy';
    } else if (summary.healthy > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'unhealthy';
    }

    // Get package.json version if available
    let version = '1.0.0';
    try {
      // In production, this would be built into the app
      version = process.env.npm_package_version || '1.0.0';
    } catch {
      // Fallback version
    }

    // Check if we're in development environment
    const isDev = import.meta.env.DEV || import.meta.env.NODE_ENV === 'development';

    const healthResponse: HealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version,
      uptime: process.uptime(),
      frontend: {
        status: 'healthy',
        ...(isDev && {
          nodeVersion: process.version,
          memoryUsage: process.memoryUsage()
        })
      },
      services: serviceChecks,
      summary
    };

    // Set appropriate HTTP status code
    const httpStatus = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 207 : 503;

    return new Response(
      JSON.stringify(healthResponse, null, 2),
      {
        status: httpStatus,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Response-Time': `${Date.now() - startTime}ms`
        }
      }
    );

  } catch (error) {
    console.error('Health check error:', error);
    
    // Check if we're in development environment
    const isDev = import.meta.env.DEV || import.meta.env.NODE_ENV === 'development';

    const errorResponse: HealthResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: process.uptime(),
      frontend: {
        status: 'healthy',
        ...(isDev && {
          nodeVersion: process.version,
          memoryUsage: process.memoryUsage()
        })
      },
      services: [],
      summary: {
        total: 0,
        healthy: 0,
        unhealthy: 0,
        unknown: 0
      }
    };

    return new Response(
      JSON.stringify(errorResponse, null, 2),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Response-Time': `${Date.now() - startTime}ms`
        }
      }
    );
  }
};

// Handle OPTIONS for CORS preflight
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
    },
  });
};

