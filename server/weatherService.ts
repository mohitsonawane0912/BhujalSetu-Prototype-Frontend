/**
 * External Weather Service for BhujalSetu AI Advisor
 *
 * Sourced from Open-Meteo API (WMO-compliant open weather forecast).
 * Does not require secret API keys, returns genuine precipitation forecasts,
 * caches responses for 15 minutes to avoid rate limits, and clearly reports
 * freshness, attribution, and error states.
 */

export interface WeatherForecast {
  status: 'available' | 'unconfigured' | 'error';
  source: string;
  location: string;
  latitude?: number;
  longitude?: number;
  forecastRainMm: number | null;
  maxProbabilityPercent: number | null;
  summary: string;
  freshness: string;
  fetchedAt: string;
  limitationNote?: string;
}

interface CacheEntry {
  forecast: WeatherForecast;
  expiresAt: number;
}

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const forecastCache = new Map<string, CacheEntry>();

let mockWeatherOverride: WeatherForecast | null = null;

export const WeatherService = {
  setMockForecast(mock: WeatherForecast | null): void {
    mockWeatherOverride = mock;
  },

  clearCache(): void {
    forecastCache.clear();
    mockWeatherOverride = null;
  },

  async getForecast(
    lat?: number | null,
    lon?: number | null,
    locationName: string = 'Configured Community Area'
  ): Promise<WeatherForecast> {
    if (mockWeatherOverride) {
      return mockWeatherOverride;
    }

    if (lat == null || lon == null || isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return {
        status: 'unconfigured',
        source: 'Open-Meteo Weather API',
        location: locationName,
        forecastRainMm: null,
        maxProbabilityPercent: null,
        summary: 'Location coordinates not configured for this community.',
        freshness: 'No coordinates available',
        fetchedAt: new Date().toISOString(),
        limitationNote:
          'Geographic latitude and longitude coordinates are not set in the community record. Weather forecast cannot be retrieved without valid coordinates.',
      };
    }

    const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    const cached = forecastCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      const ageMinutes = Math.max(0, Math.floor((now - new Date(cached.forecast.fetchedAt).getTime()) / 60000));
      return {
        ...cached.forecast,
        freshness: `Cached forecast from ${ageMinutes} minute${ageMinutes === 1 ? '' : 's'} ago`,
      };
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_sum,precipitation_probability_max,temperature_2m_max&timezone=auto&forecast_days=3`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4-second timeout

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Open-Meteo HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      const dailyRain = Array.isArray(data.daily?.precipitation_sum)
        ? data.daily.precipitation_sum
        : [0];
      const dailyProb = Array.isArray(data.daily?.precipitation_probability_max)
        ? data.daily.precipitation_probability_max
        : [0];

      // Sum next 3 days rain
      const totalRainMm = Math.round(dailyRain.reduce((acc: number, val: number) => acc + (Number(val) || 0), 0) * 10) / 10;
      const maxProb = Math.max(...dailyProb.map((p: any) => Number(p) || 0));

      let summary = '';
      if (totalRainMm >= 15 || maxProb >= 70) {
        summary = `Significant rain expected: ~${totalRainMm} mm forecasted over the next 72 hours (${maxProb}% precipitation probability). Prepare recharge structures.`;
      } else if (totalRainMm > 2 || maxProb >= 35) {
        summary = `Light to moderate scattered precipitation possible (~${totalRainMm} mm, ${maxProb}% chance).`;
      } else {
        summary = `Dry conditions expected over the next 72 hours (~${totalRainMm} mm rain, ${maxProb}% probability).`;
      }

      const forecast: WeatherForecast = {
        status: 'available',
        source: 'Open-Meteo Weather API (WMO-compliant forecast)',
        location: `${locationName} (${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E)`,
        latitude: lat,
        longitude: lon,
        forecastRainMm: totalRainMm,
        maxProbabilityPercent: maxProb,
        summary,
        freshness: `Freshly fetched at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        fetchedAt: new Date().toISOString(),
      };

      forecastCache.set(cacheKey, {
        forecast,
        expiresAt: now + CACHE_TTL_MS,
      });

      return forecast;
    } catch (err: any) {
      console.warn('[WeatherService] Failed to load forecast from Open-Meteo:', err.message);
      return {
        status: 'error',
        source: 'Open-Meteo Weather API',
        location: `${locationName} (${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E)`,
        latitude: lat,
        longitude: lon,
        forecastRainMm: null,
        maxProbabilityPercent: null,
        summary: 'Weather forecast temporarily unavailable from external provider.',
        freshness: 'API call failed / timed out',
        fetchedAt: new Date().toISOString(),
        limitationNote: `External weather API call failed (${err.name === 'AbortError' ? 'timed out after 4s' : err.message}). Advisory proceeds without forecast assumptions.`,
      };
    }
  },
};
