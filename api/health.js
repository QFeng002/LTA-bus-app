/**
 * Serverless function for checking LTA service health and credential configuration.
 * Compatible with Vercel Serverless Functions and Express.
 * Never exposes or logs the credential or any part of it.
 */

export default async function handler(req, res) {
  if (res.setHeader) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  }

  if (req.method === 'OPTIONS') {
    if (typeof res.status === 'function') {
      return res.status(204).end();
    }
    res.statusCode = 204;
    return res.end();
  }

  const apiKey = process.env.LTA_ACCOUNT_KEY;

  // 1. If key is missing or empty, do not call LTA at all
  if (!apiKey || apiKey.trim() === '') {
    const payload = {
      keyConfigured: false,
      ltaAnswered: false,
      upstreamStatus: null,
      error: 'LTA_ACCOUNT_KEY is not set. Add it in Vercel and redeploy.'
    };
    if (typeof res.status === 'function') {
      return res.status(503).json(payload);
    }
    res.statusCode = 503;
    return res.end(JSON.stringify(payload));
  }

  // 2. Key is configured; perform a health check ping to LTA DataMall
  const endpoint = 'https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival?BusStopCode=04121';

  try {
    const upstreamRes = await fetch(endpoint, {
      method: 'GET',
      headers: {
        AccountKey: apiKey,
        accept: 'application/json'
      }
    });

    const isOk = upstreamRes.ok;
    const statusCode = upstreamRes.status;

    const payload = {
      keyConfigured: true,
      ltaAnswered: isOk,
      upstreamStatus: statusCode,
      message: isOk
        ? 'LTA DataMall answered successfully'
        : `LTA DataMall returned upstream status ${statusCode}`
    };

    const httpStatus = isOk ? 200 : statusCode;
    if (typeof res.status === 'function') {
      return res.status(httpStatus).json(payload);
    }
    res.statusCode = httpStatus;
    return res.end(JSON.stringify(payload));
  } catch (err) {
    const payload = {
      keyConfigured: true,
      ltaAnswered: false,
      upstreamStatus: null,
      error: `Network error pinging LTA DataMall: ${err.message || 'Connection failed'}`
    };
    if (typeof res.status === 'function') {
      return res.status(502).json(payload);
    }
    res.statusCode = 502;
    return res.end(JSON.stringify(payload));
  }
}
