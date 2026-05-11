import { NextResponse } from "next/server";
import connectMongo from "@/lib/mongodb";
import { AppError } from "@/lib/errors";
import WeatherSearch from "@/models/WeatherSearch";
import {
  formatLocation,
  geocodeByName,
  getWeatherBundle,
  reverseGeocode,
} from "@/lib/openweather";
import { getYouTubeVideos } from "@/lib/youtube";
import { normalizeDateRange, parseCoordinate } from "@/lib/validation";

export const dynamic = "force-dynamic";

type WeatherRequestBody = {
  location?: string;
  lat?: number;
  lon?: number;
  startDate?: string;
  endDate?: string;
  units?: "metric" | "imperial";
  notes?: string;
};

function handleError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "Unexpected error.";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET() {
  try {
    await connectMongo();
    const records = await WeatherSearch.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json({ data: records });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as WeatherRequestBody;
    const locationInput = body.location?.trim();
    const lat = parseCoordinate(body.lat);
    const lon = parseCoordinate(body.lon);
    const units = body.units === "imperial" ? "imperial" : "metric";

    if (!locationInput && (lat === null || lon === null)) {
      throw new AppError("Location or coordinates are required.", 400);
    }

    const { startDate, endDate } = normalizeDateRange(
      body.startDate,
      body.endDate
    );

    const geocodeResult =
      lat !== null && lon !== null
        ? await reverseGeocode(lat, lon)
        : await geocodeByName(locationInput ?? "");

    const locationName = formatLocation(geocodeResult);
    const resolvedLat = geocodeResult.lat;
    const resolvedLon = geocodeResult.lon;

    const weatherBundle = await getWeatherBundle({
      lat: resolvedLat,
      lon: resolvedLon,
      units,
      startDate,
      endDate,
    });

    const videos = await getYouTubeVideos(locationName);

    await connectMongo();
    const record = await WeatherSearch.create({
      locationInput: locationInput ?? `${resolvedLat},${resolvedLon}`,
      locationName,
      country: geocodeResult.country,
      lat: resolvedLat,
      lon: resolvedLon,
      startDate,
      endDate,
      units,
      current: weatherBundle.current,
      forecast: weatherBundle.forecast,
      rangeSummary: weatherBundle.rangeSummary,
      youtube: videos,
      notes: body.notes ?? "",
    });

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
