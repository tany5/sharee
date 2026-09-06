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
import type { AdCopy } from "@/lib/marketing/types";

const GRAPH = "https://graph.facebook.com/v21.0";

export interface PublishSecrets {
  metaPageToken: string;
  fbPageId: string;
  igUserId: string;
}

export interface PublishResult {
  fbPostId?: string;
  igMediaId?: string;
}

interface GraphError {
  error?: { message?: string; type?: string; code?: number };
}

async function graphPost<T>(
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

async function graphGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${GRAPH}/${path}?access_token=${encodeURIComponent(token)}`);
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

/** Publish to both platforms (FB first — IG depends on the same video URL). */
export async function publishReel(
  videoUrl: string,
  copy: AdCopy,
  s: PublishSecrets,
): Promise<PublishResult> {
  const caption = copyToCaption(copy);
  const result: PublishResult = {};
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
  if (!result.fbPostId && !result.igMediaId) {
    throw new Error("Both Facebook and Instagram publishing failed");
  }
  return result;
}
