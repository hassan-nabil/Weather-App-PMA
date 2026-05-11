"use client";

import { useMemo, useState, type FormEvent } from "react";
import Image from "next/image";

type ForecastDay = {
  date: string;
  minTemp: number;
  maxTemp: number;
  avgTemp: number;
  description: string;
  icon: string;
};

type RangeSummary = {
  minTemp: number;
  maxTemp: number;
  avgTemp: number;
  entries: number;
};

type YouTubeVideo = {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  url: string;
};

type WeatherRecord = {
  _id: string;
  locationInput: string;
  locationName: string;
  country?: string;
  lat: number;
  lon: number;
  startDate: string;
  endDate: string;
  units: "metric" | "imperial";
  current: {
    temp: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    description: string;
    icon: string;
    timestamp: string;
  };
  forecast: ForecastDay[];
  rangeSummary?: RangeSummary | null;
  youtube?: YouTubeVideo[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

type ApiRecordResponse = {
  data: WeatherRecord;
  error?: string;
};

function normalizeRecordId(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object") {
    const maybeOid = (value as { $oid?: unknown }).$oid;
    if (typeof maybeOid === "string") {
      return maybeOid;
    }

    if ("toString" in value && typeof (value as { toString: () => string }).toString === "function") {
      const serialized = (value as { toString: () => string }).toString();
      if (serialized && serialized !== "[object Object]") {
        return serialized;
      }
    }
  }

  return null;
}

function normalizeRecord(record: WeatherRecord): WeatherRecord {
  const normalizedId = normalizeRecordId((record as { _id: unknown })._id);
  return {
    ...record,
    _id: normalizedId ?? "",
  };
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(dateString: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateString)
    ? (() => {
        const [year, month, day] = dateString.split("-").map(Number);
        return new Date(year, month - 1, day);
      })()
    : new Date(dateString);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTemp(value: number, units: "metric" | "imperial") {
  const unitLabel = units === "metric" ? "C" : "F";
  return `${value.toFixed(1)}${unitLabel}`;
}

function formatCoordinate(value: number) {
  return value.toFixed(4);
}

export default function WeatherApp({
  initialRecords = [],
}: {
  initialRecords?: WeatherRecord[];
}) {
  const today = useMemo(() => new Date(), []);
  const normalizedInitialRecords = useMemo(
    () => initialRecords.map(normalizeRecord).filter((record) => Boolean(record._id)),
    [initialRecords]
  );
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState(toDateInputValue(today));
  const [endDate, setEndDate] = useState(toDateInputValue(today));
  const [records, setRecords] = useState<WeatherRecord[]>(() => normalizedInitialRecords);
  const [selected, setSelected] = useState<WeatherRecord | null>(
    () => normalizedInitialRecords[0] ?? null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (payload: {
    location?: string;
    lat?: number;
    lon?: number;
  }) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          startDate,
          endDate,
          units: "metric",
        }),
      });

      const data = (await response.json()) as ApiRecordResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to fetch weather.");
      }

      const normalized = normalizeRecord(data.data);
      if (!normalized._id) {
        throw new Error("Received invalid record id from server.");
      }

      setRecords((prev) => [normalized, ...prev]);
      setSelected(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to fetch weather.");
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSearch = async (event: FormEvent) => {
    event.preventDefault();
    if (!location.trim()) {
      setError("Please enter a city, zip, landmark, or coordinates.");
      return;
    }
    const trimmed = location.trim();
    const coordMatch = trimmed.match(
      /^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/
    );

    if (coordMatch) {
      await handleSearch({
        lat: Number(coordMatch[1]),
        lon: Number(coordMatch[2]),
      });
      return;
    }

    await handleSearch({ location: trimmed });
  };

  const handleGeolocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser.");
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await handleSearch({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
        setLoading(false);
      },
      (geoError) => {
        setLoading(false);
        setError(geoError.message || "Unable to fetch your location.");
      }
    );
  };

  const handleRefresh = async () => {
    if (!selected) {
      setError("Select a record to update.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const selectedId = normalizeRecordId(selected._id);
      if (!selectedId) {
        throw new Error("Invalid selected record id.");
      }

      const response = await fetch(`/api/weather/${encodeURIComponent(selectedId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate }),
      });
      const payload = (await response.json()) as ApiRecordResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update record.");
      }

      const normalized = normalizeRecord(payload.data);
      if (!normalized._id) {
        throw new Error("Received invalid record id from server.");
      }

      setRecords((prev) =>
        prev.map((item) => (item._id === normalized._id ? normalized : item))
      );
      setSelected(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update record.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const normalizedId = normalizeRecordId(id);
      if (!normalizedId) {
        throw new Error("Invalid record id.");
      }

      const response = await fetch(`/api/weather/${encodeURIComponent(normalizedId)}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as ApiRecordResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to delete record.");
      }

      const nextRecords = records.filter((item) => item._id !== normalizedId);
      setRecords(nextRecords);
      if (selected?._id === normalizedId) {
        setSelected(nextRecords[0] ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete record.");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/weather/export");
      if (!response.ok) {
        throw new Error("Unable to export JSON.");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "weather-export.json";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to export JSON.");
    } finally {
      setLoading(false);
    }
  };

  const activeForecast = selected?.forecast ?? [];
  const youtubeVideos = selected?.youtube ?? [];
  const units = selected?.units ?? "metric";

  return (
    <div className="min-h-screen bg-atmosphere text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-10">
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3 text-sm uppercase tracking-[0.2em] text-slate-500">
            <span className="rounded-full border border-slate-300 px-3 py-1">Real-time Weather</span>
            <span className="rounded-full border border-slate-300 px-3 py-1">5-day Forecast</span>
            <span className="rounded-full border border-slate-300 px-3 py-1">MongoDB CRUD</span>
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Weather Atlas
            </h1>
            <p className="max-w-2xl text-base text-slate-600">
              Search by city, zip, or landmark, then explore conditions, a five-day
              outlook, and travel content. Save, refresh, and export the data as
              you explore.
            </p>
          </div>
        </header>

        <main className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="flex flex-col gap-6">
            <div className="surface animate-rise">
              <form onSubmit={handleLocationSearch} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Location
                  </label>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <input
                      className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                      placeholder="Boston, 90210, Golden Gate Bridge"
                      value={location}
                      onChange={(event) => setLocation(event.target.value)}
                    />
                    <button
                      type="button"
                      onClick={handleGeolocation}
                      disabled={loading}
                      className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Use my location
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Start date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      End date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    disabled={loading}
                  >
                    {loading ? "Working..." : "Get weather"}
                  </button>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={!selected || loading}
                    className="rounded-2xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Update selected
                  </button>
                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={loading}
                    className="rounded-2xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Export JSON
                  </button>
                </div>

                {error && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                  </div>
                )}
              </form>
            </div>

            <div className="surface animate-rise" style={{ animationDelay: "80ms" }}>
              {selected ? (
                <div className="flex flex-col gap-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Current conditions
                      </p>
                      <h2 className="text-2xl font-semibold">
                        {selected.locationName}
                      </h2>
                      <p className="text-sm text-slate-500">
                        {formatDate(selected.current.timestamp)} | Coordinates: {" "}
                        {formatCoordinate(selected.lat)}, {formatCoordinate(selected.lon)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {selected.current.icon ? (
                        <Image
                          src={`https://openweathermap.org/img/wn/${selected.current.icon}@2x.png`}
                          alt={selected.current.description}
                          width={64}
                          height={64}
                        />
                      ) : null}
                      <div>
                        <p className="text-3xl font-semibold">
                          {formatTemp(selected.current.temp, units)}
                        </p>
                        <p className="text-sm text-slate-500 capitalize">
                          Feels like {formatTemp(selected.current.feelsLike, units)} | {" "}
                          {selected.current.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Humidity</p>
                      <p className="mt-2 text-xl font-semibold">
                        {selected.current.humidity}%
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Wind</p>
                      <p className="mt-2 text-xl font-semibold">
                        {selected.current.windSpeed} m/s
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Date range</p>
                      <p className="mt-2 text-sm font-medium text-slate-600">
                        {formatDate(selected.startDate)} to {formatDate(selected.endDate)}
                      </p>
                    </div>
                  </div>

                  {selected.rangeSummary ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                      Range summary: {formatTemp(selected.rangeSummary.minTemp, units)} to {" "}
                      {formatTemp(selected.rangeSummary.maxTemp, units)} (avg {" "}
                      {formatTemp(selected.rangeSummary.avgTemp, units)}), based on {" "}
                      {selected.rangeSummary.entries} forecast points.
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                      Range summary will appear once the forecast matches your dates.
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Search for a location to see live weather data.
                </p>
              )}
            </div>

            <div className="surface animate-rise" style={{ animationDelay: "140ms" }}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">5-day forecast</p>
                  <h3 className="text-xl font-semibold">Daily outlook</h3>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {activeForecast.length === 0 ? (
                  <p className="text-sm text-slate-500">No forecast available yet.</p>
                ) : (
                  activeForecast.map((day) => (
                    <div
                      key={day.date}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    >
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        {formatDate(day.date)}
                      </p>
                      {day.icon ? (
                        <Image
                          src={`https://openweathermap.org/img/wn/${day.icon}@2x.png`}
                          alt={day.description}
                          width={48}
                          height={48}
                        />
                      ) : null}
                      <p className="text-base font-semibold">
                        {formatTemp(day.minTemp, units)} - {formatTemp(day.maxTemp, units)}
                      </p>
                      <p className="text-xs capitalize text-slate-500">
                        Avg {formatTemp(day.avgTemp, units)} | {day.description}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="surface animate-rise" style={{ animationDelay: "200ms" }}>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Location videos
              </p>
              <h3 className="text-xl font-semibold">Travel inspiration</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {youtubeVideos.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Add a YouTube API key to see videos for this location.
                  </p>
                ) : (
                  youtubeVideos.map((video) => (
                    <a
                      key={video.videoId}
                      href={video.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-3 transition hover:border-slate-400"
                    >
                      {video.thumbnail ? (
                        <Image
                          src={video.thumbnail}
                          alt={video.title}
                          width={160}
                          height={90}
                          className="rounded-xl"
                        />
                      ) : null}
                      <div>
                        <p className="text-sm font-semibold text-slate-900 group-hover:text-slate-700">
                          {video.title}
                        </p>
                        <p className="text-xs text-slate-500">{video.channelTitle}</p>
                      </div>
                    </a>
                  ))
                )}
              </div>
            </div>
          </section>

          <aside className="flex flex-col gap-6">
            <div className="surface animate-rise" style={{ animationDelay: "100ms" }}>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Saved searches
              </p>
              <h3 className="text-xl font-semibold">History</h3>
              <div className="mt-4 flex flex-col gap-3">
                {records.length === 0 ? (
                  <p className="text-sm text-slate-500">No saved records yet.</p>
                ) : (
                  records.map((record) => (
                    <div
                      key={record._id}
                      className={`rounded-2xl border p-3 transition ${
                        selected?._id === record._id
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white hover:border-slate-400"
                      }`}
                    >
                      <button
                        onClick={() => setSelected(record)}
                        className="text-left"
                      >
                        <p className="text-sm font-semibold">
                          {record.locationName}
                        </p>
                        <p className={`text-xs ${
                          selected?._id === record._id ? "text-slate-200" : "text-slate-500"
                        }`}
                        >
                          {formatDate(record.startDate)} to {formatDate(record.endDate)}
                        </p>
                      </button>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => setSelected(record)}
                          className={`text-xs font-semibold ${
                            selected?._id === record._id
                              ? "text-white"
                              : "text-slate-700"
                          }`}
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleDelete(record._id)}
                          className={`text-xs font-semibold ${
                            selected?._id === record._id
                              ? "text-rose-200"
                              : "text-rose-600"
                          }`}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="surface animate-rise" style={{ animationDelay: "160ms" }}>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Travel notes
              </p>
              <h3 className="text-xl font-semibold">Non-obvious things to check</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li>UV index and cloud cover can change quickly near water.</li>
                <li>Wind speed matters for bridges, ferries, and tall lookouts.</li>
                <li>Humidity can make mild temps feel much hotter.</li>
                <li>Check sunrise and sunset for driving and hiking plans.</li>
              </ul>
            </div>
          </aside>
        </main>

        <footer className="rounded-3xl border border-slate-200 bg-white px-6 py-6 text-sm text-slate-600">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Hassan Nabil
          </p>
          <p className="mt-2">
            The Product Manager Accelerator Program is designed to support PM
            professionals through every stage of their careers. From students
            looking for entry-level jobs to Directors looking to take on a
            leadership role, our program has helped hundreds of students fulfill
            their career aspirations. Headquarters: Boston, MA. Founded 2020.
          </p>
          <p className="mt-2">
            Learn more at <a className="underline" href="https://www.pmaccelerator.io/">pmaccelerator.io</a>
          </p>
        </footer>
      </div>
    </div>
  );
}
