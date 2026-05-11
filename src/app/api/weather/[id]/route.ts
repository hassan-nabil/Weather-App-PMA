import { NextResponse } from "next/server";
import { Types } from "mongoose";
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

type RouteContext = {
  params: { id: string } | Promise<{ id: string }>;
};

type WeatherUpdateBody = {
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

async function resolveId(context: RouteContext) {
  const { id } = await context.params;
  return decodeURIComponent(id);
}

export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    const id = await resolveId(context);
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid record id.", 400);
    }

    await connectMongo();
    const record = await WeatherSearch.findById(id).lean();
    if (!record) {
      throw new AppError("Record not found.", 404);
    }
    return NextResponse.json({ data: record });
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(
  request: Request,
  context: RouteContext
) {
  try {
    const id = await resolveId(context);
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid record id.", 400);
    }

    const body = (await request.json()) as WeatherUpdateBody;

    await connectMongo();
    const record = await WeatherSearch.findById(id);
    if (!record) {
      throw new AppError("Record not found.", 404);
    }

    const units =
      body.units === "imperial"
        ? "imperial"
        : record.units ?? "metric";
    const updatedLocationInput = body.location?.trim();
    const latInput = parseCoordinate(body.lat);
    const lonInput = parseCoordinate(body.lon);

    const hasCoordinateUpdate = latInput !== null && lonInput !== null;
    const hasLocationUpdate = Boolean(updatedLocationInput);

    const geocodeResult = hasCoordinateUpdate
      ? await reverseGeocode(latInput as number, lonInput as number)
      : hasLocationUpdate
        ? await geocodeByName(updatedLocationInput ?? "")
        : {
            name: record.locationName,
            country: record.country,
            lat: record.lat,
            lon: record.lon,
          };

    const locationName = hasCoordinateUpdate || hasLocationUpdate
      ? formatLocation(geocodeResult)
      : record.locationName;

    const { startDate, endDate } = normalizeDateRange(
      body.startDate ?? record.startDate.toISOString(),
      body.endDate ?? record.endDate.toISOString()
    );

    const weatherBundle = await getWeatherBundle({
      lat: geocodeResult.lat,
      lon: geocodeResult.lon,
      units,
      startDate,
      endDate,
    });

    const videos = await getYouTubeVideos(locationName);

    record.locationInput =
      updatedLocationInput ?? record.locationInput ?? locationName;
    record.locationName = locationName;
    record.country = geocodeResult.country ?? record.country;
    record.lat = geocodeResult.lat;
    record.lon = geocodeResult.lon;
    record.startDate = startDate;
    record.endDate = endDate;
    record.units = units;
    record.current = weatherBundle.current;
    record.forecast = weatherBundle.forecast;
    record.rangeSummary = weatherBundle.rangeSummary;
    record.youtube = videos;

    if (typeof body.notes === "string") {
      record.notes = body.notes;
    }

    await record.save();

    return NextResponse.json({ data: record });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext
) {
  try {
    const id = await resolveId(context);
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid record id.", 400);
    }

    await connectMongo();
    const record = await WeatherSearch.findByIdAndDelete(id).lean();
    if (!record) {
      throw new AppError("Record not found.", 404);
    }

    return NextResponse.json({ data: record });
  } catch (error) {
    return handleError(error);
  }
}
