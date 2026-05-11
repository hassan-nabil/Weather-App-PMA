import WeatherApp from "@/components/WeatherApp";
import connectMongo from "@/lib/mongodb";
import WeatherSearch from "@/models/WeatherSearch";

export default async function Page() {
  await connectMongo();
  const records = await WeatherSearch.find().sort({ createdAt: -1 }).lean();
  const initialRecords = JSON.parse(JSON.stringify(records));

  return <WeatherApp initialRecords={initialRecords} />;
}
