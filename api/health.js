/**
 * Health check API handler
 * Vercel serverless function and Express route handler
 *
 * Reports whether the key is configured (keyConfigured) and whether LTA
 * answered, including the upstream HTTP status code.
 * Never prints the key or any part of it.
 */
export default async function handler(req, res) {
  const accountKey = process.env.LTA_ACCOUNT_KEY;

  // BEFORE the fetch, if that variable is missing or empty, return 503
  // and do not call LTA at all; never let an unset variable reach the header.
  if (!accountKey || !accountKey.trim()) {
    return res.status(503).json({
      keyConfigured: false,
      ltaAnswered: false,
      upstreamStatus: null,
      upstreamStatusCode: null,
      error: 'LTA_ACCOUNT_KEY is not set. Add it in Vercel and redeploy.',
    });
  }

  try {
    const response = await fetch(
      'https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival?BusStopCode=04121',
      {
        method: 'GET',
        headers: {
          AccountKey: accountKey.trim(),
        },
      }
    );

    const upstreamStatus = response.status;

    // Check response.ok before reading the body. LTA returns empty body on 401.
    if (!response.ok) {
      return res.status(upstreamStatus).json({
        keyConfigured: true,
        ltaAnswered: true,
        upstreamStatus,
        upstreamStatusCode: upstreamStatus,
        error: `Upstream LTA responded with status ${upstreamStatus}: ${response.statusText || 'Error'}`,
      });
    }

    return res.status(200).json({
      keyConfigured: true,
      ltaAnswered: true,
      upstreamStatus,
      upstreamStatusCode: upstreamStatus,
      status: 'healthy',
    });
  } catch (err) {
    return res.status(502).json({
      keyConfigured: true,
      ltaAnswered: false,
      upstreamStatus: null,
      upstreamStatusCode: null,
      error: `Failed to contact upstream LTA: ${err.message || 'Network error'}`,
    });
  }
}
