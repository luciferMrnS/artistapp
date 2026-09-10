export interface LiveStatus {
  configured: boolean;
  platform: "twitch" | "youtube" | null;
  live: boolean;
  title: string | null;
  viewerCount: number | null;
  embed: {
    type: "twitch" | "youtube";
    channel: string | null;
    videoId: string | null;
  } | null;
  error: string | null;
}

function notConfigured(platform: "twitch" | "youtube" | null): LiveStatus {
  return {
    configured: false,
    platform,
    live: false,
    title: null,
    viewerCount: null,
    embed: null,
    error: null,
  };
}

function failed(platform: "twitch" | "youtube", error: string): LiveStatus {
  return {
    configured: true,
    platform,
    live: false,
    title: null,
    viewerCount: null,
    embed: null,
    error,
  };
}

async function twitchStatus(): Promise<LiveStatus> {
  const clientId = process.env.LIVE_TWITCH_CLIENT_ID;
  const secret = process.env.LIVE_TWITCH_CLIENT_SECRET;
  const channel = process.env.LIVE_CHANNEL;
  if (!clientId || !secret || !channel) return notConfigured("twitch");

  try {
    const tokenRes = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${secret}&grant_type=client_credentials`,
      { method: "POST" }
    );
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    const accessToken = tokenJson.access_token;
    if (!accessToken) return failed("twitch", "Failed to get Twitch token");

    const res = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(channel)}`,
      { headers: { "Client-ID": clientId, Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return failed("twitch", `Twitch API error ${res.status}`);

    const json = (await res.json()) as {
      data?: Array<{ title: string; viewer_count: number }>;
    };
    const stream = json.data?.[0];
    return {
      configured: true,
      platform: "twitch",
      live: !!stream,
      title: stream?.title ?? null,
      viewerCount: stream?.viewer_count ?? null,
      embed: { type: "twitch", channel, videoId: null },
      error: null,
    };
  } catch (err) {
    return failed("twitch", err instanceof Error ? err.message : "Twitch error");
  }
}

async function youtubeStatus(): Promise<LiveStatus> {
  const apiKey = process.env.LIVE_YOUTUBE_API_KEY;
  const channelId = process.env.LIVE_YOUTUBE_CHANNEL_ID;
  if (!apiKey || !channelId) return notConfigured("youtube");

  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("channelId", channelId);
    url.searchParams.set("eventType", "live");
    url.searchParams.set("type", "video");
    url.searchParams.set("maxResults", "1");
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) return failed("youtube", `YouTube API error ${res.status}`);

    const json = (await res.json()) as {
      items?: Array<{
        id?: { videoId?: string };
        snippet?: { title?: string };
      }>;
    };
    const item = json.items?.[0];
    const videoId = item?.id?.videoId ?? null;
    return {
      configured: true,
      platform: "youtube",
      live: !!videoId,
      title: item?.snippet?.title ?? null,
      viewerCount: null,
      embed: { type: "youtube", channel: null, videoId },
      error: null,
    };
  } catch (err) {
    return failed("youtube", err instanceof Error ? err.message : "YouTube error");
  }
}

/**
 * Server-side live-status check for the Live Now page.
 * Configure via .env.local:
 *   LIVE_PLATFORM=twitch|youtube
 *   Twitch:  LIVE_CHANNEL, LIVE_TWITCH_CLIENT_ID, LIVE_TWITCH_CLIENT_SECRET
 *   YouTube: LIVE_YOUTUBE_CHANNEL_ID, LIVE_YOUTUBE_API_KEY
 */
export async function getLiveStatus(): Promise<LiveStatus> {
  const platform = process.env.LIVE_PLATFORM as "twitch" | "youtube" | undefined;
  if (platform === "twitch") return twitchStatus();
  if (platform === "youtube") return youtubeStatus();
  return notConfigured(null);
}