import "server-only";
import { META_GRAPH_BASE } from "@/lib/marketing/meta-graph";
import { loadPipelineSecrets, resolveMetaPageToken } from "@/lib/marketing/secrets";

const GRAPH = META_GRAPH_BASE;
const REQUIRED_FACEBOOK_PERMISSION = "pages_manage_posts";
const INSTAGRAM_PUBLISH_PERMISSIONS = ["instagram_content_publish", "instagram_business_content_publish"] as const;

interface PermissionsReply {
  data?: { permission?: string; status?: string }[];
  error?: { message?: string };
}

interface AccountReply {
  data?: {
    id?: string;
    name?: string;
    access_token?: string;
    instagram_business_account?: { id?: string };
  }[];
  error?: { message?: string };
}

export interface MetaDiagnostics {
  configured: boolean;
  missingConfig: string[];
  pageTokenResolved: boolean;
  connectedPage?: string;
  connectedInstagramId?: string;
  grantedPermissions: string[];
  missingPublishPermissions: string[];
}

export async function getMetaDiagnostics(): Promise<MetaDiagnostics> {
  const secrets = await loadPipelineSecrets();
  const missingConfig = [
    !secrets.metaPageToken && "meta_page_access_token",
    !secrets.fbPageId && "meta_fb_page_id",
    !secrets.igUserId && "meta_ig_user_id",
  ].filter(Boolean) as string[];

  if (missingConfig.length > 0 || !secrets.metaPageToken) {
    return {
      configured: false,
      missingConfig,
      pageTokenResolved: false,
      grantedPermissions: [],
      missingPublishPermissions: [REQUIRED_FACEBOOK_PERMISSION, "instagram_content_publish"],
    };
  }

  const pageToken = await resolveMetaPageToken(secrets);
  const [permissions, accounts] = await Promise.all([
    readPermissions(secrets.metaPageToken),
    readAccounts(secrets.metaPageToken),
  ]);
  const granted = permissions
    .filter((p) => p.permission && p.status === "granted")
    .map((p) => p.permission!);
  const page = accounts.find((p) => p.id === secrets.fbPageId) ?? accounts[0];
  const missingPublishPermissions = [
    !granted.includes(REQUIRED_FACEBOOK_PERMISSION) && REQUIRED_FACEBOOK_PERMISSION,
    !INSTAGRAM_PUBLISH_PERMISSIONS.some((p) => granted.includes(p)) &&
      "instagram_content_publish or instagram_business_content_publish",
  ].filter(Boolean) as string[];

  return {
    configured: missingConfig.length === 0,
    missingConfig,
    pageTokenResolved: Boolean(pageToken && pageToken !== secrets.metaPageToken),
    connectedPage: page?.name,
    connectedInstagramId: page?.instagram_business_account?.id ?? secrets.igUserId,
    grantedPermissions: granted,
    missingPublishPermissions,
  };
}

async function readPermissions(token: string): Promise<NonNullable<PermissionsReply["data"]>> {
  const url = new URL(`${GRAPH}/me/permissions`);
  url.searchParams.set("access_token", token);
  const res = await fetch(url);
  const json = (await res.json()) as PermissionsReply;
  if (!res.ok || json.error) return [];
  return json.data ?? [];
}

async function readAccounts(token: string): Promise<NonNullable<AccountReply["data"]>> {
  const url = new URL(`${GRAPH}/me/accounts`);
  url.searchParams.set("fields", "id,name,access_token,instagram_business_account");
  url.searchParams.set("access_token", token);
  const res = await fetch(url);
  const json = (await res.json()) as AccountReply;
  if (!res.ok || json.error) return [];
  return json.data ?? [];
}
