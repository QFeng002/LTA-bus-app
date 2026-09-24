/**
 * Bus arrival API handler
 * Vercel serverless function and Express route handler
 *
 * Accepts a BusStopCode query parameter, defaults to 04121.
 * Calls https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival
 * Returns a simplified list with ServiceNo and minutes until next two buses.
 */
export default async function handler(req, res) {
  const accountKey = process.env.LTA_ACCOUNT_KEY;

  // BEFORE the fetch, if that variable is missing or empty, return 503
  // and do not call LTA at all; never let an unset variable reach the header.
  if (!accountKey || !accountKey.trim()) {
    return res.status(503).json({
      error: 'LTA_ACCOUNT_KEY is not set. Add it in Vercel and redeploy.',
    });
  }

  // Accepts a BusStopCode query parameter, defaults to 04121
  const busStopCode =
    (req.query?.BusStopCode || req.query?.busStopCode || '04121')
      .toString()
      .trim() || '04121';

  const endpoint = `https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival?BusStopCode=${encodeURIComponent(busStopCode)}`;

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        AccountKey: accountKey.trim(),
      },
    });

    // AFTER the fetch, check response.ok before reading the body.
    // LTA returns an empty body on 401, so calling response.json() on a failed reply throws and crashes.
    // On a non-2xx reply, return the upstream status and a one-line reason in your own JSON instead.
    if (!response.ok) {
      return res.status(response.status).json({
        error: `Upstream LTA error: ${response.status} ${response.statusText || 'Request failed'}`.trim(),
      });
    }

    const data = await response.json();

    // Set Cache-Control: s-maxage=20, stale-while-revalidate=40
    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40');

    // Treat an empty Services array as "no buses running", not as an error.
    const rawServices = Array.isArray(data?.Services) ? data.Services : [];
    const now = Date.now();

    function getMinutes(bus) {
      if (!bus || typeof bus !== 'object') return null;
      const eta = bus.EstimatedArrival;
      // LTA returns empty strings when there is no such bus: treat empty EstimatedArrival as no bus and omit it
      if (!eta || typeof eta !== 'string' || eta.trim() === '') {
        return null;
      }
      const time = new Date(eta).getTime();
      if (isNaN(time)) {
        return null;
      }
      const diffMs = time - now;
      // Round down to whole minutes as LTA's guide asks
      const diffMins = Math.floor(diffMs / 60000);
      // Under one minute or arrived -> 0 (rendered as "Arriving" on screen)
      return Math.max(0, diffMins);
    }

    const simplifiedList = rawServices.map((service) => {
      const minutes = [];

      const min1 = getMinutes(service.NextBus);
      if (typeof min1 === 'number' && !isNaN(min1)) {
        minutes.push(min1);
      }

      const min2 = getMinutes(service.NextBus2);
      if (typeof min2 === 'number' && !isNaN(min2)) {
        minutes.push(min2);
      }

      return {
        ServiceNo: service.ServiceNo,
        minutes,
        nextBuses: minutes,
      };
    });

    if (req.query?.format === 'object') {
      return res.status(200).json({
        BusStopCode: busStopCode,
        services: simplifiedList,
      });
    }

    return res.status(200).json(simplifiedList);
  } catch (err) {
    return res.status(502).json({
      error: `Failed to fetch from upstream LTA: ${err.message || 'Unknown error'}`,
    });
  }
}
