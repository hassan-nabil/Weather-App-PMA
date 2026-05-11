import { NextResponse } from "next/server";
import connectMongo from "@/lib/mongodb";
import { AppError } from "@/lib/errors";
import WeatherSearch from "@/models/WeatherSearch";

export const dynamic = "force-dynamic";

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
    const body = JSON.stringify({ data: records }, null, 2);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": "attachment; filename=weather-export.json",
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
