const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const root = process.cwd();
const outDir = path.join(root, "public", "marketing", "launch");
fs.mkdirSync(outDir, { recursive: true });

const baseImage = path.join(outDir, "thetanti-fashion-welcome-base.png");
const logo = path.join(root, "public", "logo", "logo-light.webp");

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function imageDataUri(file) {
  const data = await fs.promises.readFile(file);
  const ext = path.extname(file).slice(1).toLowerCase() || "png";
  return `data:image/${ext === "jpg" ? "jpeg" : ext};base64,${data.toString("base64")}`;
}

function lines(items, x, y, size, fill, family, weight = 600, gap = Math.round(size * 1.18), extra = "") {
  return items
    .map(
      (line, i) =>
        `<text x="${x}" y="${y + i * gap}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" ${extra}>${esc(line)}</text>`,
    )
    .join("");
}

async function baseLayer(width, height) {
  return sharp(baseImage)
    .resize(width, height, { fit: "cover", position: "right" })
    .modulate({ brightness: 0.94, saturation: 1.03 })
    .sharpen({ sigma: 0.4, m1: 0.8, m2: 1.25 })
    .png()
    .toBuffer();
}

function overlaySvg(width, height, kind) {
  const isStory = kind === "story";
  const logoDataPlaceholder = "__LOGO__";
  const display = "Georgia, 'Times New Roman', serif";
  const body = "Inter, Arial, sans-serif";
  const x = isStory ? 72 : 74;
  const logoW = isStory ? 198 : 172;
  const headlineSize = isStory ? 92 : 76;
  const headlineY = isStory ? 292 : 248;
  const offerY = isStory ? 1315 : 1015;
  const badgeY = isStory ? 1508 : 1166;
  const footerY = isStory ? 1812 : 1254;
  const headline = isStory ? ["A New Saree", "Story Begins"] : ["A New", "Saree Story"];
  const intro = isStory
    ? ["Nomoshkar Bengal,", "amra notun. Apnader support chai."]
    : ["Nomoshkar Bengal, amra notun.", "Apnader support chai."];
  const discount = isStory
    ? ["All sarees flat ₹199", "Contact for welcome discount", "up to ₹50, final ₹150 possible"]
    : ["Flat ₹199 sarees", "Welcome discount up to ₹50 on contact", "Selected orders can be ₹150"];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="left" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#120d0a" stop-opacity="0.88"/>
        <stop offset="0.34" stop-color="#120d0a" stop-opacity="0.66"/>
        <stop offset="0.58" stop-color="#120d0a" stop-opacity="0.24"/>
        <stop offset="1" stop-color="#120d0a" stop-opacity="0.04"/>
      </linearGradient>
      <linearGradient id="bottom" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#120d0a" stop-opacity="0"/>
        <stop offset="0.62" stop-color="#120d0a" stop-opacity="0.08"/>
        <stop offset="1" stop-color="#120d0a" stop-opacity="0.80"/>
      </linearGradient>
      <filter id="shadow"><feDropShadow dx="0" dy="10" stdDeviation="9" flood-color="#000" flood-opacity="0.38"/></filter>
      <filter id="fine"><feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#000" flood-opacity="0.26"/></filter>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#left)"/>
    <rect width="${width}" height="${height}" fill="url(#bottom)"/>
    <rect x="${isStory ? 44 : 46}" y="${isStory ? 44 : 46}" width="${width - (isStory ? 88 : 92)}" height="${height - (isStory ? 88 : 92)}" fill="none" stroke="#f2d7a5" stroke-width="2" opacity="0.26"/>
    <image href="${logoDataPlaceholder}" x="${x}" y="${isStory ? 70 : 68}" width="${logoW}" height="${Math.round(logoW / 2)}" preserveAspectRatio="xMidYMid meet" opacity="0.98"/>
    <text x="${x}" y="${isStory ? 218 : 190}" font-family="${body}" font-size="${isStory ? 24 : 20}" font-weight="850" fill="#d6ad72" letter-spacing="5">NEW IN BENGAL</text>
    ${lines(headline, x, headlineY, headlineSize, "#fff7ee", display, 600, Math.round(headlineSize * 0.95), 'filter="url(#shadow)"')}
    ${lines(intro, x + 4, headlineY + (isStory ? 205 : 168), isStory ? 31 : 27, "#eaded0", body, 700, isStory ? 43 : 36)}
    <g transform="translate(${x} ${offerY})" filter="url(#fine)">
      <line x1="0" y1="0" x2="${isStory ? 440 : 380}" y2="0" stroke="#d6ad72" stroke-width="2" opacity="0.76"/>
      ${lines(discount, 0, isStory ? 58 : 50, isStory ? 30 : 25, "#fff7ee", body, 760, isStory ? 43 : 36)}
    </g>
    <g transform="translate(${x} ${badgeY})" filter="url(#fine)">
      <rect x="0" y="0" width="${isStory ? 348 : 310}" height="${isStory ? 74 : 64}" rx="${isStory ? 37 : 32}" fill="#fff7ee" opacity="0.95"/>
      <text x="${isStory ? 174 : 155}" y="${isStory ? 48 : 42}" text-anchor="middle" font-family="${body}" font-size="${isStory ? 25 : 22}" font-weight="950" fill="#171311" letter-spacing="1.4">VISIT WEBSITE</text>
      <rect x="${isStory ? 376 : 338}" y="0" width="${isStory ? 246 : 220}" height="${isStory ? 74 : 64}" rx="${isStory ? 37 : 32}" fill="none" stroke="#fff7ee" stroke-width="2" opacity="0.82"/>
      <text x="${isStory ? 499 : 448}" y="${isStory ? 48 : 42}" text-anchor="middle" font-family="${body}" font-size="${isStory ? 25 : 22}" font-weight="850" fill="#fff7ee">CONTACT US</text>
    </g>
    <text x="${x}" y="${footerY}" font-family="${body}" font-size="${isStory ? 28 : 22}" font-weight="800" fill="#fff7ee">thetanti.shop</text>
    <text x="${x}" y="${footerY + (isStory ? 42 : 32)}" font-family="${body}" font-size="${isStory ? 23 : 18}" font-weight="650" fill="#dacbbc">WhatsApp +91 79804 29183</text>
    <text x="${x}" y="${footerY + (isStory ? 82 : 58)}" font-family="${body}" font-size="${isStory ? 18 : 15}" font-weight="650" fill="#b9aa9d">Welcome discount subject to contact confirmation.</text>
  </svg>`;
  return svg;
}

async function makeCreative(width, height, kind) {
  const logoData = await imageDataUri(logo);
  const overlay = Buffer.from(overlaySvg(width, height, kind).replace("__LOGO__", logoData));
  return sharp(await baseLayer(width, height))
    .composite([{ input: overlay, left: 0, top: 0 }])
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

async function main() {
  if (!fs.existsSync(baseImage)) {
    throw new Error(`Missing base image: ${baseImage}`);
  }
  fs.writeFileSync(path.join(outDir, "thetanti-fashion-welcome-feed.jpg"), await makeCreative(1080, 1350, "feed"));
  fs.writeFileSync(path.join(outDir, "thetanti-fashion-welcome-story.jpg"), await makeCreative(1080, 1920, "story"));
  fs.writeFileSync(
    path.join(outDir, "thetanti-fashion-welcome-captions.txt"),
    [
      "FEED POST CAPTION",
      "",
      "Nomoshkar Bengal, amra TheTanti. Notun online saree store, apnader support chai.",
      "",
      "Amader website e sob saree flat ₹199. Launch welcome er jonno contact korle selected orders e up to ₹50 discount pawa jete pare, final price ₹150 porjonto hote pare.",
      "",
      "Website ghure dekhun, pochondo hole order korun, aar kono question thakle amader contact korun.",
      "",
      "Visit: https://www.thetanti.shop",
      "WhatsApp: +91 79804 29183",
      "",
      "#TheTanti #BengaliSaree #Saree199 #BudgetSaree #DailyWearSaree #SareeOnline",
      "",
      "STORY COPY",
      "",
      "Nomoshkar Bengal",
      "We are new",
      "Flat ₹199 sarees",
      "Contact us for welcome discount up to ₹50",
      "Selected orders can be ₹150",
      "Apnader support chai",
      "Visit thetanti.shop",
    ].join("\n"),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
