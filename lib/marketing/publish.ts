/**
 * Stage 5 — Meta Graph API auto-publishing.
 *
 *   Facebook Page   → POST /{page-id}/videos  (public video URL + description)
 *   Instagram Reels → POST /{ig-user-id}/media (REELS_SHARE, async container)
 *                     → poll /{container-id}?fields=status_code until FINISHED
 *                     → POST /{ig-user-id}/media_publish
 *
 * Requires a Page-scoped access token with page_management + instagram_basic /
 * instagram_content_publish, plus the IG professional account linked to the
 * page. Secrets come from app_secrets / env (see lib/marketing/secrets.ts).
 */
import { copyToCaption } from "@/lib/marketing/copy";
import { META_GRAPH_BASE } from "@/lib/marketing/meta-graph";
import type { AdCopy } from "@/lib/marketing/types";

const GRAPH = META_GRAPH_BASE;

export interface PublishSecrets {
  metaPageToken: string;
  fbPageId: string;
  igUserId: string;
}

export interface PublishResult {
  fbPostId?: string;
  igMediaId?: string;
  fbPhotoIds?: string[];
  igImageIds?: string[];
}

interface GraphError {
  error?: { message?: string; type?: string; code?: number };
}

// Exported for the ads engine (lib/marketing/ads-engine.ts) — same Graph
// client, no duplication. Behaviour unchanged for the reel pipeline.
export async function graphPost<T>(
  path: string,
  params: Record<string, string>,
  token: string,
): Promise<T> {
  const url = new URL(`${GRAPH}/${path}`);
  const body = new URLSearchParams({ access_token: token, ...params });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = (await res.json()) as T & GraphError;
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Graph API HTTP ${res.status}`);
  }
  return json;
}

export async function graphGet<T>(path: string, token: string): Promise<T> {
  const url = new URL(`${GRAPH}/${path}`);
  url.searchParams.set("access_token", token);
  const res = await fetch(url);
  const json = (await res.json()) as T & GraphError;
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Graph API HTTP ${res.status}`);
  }
  return json;
}

interface IdReply {
  id?: string;
}

/** Publish the reel video to the Facebook Page (public URL). */
export async function publishFacebookVideo(
  videoUrl: string,
  caption: string,
  s: PublishSecrets,
): Promise<string> {
  const reply = await graphPost<IdReply>(
    `${s.fbPageId}/videos`,
    {
      file_url: videoUrl,
      description: caption,
    },
    s.metaPageToken,
  );
  if (!reply.id) throw new Error("Facebook publish returned no id");
  return reply.id;
}

/** Publish one still image to the Facebook Page. */
export async function publishFacebookPhoto(
  imageUrl: string,
  caption: string,
  s: PublishSecrets,
): Promise<string> {
  const reply = await graphPost<IdReply>(
    `${s.fbPageId}/photos`,
    {
      url: imageUrl,
      caption,
      published: "true",
    },
    s.metaPageToken,
  );
  if (!reply.id) throw new Error("Facebook photo publish returned no id");
  return reply.id;
}

interface ContainerReply {
  id?: string;
}

interface ContainerStatus {
  status_code?: string;
  status?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Publish an Instagram Reel: create an async container, poll until Meta
 * finishes processing (IN_PROGRESS → FINISHED), then publish.
 */
export async function publishInstagramReel(
  videoUrl: string,
  caption: string,
  s: PublishSecrets,
  poll = { intervalMs: 5_000, maxAttempts: 36 }, // up to ~3 min
): Promise<string> {
  const container = await graphPost<ContainerReply>(
    `${s.igUserId}/media`,
    {
      media_type: "REELS",
      video_url: videoUrl,
      caption,
      share_to_feed: "true",
    },
    s.metaPageToken,
  );
  if (!container.id) throw new Error("Instagram container creation returned no id");

  for (let attempt = 1; attempt <= poll.maxAttempts; attempt++) {
    const status = await graphGet<ContainerStatus>(`${container.id}?fields=status_code`, s.metaPageToken);
    if (status.status_code === "FINISHED") {
      const publish = await graphPost<IdReply>(
        `${s.igUserId}/media_publish`,
        { creation_id: container.id },
        s.metaPageToken,
      );
      if (!publish.id) throw new Error("Instagram media_publish returned no id");
      return publish.id;
    }
    if (status.status_code === "ERROR") {
      throw new Error(`Instagram container ${container.id} failed processing`);
    }
    await sleep(poll.intervalMs);
  }
  throw new Error("Instagram container processing timed out");
}

/**
 * Publish one still image to Instagram.
 * Image containers usually process in seconds but media_publish immediately
 * after creation races Meta's pipeline ("media not ready"). Poll status_code
 * like the reel path — images finish fast, so the budget is short.
 */
export async function publishInstagramImage(
  imageUrl: string,
  caption: string,
  s: PublishSecrets,
  poll = { intervalMs: 2_000, maxAttempts: 15 }, // up to ~30 s
): Promise<string> {
  const container = await graphPost<ContainerReply>(
    `${s.igUserId}/media`,
    {
      media_type: "IMAGE",
      image_url: imageUrl,
      caption,
    },
    s.metaPageToken,
  );
  if (!container.id) throw new Error("Instagram image container returned no id");

  for (let attempt = 1; attempt <= poll.maxAttempts; attempt++) {
    const status = await graphGet<ContainerStatus>(`${container.id}?fields=status_code`, s.metaPageToken);
    if (status.status_code === "FINISHED") {
      const publish = await graphPost<IdReply>(
        `${s.igUserId}/media_publish`,
        { creation_id: container.id },
        s.metaPageToken,
      );
      if (!publish.id) throw new Error("Instagram image publish returned no id");
      return publish.id;
    }
    if (status.status_code === "ERROR") {
      throw new Error(`Instagram image container ${container.id} failed processing`);
    }
    await sleep(poll.intervalMs);
  }
  throw new Error("Instagram image container processing timed out");
}

/** Publish to both platforms (FB first — IG depends on the same video URL). */
export async function publishReel(
  videoUrl: string,
  copy: AdCopy,
  s: PublishSecrets,
  imageUrls: string[] = [],
): Promise<PublishResult> {
  const caption = copyToCaption(copy);
  const result: PublishResult = { fbPhotoIds: [], igImageIds: [] };
  // FB failure should not block IG (or vice versa) — record both outcomes.
  try {
    result.fbPostId = await publishFacebookVideo(videoUrl, caption, s);
  } catch (err) {
    console.warn("[marketing] Facebook publish failed:", (err as Error).message);
  }
  try {
    result.igMediaId = await publishInstagramReel(videoUrl, caption, s);
  } catch (err) {
    console.warn("[marketing] Instagram publish failed:", (err as Error).message);
  }
  for (const imageUrl of imageUrls.slice(0, 4)) {
    try {
      result.fbPhotoIds!.push(await publishFacebookPhoto(imageUrl, caption, s));
    } catch (err) {
      console.warn("[marketing] Facebook photo publish failed:", (err as Error).message);
    }
    try {
      result.igImageIds!.push(await publishInstagramImage(imageUrl, caption, s));
    } catch (err) {
      console.warn("[marketing] Instagram image publish failed:", (err as Error).message);
    }
  }
  if (
    !result.fbPostId &&
    !result.igMediaId &&
    result.fbPhotoIds!.length === 0 &&
    result.igImageIds!.length === 0
  ) {
    throw new Error("Facebook and Instagram publishing failed");
  }
  return result;
}
