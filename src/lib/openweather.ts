import { AppError } from "@/lib/errors";

const BASE_URL = "https://api.openweathermap.org";

export type GeocodeResult = {
  name: string;
  state?: string;
  country?: string;
  lat: number;
  lon: number;
};

export type CurrentWeather = {
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  description: string;
  icon: string;
  timestamp: string;
};

export type ForecastDay = {
  date: string;
  minTemp: number;
  maxTemp: number;
  avgTemp: number;
  description: string;
  icon: string;
};

export type RangeSummary = {
  minTemp: number;
  maxTemp: number;
  avgTemp: number;
  entries: number;
};

type ForecastListItem = {
  dt: number;
  main: {
    temp: number;
  };
  weather: Array<{
    description: string;
    icon: string;
  }>;
  dt_txt: string;
};

type ForecastResponse = {
  list: ForecastListItem[];
  city: {
    timezone: number;
  };
};

type CurrentWeatherResponse = {
  dt: number;
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
  };
  wind: {
    speed: number;
  };
  weather: Array<{
    description: string;
    icon: string;
  }>;
};

function requireApiKey() {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    throw new AppError("OpenWeather API key is missing.", 500);
  }
  return apiKey;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    const body = await response.text();
    throw new AppError(
      `OpenWeather request failed (${response.status}). ${body}`.trim(),
      response.status
    );
  }
  return response.json() as Promise<T>;
}

function toDateKeyFromUnix(unixSeconds: number, timezoneOffset: number) {
  const date = new Date((unixSeconds + timezoneOffset) * 1000);
  return toDateKeyFromDate(date);
}

function toDateKeyFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildLocationName(result: GeocodeResult) {
  const parts = [result.name, result.state, result.country].filter(Boolean);
  return parts.join(", ");
}

export async function geocodeByName(location: string) {
  const apiKey = requireApiKey();
  const url = `${BASE_URL}/geo/1.0/direct?q=${encodeURIComponent(
    location
  )}&limit=1&appid=${apiKey}`;
  const data = await fetchJson<GeocodeResult[]>(url);
  if (!Array.isArray(data) || data.length === 0) {
    throw new AppError("Location not found.", 404);
  }
  return data[0];
}

export async function reverseGeocode(lat: number, lon: number) {
  const apiKey = requireApiKey();
  const url = `${BASE_URL}/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${apiKey}`;
  const data = await fetchJson<GeocodeResult[]>(url);
  if (!Array.isArray(data) || data.length === 0) {
    throw new AppError("Location not found.", 404);
  }
  return data[0];
}

export async function getWeatherBundle({
  lat,
  lon,
  units,
  startDate,
  endDate,
}: {
  lat: number;
  lon: number;
  units: "metric" | "imperial";
  startDate: Date;
  endDate: Date;
}) {
  const apiKey = requireApiKey();
  const currentUrl = `${BASE_URL}/data/2.5/weather?lat=${lat}&lon=${lon}&units=${units}&appid=${apiKey}`;
  const forecastUrl = `${BASE_URL}/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${units}&appid=${apiKey}`;

  const [currentResponse, forecastResponse] = await Promise.all([
    fetchJson<CurrentWeatherResponse>(currentUrl),
    fetchJson<ForecastResponse>(forecastUrl),
  ]);

  const current: CurrentWeather = {
    temp: currentResponse.main.temp,
    feelsLike: currentResponse.main.feels_like,
    humidity: currentResponse.main.humidity,
    windSpeed: currentResponse.wind.speed,
    description: currentResponse.weather?.[0]?.description ?? "",
    icon: currentResponse.weather?.[0]?.icon ?? "",
    timestamp: new Date(currentResponse.dt * 1000).toISOString(),
  };

  const forecast = summarizeForecast(forecastResponse.list, forecastResponse.city.timezone);
  const rangeSummary = summarizeRange(
    forecastResponse.list,
    forecastResponse.city.timezone,
    startDate,
    endDate
  );

  return { current, forecast, rangeSummary };
}

function summarizeForecast(list: ForecastListItem[], timezoneOffset: number) {
  const dayMap = new Map<
    string,
    {
      min: number;
      max: number;
      sum: number;
      count: number;
      icon: string;
      description: string;
    }
  >();

  for (const entry of list) {
    const key = toDateKeyFromUnix(entry.dt, timezoneOffset);
    const temp = entry.main.temp;
    const existing = dayMap.get(key);

    const icon = entry.weather?.[0]?.icon ?? "";
    const description = entry.weather?.[0]?.description ?? "";

    if (!existing) {
      dayMap.set(key, {
        min: temp,
        max: temp,
        sum: temp,
        count: 1,
        icon,
        description,
      });
      continue;
    }

    existing.min = Math.min(existing.min, temp);
    existing.max = Math.max(existing.max, temp);
    existing.sum += temp;
    existing.count += 1;

    if (entry.dt_txt?.includes("12:00:00")) {
      existing.icon = icon;
      existing.description = description;
    }
  }

  const results: ForecastDay[] = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 5)
    .map(([date, data]) => ({
      date,
      minTemp: Number(data.min.toFixed(1)),
      maxTemp: Number(data.max.toFixed(1)),
      avgTemp: Number((data.sum / data.count).toFixed(1)),
      icon: data.icon,
      description: data.description,
    }));

  return results;
}

function summarizeRange(
  list: ForecastListItem[],
  timezoneOffset: number,
  startDate: Date,
  endDate: Date
) {
  const startKey = toDateKeyFromDate(startDate);
  const endKey = toDateKeyFromDate(endDate);

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let sum = 0;
  let count = 0;

  for (const entry of list) {
    const key = toDateKeyFromUnix(entry.dt, timezoneOffset);
    if (key < startKey || key > endKey) {
      continue;
    }

    const temp = entry.main.temp;
    min = Math.min(min, temp);
    max = Math.max(max, temp);
    sum += temp;
    count += 1;
  }

  if (count === 0) {
    return null;
  }

  const avg = sum / count;
  const summary: RangeSummary = {
    minTemp: Number(min.toFixed(1)),
    maxTemp: Number(max.toFixed(1)),
    avgTemp: Number(avg.toFixed(1)),
    entries: count,
  };

  return summary;
}

export function formatLocation(result: GeocodeResult) {
  return buildLocationName(result);
}
