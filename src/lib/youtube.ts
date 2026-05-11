import { AppError } from "@/lib/errors";

type YouTubeItem = {
  id: {
    videoId: string;
  };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails?: {
      medium?: {
        url: string;
      };
      high?: {
        url: string;
      };
    };
  };
};

type YouTubeSearchResponse = {
  items: YouTubeItem[];
};

export type YouTubeVideo = {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  url: string;
};

export async function getYouTubeVideos(query: string): Promise<YouTubeVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return [];
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", "3");
  url.searchParams.set("q", `${query} travel`);
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    const body = await response.text();
    throw new AppError(
      `YouTube request failed (${response.status}). ${body}`.trim(),
      response.status
    );
  }

  const data = (await response.json()) as YouTubeSearchResponse;
  return (data.items ?? []).map((item) => {
    const thumbnail =
      item.snippet.thumbnails?.high?.url ??
      item.snippet.thumbnails?.medium?.url ??
      "";

    return {
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnail,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    };
  });
}
