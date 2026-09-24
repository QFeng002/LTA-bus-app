/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Bus,
  Clock,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  MapPin,
  Search,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Radio
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BusServiceData {
  ServiceNo: string;
  arrivals: number[]; // whole minutes, empty array if none running
  nextBus?: number;
  nextBus2?: number;
}

interface BusArrivalResponse {
  BusStopCode: string;
  services: BusServiceData[];
  Services?: BusServiceData[];
  error?: string;
  upstreamStatus?: number | null;
}

interface HealthStatus {
  keyConfigured: boolean;
  ltaAnswered: boolean;
  upstreamStatus: number | null;
  message?: string;
  error?: string;
}

// Popular sample bus stops around Singapore (including SMU)
const PRESET_BUS_STOPS = [
  { code: '04121', name: 'Old Hill St Police Stn (SMU / Clarke Quay)' },
  { code: '01012', name: 'Hotel Grand Pacific (Bras Basah / SMU)' },
  { code: '08057', name: 'Dhoby Ghaut Stn / Plaza Singapura' },
  { code: '04111', name: 'Opp The Treasury (City Hall)' },
  { code: '09048', name: 'Orchard Stn / Lucky Plaza' },
  { code: '17099', name: 'Opp Botanic Gdns Stn' }
];

export default function App() {
  const [busStopCode, setBusStopCode] = useState('04121');
  const [searchInput, setSearchInput] = useState('04121');
  const [data, setData] = useState<BusArrivalResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<number>(20);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [showHealthModal, setShowHealthModal] = useState(false);

  // Formatted date string for the required footer licence
  const accessDate = useMemo(() => {
    return new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }, []);

  // Fetch health status
  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      const json = await res.json();
      setHealth(json);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reach health endpoint';
      setHealth({
        keyConfigured: false,
        ltaAnswered: false,
        upstreamStatus: null,
        error: errorMessage
      });
    }
  }, []);

  // Fetch bus arrival timings
  const fetchBusArrivals = useCallback(
    async (targetCode: string, showIndicator = true) => {
      if (showIndicator) {
        setIsRefreshing(true);
      }
      setError(null);

      try {
        const res = await fetch(`/api/bus?BusStopCode=${encodeURIComponent(targetCode)}`);
        const json: BusArrivalResponse = await res.json();

        if (!res.ok) {
          setError(json.error || `Error fetching bus arrivals (Status: ${res.status})`);
          setData(null);
        } else {
          setData(json);
          setLastUpdated(new Date());
          setError(null);
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Network error';
        setError(`Failed to connect: ${errorMsg}`);
        setData(null);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setCountdown(20);
      }
    },
    []
  );

  // Initial load and periodic health check
  useEffect(() => {
    fetchBusArrivals(busStopCode, false);
    fetchHealth();
  }, [busStopCode, fetchBusArrivals, fetchHealth]);

  // Exact 20-second refresh interval matching LTA refresh rate & API cache
  useEffect(() => {
    const timer = setInterval(() => {
      fetchBusArrivals(busStopCode, true);
    }, 20000);

    return () => clearInterval(timer);
  }, [busStopCode, fetchBusArrivals]);

  // Countdown timer ticker
  useEffect(() => {
    const ticker = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 20));
    }, 1000);

    return () => clearInterval(ticker);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = searchInput.trim();
    if (!cleanCode) return;
    setBusStopCode(cleanCode);
    setIsLoading(true);
    fetchBusArrivals(cleanCode, false);
  };

  const handleSelectPreset = (code: string) => {
    setSearchInput(code);
    setBusStopCode(code);
    setIsLoading(true);
    fetchBusArrivals(code, false);
  };

  const servicesList = data?.services || data?.Services || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-950/40">
              <Bus className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">SG Bus Arrival Live</h1>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Live Feed
                </span>
              </div>
              <p className="text-xs text-slate-400">Singapore LTA DataMall • 20s Refresh Interval</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Health Status Indicator */}
            <button
              onClick={() => {
                fetchHealth();
                setShowHealthModal(true);
              }}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-750 transition flex items-center gap-1.5 text-slate-300"
              title="Click to view API service health"
            >
              {health?.keyConfigured && health?.ltaAnswered ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">LTA Connected</span>
                </>
              ) : health?.keyConfigured === false ? (
                <>
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Key Needed</span>
                </>
              ) : (
                <>
                  <Radio className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                  <span className="hidden sm:inline">Checking</span>
                </>
              )}
            </button>

            {/* Manual Refresh Button */}
            <button
              onClick={() => fetchBusArrivals(busStopCode, true)}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs transition shadow shadow-emerald-950/50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 flex flex-col gap-6">
        {/* Bus Stop Selector Card */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <label htmlFor="bus-stop-input" className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 mb-1">
                <MapPin className="w-3.5 h-3.5" />
                Bus Stop Code
              </label>
              <p className="text-xs text-slate-400">
                Enter any 5-digit Singapore bus stop code (defaults to 04121)
              </p>
            </div>

            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 max-w-md w-full">
              <div className="relative flex-1">
                <input
                  id="bus-stop-input"
                  type="text"
                  maxLength={6}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="e.g. 04121"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono placeholder-slate-500 outline-none transition"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm border border-slate-700 transition flex items-center gap-1.5 shrink-0"
              >
                <Search className="w-4 h-4 text-emerald-400" />
                <span>Go</span>
              </button>
            </form>
          </div>

          {/* Quick presets */}
          <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">Popular:</span>
            {PRESET_BUS_STOPS.map((stop) => (
              <button
                key={stop.code}
                onClick={() => handleSelectPreset(stop.code)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                  busStopCode === stop.code
                    ? 'bg-emerald-950/70 border-emerald-600 text-emerald-300 font-medium'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <span className="font-mono font-semibold">{stop.code}</span>
                <span className="ml-1 opacity-75 hidden md:inline">
                  • {stop.name.split('(')[0].trim()}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Live Panel Header & Refresh Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>Bus Stop</span>
              <span className="font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-lg">
                {busStopCode}
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Next refresh in:</span>
              <span className="font-mono font-bold text-emerald-400 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded">
                {countdown}s
              </span>
            </div>
            {lastUpdated && (
              <span className="text-slate-500 hidden sm:inline">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* Error Notification Banner */}
        {error && (
          <div className="bg-red-950/60 border border-red-800/80 rounded-2xl p-4 text-red-200 flex items-start gap-3 shadow-lg">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-red-300">Arrival Data Unavailable</p>
              <p className="mt-1 text-red-200/90">{error}</p>
              {error.includes('LTA_ACCOUNT_KEY is not set') && (
                <div className="mt-3 p-3 bg-red-900/40 rounded-xl border border-red-800 text-xs text-red-200">
                  <p className="font-medium text-white mb-1">Configuration Needed:</p>
                  <p>
                    Set the <code className="bg-black/50 px-1.5 py-0.5 rounded font-mono text-amber-300">LTA_ACCOUNT_KEY</code> environment variable in your project secrets (AI Studio) or in Vercel environment variables, then redeploy.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live Arrival Panel Display */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 animate-pulse flex flex-col gap-4"
              >
                <div className="flex items-center justify-between">
                  <div className="w-16 h-8 bg-slate-800 rounded-lg"></div>
                  <div className="w-20 h-5 bg-slate-800 rounded"></div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="h-14 bg-slate-800/60 rounded-xl"></div>
                  <div className="h-14 bg-slate-800/60 rounded-xl"></div>
                </div>
              </div>
            ))}
          </div>
        ) : servicesList.length === 0 && !error ? (
          /* Plain sentence when no buses running at the stop */
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
              <Bus className="w-6 h-6" />
            </div>
            <p className="text-base font-medium text-slate-300">
              No buses currently running at this bus stop.
            </p>
            <p className="text-xs text-slate-500 max-w-md">
              The Land Transport Authority reports no active scheduled services operating for stop {busStopCode} at this time.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {servicesList.map((service) => {
                const arrivals = service.arrivals || [];
                const hasBusesRunning = arrivals.length > 0;

                return (
                  <motion.div
                    key={service.ServiceNo}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-colors"
                  >
                    <div>
                      {/* Header with Bus Service No */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center min-w-14 px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-mono font-bold text-xl tracking-tight shadow">
                            {service.ServiceNo}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                          <Bus className="w-3.5 h-3.5 text-slate-500" />
                          Service {service.ServiceNo}
                        </span>
                      </div>

                      {/* Arrivals Display */}
                      {hasBusesRunning ? (
                        <div className="grid grid-cols-2 gap-3">
                          {/* Next Bus 1 */}
                          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col">
                            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                              Next Bus
                            </span>
                            <div className="flex items-baseline gap-1">
                              {arrivals[0] < 1 ? (
                                <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold text-lg animate-pulse">
                                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                  Arriving
                                </span>
                              ) : (
                                <>
                                  <span className="font-mono text-2xl font-bold text-white">
                                    {arrivals[0]}
                                  </span>
                                  <span className="text-xs text-slate-400 font-medium">min</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Subsequent Bus 2 */}
                          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col">
                            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                              Following Bus
                            </span>
                            <div className="flex items-baseline gap-1">
                              {arrivals.length > 1 ? (
                                arrivals[1] < 1 ? (
                                  <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold text-lg">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                    Arriving
                                  </span>
                                ) : (
                                  <>
                                    <span className="font-mono text-2xl font-bold text-slate-200">
                                      {arrivals[1]}
                                    </span>
                                    <span className="text-xs text-slate-400 font-medium">min</span>
                                  </>
                                )
                              ) : (
                                <span className="text-xs text-slate-500 italic py-1.5">
                                  No 2nd bus
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Plain sentence when a service has no buses running */
                        <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-4 text-center my-1">
                          <p className="text-xs text-slate-400 italic">
                            No buses currently running for Service {service.ServiceNo}.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Service footer metadata */}
                    <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                      <span>LTA DataMall v3</span>
                      <span>Next 2 buses</span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Health Check Modal */}
      {showHealthModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base text-white">System Service Health</h3>
              </div>
              <button
                onClick={() => setShowHealthModal(false)}
                className="text-slate-400 hover:text-white text-sm px-2 py-1 rounded"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Endpoint:</span>
                <code className="text-emerald-400 font-mono">/api/health</code>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">LTA Account Key Status:</span>
                <span
                  className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                    health?.keyConfigured
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-red-950 text-red-400 border border-red-800'
                  }`}
                >
                  {health?.keyConfigured ? 'Configured' : 'Not Set'}
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Upstream LTA Answered:</span>
                <span
                  className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                    health?.ltaAnswered
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-amber-950 text-amber-400 border border-amber-800'
                  }`}
                >
                  {health?.ltaAnswered ? 'Yes (200 OK)' : 'No / Pending'}
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Upstream HTTP Status Code:</span>
                <span className="font-mono text-slate-200">
                  {health?.upstreamStatus ?? 'N/A'}
                </span>
              </div>

              {health?.message && (
                <div className="p-3 bg-slate-800/60 rounded-xl text-slate-300">
                  <span className="text-slate-400 block mb-0.5 font-medium">Message:</span>
                  {health.message}
                </div>
              )}

              {health?.error && (
                <div className="p-3 bg-red-950/40 border border-red-900/60 rounded-xl text-red-300">
                  <span className="text-red-400 block mb-0.5 font-medium">Details:</span>
                  {health.error}
                </div>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowHealthModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer with Mandatory Singapore Open Data Licence Line & Working Link */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 px-4 mt-auto">
        <div className="max-w-5xl mx-auto text-xs text-slate-400 leading-relaxed space-y-2">
          <p>
            Contains information from LTA DataMall Bus Arrival accessed on {accessDate} from the Land
            Transport Authority (LTA DataMall), which is made available under the terms of the
            Singapore Open Data Licence version 1.0{' '}
            <a
              href="https://data.gov.sg/open-data-licence"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 underline inline-flex items-center gap-0.5 transition"
            >
              https://data.gov.sg/open-data-licence
              <ExternalLink className="w-3 h-3 inline ml-0.5" />
            </a>
            . This is an SMU course project and is not affiliated with or endorsed by the Land Transport
            Authority.
          </p>
        </div>
      </footer>
    </div>
  );
}
