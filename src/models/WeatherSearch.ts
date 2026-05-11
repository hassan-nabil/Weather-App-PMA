import mongoose, { Schema, type InferSchemaType } from "mongoose";

const WeatherSearchSchema = new Schema(
  {
    locationInput: { type: String, required: true },
    locationName: { type: String, required: true },
    country: { type: String },
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    units: { type: String, enum: ["metric", "imperial"], default: "metric" },
    current: {
      temp: { type: Number, required: true },
      feelsLike: { type: Number, required: true },
      humidity: { type: Number, required: true },
      windSpeed: { type: Number, required: true },
      description: { type: String, required: true },
      icon: { type: String, required: true },
      timestamp: { type: String, required: true },
    },
    forecast: [
      {
        date: { type: String, required: true },
        minTemp: { type: Number, required: true },
        maxTemp: { type: Number, required: true },
        avgTemp: { type: Number, required: true },
        description: { type: String, required: true },
        icon: { type: String, required: true },
      },
    ],
    rangeSummary: {
      minTemp: { type: Number },
      maxTemp: { type: Number },
      avgTemp: { type: Number },
      entries: { type: Number },
    },
    youtube: [
      {
        videoId: { type: String },
        title: { type: String },
        channelTitle: { type: String },
        thumbnail: { type: String },
        url: { type: String },
      },
    ],
    notes: { type: String },
  },
  { timestamps: true }
);

export type WeatherSearch = InferSchemaType<typeof WeatherSearchSchema>;

export default
  mongoose.models.WeatherSearch ||
  mongoose.model("WeatherSearch", WeatherSearchSchema);
