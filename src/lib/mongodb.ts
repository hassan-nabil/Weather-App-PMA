import mongoose from "mongoose";

const { MONGODB_URI } = process.env;

if (!MONGODB_URI) {
	throw new Error("MONGODB_URI is not set in the environment.");
}

const mongoUri = MONGODB_URI as string;

type MongooseCache = {
	conn: typeof mongoose | null;
	promise: Promise<typeof mongoose> | null;
};

const globalCache = globalThis as typeof globalThis & {
	mongoose?: MongooseCache;
};

const cached = globalCache.mongoose ?? { conn: null, promise: null };

globalCache.mongoose = cached;

export default async function connectMongo() {
	if (cached.conn) {
		return cached.conn;
	}

	if (!cached.promise) {
		cached.promise = mongoose
			.connect(mongoUri, {
				dbName: "weather_app_pma",
			})
			.then((mongooseInstance) => mongooseInstance);
	}

	cached.conn = await cached.promise;
	return cached.conn;
}
