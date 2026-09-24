/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bus,
  RefreshCw,
  Clock,
  MapPin,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Activity,
  ChevronRight,
  Search,
} from 'lucide-react';

interface BusService {
  ServiceNo: string;
  minutes: number[];
  nextBuses?: number[];
}

interface HealthResponse {
  keyConfigured: boolean;
  ltaAnswered: boolean;
  upstreamStatus: number | null;
  upstreamStatusCode?: number | null;
  error?: string;
  status?: string;
}

// Preset popular bus stops with SMU as primary
const PRESET_STOPS = [
  { code: '04121', name: 'SMU (Stamford Rd)' },
  { code: '04139', name: 'SMU (Orchard Rd)' },
  { code: '08057', name: 'Chinatown Stn Exit E' },
  { code: '01012', name: 'Victoria St (Hotel Grand Pacific)' },
  { code: '03211', name: 'Raffles Hotel (Bras Basah)' },
];

export default function App() {
  const [busStopCode, setBusStopCode] = useState('04121');
  const [inputStopCode, setInputStopCode] = useState('04121');
  const [services, setServices] = useState<BusService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(20);
  const [demoMode, setDemoMode] = useState(false);

  // Health check state
  const [healthOpen, setHealthOpen] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch bus arrival data
  const fetchBusArrivals = useCallback(
    async (codeToFetch: string) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/bus?BusStopCode=${encodeURIComponent(codeToFetch)}`);

        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}));
          const errMsg =
            errJson.error ||
            `Error ${response.status}: ${response.statusText || 'Unable to fetch arrivals'}`;
          setError(errMsg);
          setServices([]);
          setLastUpdated(new Date());
          return;
        }

        const data = await response.json();
        // Accepts either direct array or { services: [...] }
        const list: BusService[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.services)
          ? data.services
          : Array.isArray(data?.Services)
          ? data.Services
          : [];

        // Sort numerically / alphabetically by ServiceNo
        list.sort((a, b) =>
          a.ServiceNo.localeCompare(b.ServiceNo, undefined, {
            numeric: true,
            sensitivity: 'base',
          })
        );

        setServices(list);
        setLastUpdated(new Date());
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Network error occurred while fetching bus timings.');
        setServices([]);
        setLastUpdated(new Date());
      } finally {
        setLoading(false);
        setCountdown(20);
      }
    },
    []
  );

  // Check API health endpoint
  const checkHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const response = await fetch('/api/health');
      const data = await response.json().catch(() => ({}));
      setHealthData(data);
    } catch (err: any) {
      setHealthData({
        keyConfigured: false,
        ltaAnswered: false,
        upstreamStatus: null,
        error: err.message || 'Health check request failed',
      });
    } finally {
      setHealthLoading(false);
    }
  }, []);

  // Main 20s interval fetch
  useEffect(() => {
    fetchBusArrivals(busStopCode);

    const interval = setInterval(() => {
      fetchBusArrivals(busStopCode);
    }, 20000);

    return () => clearInterval(interval);
  }, [busStopCode, fetchBusArrivals]);

  // Second-by-second countdown for the 20s refresh
  useEffect(() => {
    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 20));
    }, 1000);

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, []);

  const handleStopSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputStopCode.trim();
    if (clean) {
      setBusStopCode(clean);
      setCountdown(20);
    }
  };

  const selectPreset = (code: string) => {
    setInputStopCode(code);
    setBusStopCode(code);
    setCountdown(20);
  };

  // Formatter for arrival minutes
  // Under 1 minute shows "Arriving"
  const renderArrivalBadge = (minutes: number | undefined) => {
    if (typeof minutes !== 'number' || isNaN(minutes)) {
      return null;
    }

    if (minutes < 1) {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 text-sm font-semibold rounded-full bg-emerald-600 text-white animate-pulse shadow-sm">
          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
          Arriving
        </span>
      );
    }

    if (minutes === 1) {
      return (
        <span className="inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
          1 min
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full bg-slate-100 text-slate-800 border border-slate-200">
        {minutes} mins
      </span>
    );
  };

  // Formatted date for licence requirement
  const formattedDate = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const currentStopInfo = PRESET_STOPS.find((s) => s.code === busStopCode);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Header Bar */}
      <header className="bg-emerald-800 text-white shadow-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-700/80 rounded-lg">
              <Bus className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight">
                Live Bus Arrivals
              </h1>
              <p className="text-xs text-emerald-200/90 hidden sm:block">
                Singapore LTA DataMall Real-Time Feed
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setHealthOpen(true);
                checkHealth();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-900/60 hover:bg-emerald-900 text-emerald-100 rounded-lg border border-emerald-700/50 transition-colors cursor-pointer"
              title="Inspect API health status"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-300" />
              <span className="hidden sm:inline">Health Check</span>
            </button>

            <button
              onClick={() => fetchBusArrivals(busStopCode)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-emerald-900 hover:bg-emerald-50 rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-75 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`}
              />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Bus Stop Selector Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span>Selected Bus Stop</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {busStopCode}
                </span>
                {currentStopInfo && (
                  <span className="text-sm font-medium text-slate-600">
                    — {currentStopInfo.name}
                  </span>
                )}
              </div>
            </div>

            {/* Stop Code Form */}
            <form onSubmit={handleStopSubmit} className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-48">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={inputStopCode}
                  onChange={(e) => setInputStopCode(e.target.value)}
                  placeholder="e.g. 04121"
                  maxLength={6}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400"
                />
              </div>
              <button
                type="submit"
                className="px-3.5 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition-colors cursor-pointer"
              >
                Go
              </button>
            </form>
          </div>

          {/* Preset Buttons */}
          <div className="mt-3.5 pt-3.5 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-500 mr-1">Quick Select:</span>
            {PRESET_STOPS.map((stop) => (
              <button
                key={stop.code}
                onClick={() => selectPreset(stop.code)}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  busStopCode === stop.code
                    ? 'bg-emerald-100 text-emerald-800 font-semibold border border-emerald-300'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {stop.code} ({stop.name.split(' ')[0]})
              </button>
            ))}
          </div>
        </div>

        {/* Live Status & Auto-refresh Indicator */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-medium text-slate-700">
              Live updates every 20s
            </span>
            <span className="text-slate-400">•</span>
            <span>Refreshing in {countdown}s</span>
          </div>

          {lastUpdated && (
            <div className="flex items-center gap-1 text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              <span>
                Last updated at{' '}
                {lastUpdated.toLocaleTimeString('en-SG', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>
          )}
        </div>

        {/* Error Alert (e.g. 503 Missing Key) */}
        {error && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 sm:p-5 text-amber-900">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5 text-sm">
                <h3 className="font-semibold text-amber-950">Notice</h3>
                <p className="text-amber-800">{error}</p>
                {error.includes('LTA_ACCOUNT_KEY') && (
                  <p className="text-xs text-amber-700/90 pt-1">
                    To enable live data, configure the <code>LTA_ACCOUNT_KEY</code> in Vercel or your project environment.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Live Bus Arrival Panel */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-3.5 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span>Bus Services at Stop {busStopCode}</span>
              {services.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                  {services.length} {services.length === 1 ? 'service' : 'services'}
                </span>
              )}
            </h2>

            {loading && (
              <span className="text-xs text-slate-500 flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3 animate-spin text-emerald-600" />
                Updating...
              </span>
            )}
          </div>

          {/* Services List / Table */}
          {loading && services.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
              <p className="text-sm">Fetching arrival timings from LTA DataMall...</p>
            </div>
          ) : services.length === 0 ? (
            <div className="p-10 text-center text-slate-500 space-y-2">
              <Bus className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-base font-semibold text-slate-700">
                No buses running for this bus stop.
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No active bus services are currently scheduled or operating at bus stop code {busStopCode}.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {services.map((service) => {
                const arrivals = service.minutes || service.nextBuses || [];
                const hasBusesRunning = arrivals.length > 0;

                return (
                  <div
                    key={service.ServiceNo}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                  >
                    {/* Service Number Badge */}
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-12 bg-slate-900 text-white rounded-lg flex items-center justify-center font-extrabold text-xl tracking-tight shadow-sm">
                        {service.ServiceNo}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Service
                        </div>
                        <div className="text-sm font-medium text-slate-900">
                          Bus {service.ServiceNo}
                        </div>
                      </div>
                    </div>

                    {/* Next Arrivals */}
                    {hasBusesRunning ? (
                      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                        {/* Next Bus */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 font-medium">
                            Next:
                          </span>
                          {renderArrivalBadge(arrivals[0])}
                        </div>

                        {/* Subsequent Bus */}
                        {arrivals.length > 1 && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 font-medium">
                              Subsequent:
                            </span>
                            {renderArrivalBadge(arrivals[1])}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Plain sentence when a service has no buses running */
                      <div className="text-sm font-medium text-slate-500 italic">
                        No buses running at this time.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Health Check Modal */}
      {healthOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  API Health Diagnostics
                </h3>
              </div>
              <button
                onClick={() => setHealthOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Checking status of <code>/api/health</code>. Never exposes or prints secret credentials.
            </p>

            {healthLoading ? (
              <div className="py-8 text-center text-slate-500 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 mx-auto" />
                <p className="text-xs">Pinging /api/health...</p>
              </div>
            ) : healthData ? (
              <div className="space-y-3 bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-600">Key Configured (keyConfigured):</span>
                  {healthData.keyConfigured ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Yes
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
                      <XCircle className="w-3.5 h-3.5 text-rose-600" /> No
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-600">LTA Answered (ltaAnswered):</span>
                  {healthData.ltaAnswered ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Yes
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                      <XCircle className="w-3.5 h-3.5 text-amber-600" /> No
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-600">Upstream Status Code:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {healthData.upstreamStatus !== null && healthData.upstreamStatus !== undefined
                      ? healthData.upstreamStatus
                      : 'N/A'}
                  </span>
                </div>

                {healthData.error && (
                  <div className="pt-2 text-rose-600 border-t border-slate-200/60 font-medium">
                    {healthData.error}
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={checkHealth}
                disabled={healthLoading}
                className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Re-check
              </button>
              <button
                onClick={() => setHealthOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Licence Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <p className="text-xs text-slate-500 leading-relaxed">
            Contains information from LTA DataMall Bus Arrival accessed on {formattedDate} from the Land Transport Authority (LTA DataMall), which is made available under the terms of the Singapore Open Data Licence version 1.0{' '}
            <a
              href="https://data.gov.sg/open-data-licence"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-700 underline hover:text-emerald-900 transition-colors"
            >
              https://data.gov.sg/open-data-licence
            </a>
            . This is an SMU course project and is not affiliated with or endorsed by the Land Transport Authority.
          </p>
        </div>
      </footer>
    </div>
  );
}
