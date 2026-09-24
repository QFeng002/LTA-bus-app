/**
 * Serverless function for LTA Singapore Bus Arrivals.
 * Compatible with Vercel Serverless Functions and Express.
 */

export default async function handler(req, res) {
  // Support CORS and preflight if called externally
  if (res.setHeader) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') {
    if (typeof res.status === 'function') {
      return res.status(204).end();
    }
    res.statusCode = 204;
    return res.end();
  }

  // Set Cache-Control header: LTA refreshes every 20s
  if (res.setHeader) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40');
  }

  // 1. Validate environment credential BEFORE any fetch
  const apiKey = process.env.LTA_ACCOUNT_KEY;
  if (!apiKey || apiKey.trim() === '') {
    const errorBody = { error: 'LTA_ACCOUNT_KEY is not set. Add it in Vercel and redeploy.' };
    if (typeof res.status === 'function') {
      return res.status(503).json(errorBody);
    }
    res.statusCode = 503;
    return res.end(JSON.stringify(errorBody));
  }

  // 2. Extract BusStopCode query parameter (defaults to 04121)
  let busStopCode = '04121';
  if (req.query && (req.query.BusStopCode || req.query.busStopCode || req.query.busstopcode)) {
    busStopCode = (req.query.BusStopCode || req.query.busStopCode || req.query.busstopcode).toString().trim();
  } else if (req.url) {
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      const param = parsedUrl.searchParams.get('BusStopCode') ||
                    parsedUrl.searchParams.get('busStopCode') ||
                    parsedUrl.searchParams.get('busstopcode');
      if (param && param.trim()) {
        busStopCode = param.trim();
      }
    } catch {
      // Keep default
    }
  }

  const endpoint = `https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival?BusStopCode=${encodeURIComponent(busStopCode)}`;

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        AccountKey: apiKey,
        accept: 'application/json'
      }
    });

    // AFTER fetch: check response.ok before reading body to avoid crash on empty error replies
    if (!response.ok) {
      const errorPayload = {
        error: `LTA DataMall API error: upstream returned status ${response.status}`,
        upstreamStatus: response.status
      };
      if (typeof res.status === 'function') {
        return res.status(response.status).json(errorPayload);
      }
      res.statusCode = response.status;
      return res.end(JSON.stringify(errorPayload));
    }

    const data = await response.json();
    const rawServices = Array.isArray(data?.Services)
      ? data.Services
      : (Array.isArray(data?.services) ? data.services : []);

    const now = Date.now();

    // Map each service to ServiceNo and the minutes until each of the next two buses
    const simplifiedServices = rawServices.map((service) => {
      const serviceNo = String(service?.ServiceNo || service?.serviceNo || '').trim();
      const nextBuses = [service?.NextBus, service?.NextBus2];
      const arrivals = [];

      for (const bus of nextBuses) {
        if (bus && typeof bus.EstimatedArrival === 'string') {
          const etaStr = bus.EstimatedArrival.trim();
          if (etaStr !== '') {
            const etaTime = new Date(etaStr).getTime();
            if (!isNaN(etaTime)) {
              const diffMs = etaTime - now;
              // Round down to whole minutes as LTA's guide asks
              const diffMinutes = Math.floor(diffMs / 60000);
              const validMinutes = Math.max(0, diffMinutes);
              if (typeof validMinutes === 'number' && !isNaN(validMinutes)) {
                arrivals.push(validMinutes);
              }
            }
          }
        }
      }

      return {
        ServiceNo: serviceNo,
        arrivals,
        nextBuses: arrivals,
        ...(arrivals.length > 0 ? { nextBus: arrivals[0] } : {}),
        ...(arrivals.length > 1 ? { nextBus2: arrivals[1] } : {})
      };
    });

    const result = {
      BusStopCode: busStopCode,
      services: simplifiedServices,
      Services: simplifiedServices
    };

    if (typeof res.status === 'function') {
      return res.status(200).json(result);
    }
    res.statusCode = 200;
    return res.end(JSON.stringify(result));
  } catch (err) {
    const errorPayload = {
      error: `Network error connecting to upstream service: ${err.message || 'Unknown error'}`,
      upstreamStatus: null
    };
    if (typeof res.status === 'function') {
      return res.status(502).json(errorPayload);
    }
    res.statusCode = 502;
    return res.end(JSON.stringify(errorPayload));
  }
}
