import "server-only";
import path from "node:path";
import sharp from "sharp";
import { SITE } from "@/lib/site";
import { graphPost } from "@/lib/marketing/publish";
import { loadPipelineSecrets, resolveMetaPageToken } from "@/lib/marketing/secrets";
import { fetchImageBytes, uploadPipelineAsset } from "@/lib/marketing/storage";

interface IdReply {
  id?: string;
  success?: boolean;
}

export interface MetaProfileUpdateResult {
  ok: boolean;
  assets: {
    logoUrl?: string;
    facebookCoverUrl?: string;
  };
  facebook: {
    pageDetails: "updated" | "skipped" | "failed";
    coverPhoto: "updated" | "skipped" | "failed";
    profilePhoto: "updated" | "skipped" | "failed" | "manual";
  };
  instagram: {
    profile: "manual";
    note: string;
  };
  errors: string[];
  manualSteps: string[];
}

const FACEBOOK_ABOUT = `${SITE.name} sarees for real life. Every saree is ${SITE.price} INR with simple pricing, quality checked designs, easy returns and fast delivery across India. Order online at ${SITE.url}.`;
const FACEBOOK_DESCRIPTION =
  `TheTanti is a saree marketplace built for everyday Indian women: affordable, beautiful sarees, one clear price, and a smoother online shopping experience. Support: ${SITE.email} | ${SITE.phone}. Fulfilment: ${SITE.address}.`;

export async function updateMetaProfiles(): Promise<MetaProfileUpdateResult> {
  const secrets = await loadPipelineSecrets();
  const missing = [
    !secrets.metaPageToken && "meta_page_access_token",
    !secrets.fbPageId && "meta_fb_page_id",
    !secrets.igUserId && "meta_ig_user_id",
  ].filter(Boolean) as string[];

  if (missing.length > 0) {
    throw new Error(`Meta not configured (missing: ${missing.join(", ")})`);
  }

  const result: MetaProfileUpdateResult = {
    ok: false,
    assets: {},
    facebook: {
      pageDetails: "skipped",
      coverPhoto: "skipped",
      profilePhoto: "manual",
    },
    instagram: {
      profile: "manual",
      note:
        "Instagram Graph API supports publishing media, but profile picture/bio/banner updates are not exposed in this publishing flow. Update those manually in Instagram/Facebook account settings.",
    },
    errors: [],
    manualSteps: [],
  };

  const logo = await publishBrandLogo();
  const cover = await publishFacebookCover();
  result.assets.logoUrl = logo.url;
  result.assets.facebookCoverUrl = cover.url;

  const token = (await resolveMetaPageToken(secrets))!;
  const pageId = secrets.fbPageId!;

  await runStep(result, "Facebook page details", async () => {
    await graphPost<IdReply>(
      pageId,
      {
        about: FACEBOOK_ABOUT,
        description: FACEBOOK_DESCRIPTION,
        website: SITE.url,
      },
      token,
    );
    result.facebook.pageDetails = "updated";
  }, () => {
    result.facebook.pageDetails = "failed";
  });

  await runStep(result, "Facebook cover photo upload", async () => {
    const photo = await graphPost<IdReply>(
      `${pageId}/photos`,
      {
        url: cover.url,
        caption: `${SITE.name} - sarees for real life`,
        published: "false",
      },
      token,
    );
    if (!photo.id) throw new Error("Facebook cover upload returned no photo id");
    await graphPost<IdReply>(pageId, { cover: photo.id }, token);
    result.facebook.coverPhoto = "updated";
  }, () => {
    result.facebook.coverPhoto = "failed";
  });

  await runStep(result, "Facebook profile logo", async () => {
    await graphPost<IdReply>(`${pageId}/picture`, { picture: logo.url }, token);
    result.facebook.profilePhoto = "updated";
  }, () => {
    result.facebook.profilePhoto = "manual";
    result.manualSteps.push("Facebook Page profile photo/logo may need to be changed manually using the uploaded logo URL.");
  });

  result.manualSteps.push("Instagram bio, profile photo and any banner-style branding must be updated manually in Meta account settings.");
  result.ok = result.errors.length === 0 || result.facebook.pageDetails === "updated" || result.facebook.coverPhoto === "updated";
  return result;
}

async function publishBrandLogo() {
  const { bytes, contentType } = await fetchImageBytes("/logo/logo.png");
  return uploadPipelineAsset("social-media", "thetanti-meta-logo.png", bytes, contentType);
}

async function publishFacebookCover() {
  const cover = await createFacebookCover();
  return uploadPipelineAsset("social-media", "thetanti-facebook-cover.jpg", cover, "image/jpeg");
}

async function createFacebookCover(): Promise<Buffer> {
  const logoPath = path.resolve(process.cwd(), "public", "logo", "logo-light.webp");
  const heroPath = path.resolve(process.cwd(), "public", "banner", "banner-1.webp");
  const width = 1640;
  const height = 624;

  const hero = await sharp(heroPath)
    .resize({ width, height, fit: "cover", position: "center" })
    .modulate({ brightness: 0.82, saturation: 1.08 })
    .blur(0.2)
    .toBuffer();

  const overlay = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#2b1408" stop-opacity="0.90"/>
          <stop offset="0.55" stop-color="#5D350E" stop-opacity="0.62"/>
          <stop offset="1" stop-color="#5D350E" stop-opacity="0.22"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#shade)"/>
      <rect x="86" y="86" width="610" height="452" rx="28" fill="#2b1408" fill-opacity="0.36"/>
      <text x="112" y="245" font-family="Georgia, serif" font-size="92" font-weight="700" fill="#F6EBE1">TheTanti</text>
      <text x="118" y="310" font-family="Arial, sans-serif" font-size="34" letter-spacing="8" fill="#E7C17A">SAREES FOR REAL LIFE</text>
      <text x="118" y="393" font-family="Arial, sans-serif" font-size="50" font-weight="800" fill="#FFFFFF">All sarees INR ${SITE.price}</text>
      <text x="118" y="452" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#F6EBE1">Beautiful designs. Simple price. Easy shopping.</text>
      <text x="118" y="500" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#E7C17A">www.thetanti.shop</text>
    </svg>
  `);

  const logo = await sharp(logoPath).resize({ width: 250, withoutEnlargement: true }).toBuffer();

  return sharp(hero)
    .composite([
      { input: overlay, top: 0, left: 0 },
      { input: logo, top: 106, left: 120 },
    ])
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

async function runStep(
  result: MetaProfileUpdateResult,
  label: string,
  step: () => Promise<void>,
  onFail: () => void,
) {
  try {
    await step();
  } catch (err) {
    onFail();
    result.errors.push(`${label}: ${(err as Error).message}`);
  }
}
