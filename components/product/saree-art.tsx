/**
 * Generative drape SVG. Pure + deterministic (no hooks, no context), so it can
 * render on the server and in client components (cart rows, etc.).
 *
 * Visual recipe: fabric gradient body -> woven/printed pattern -> soft folds ->
 * deep pallu band with gold motif row -> hairline gold frame.
 */
import type { ArtSpec } from "@/lib/art";

const SW = 600;
const SH = 800;

interface SareeArtProps {
  spec: ArtSpec;
  label?: string;
  className?: string;
  /** Slightly zoomed/panned crop for thumbnails & cards (keeps cards crisp). */
  crop?: "none" | "portrait";
}

function Folds({
  id,
  scheme,
  seed,
}: {
  id: string;
  scheme: ArtSpec["scheme"];
  seed: number;
}) {
  const n = 3 + (seed % 3);
  const folds = Array.from({ length: n }, (_, i) => {
    const cx = 80 + ((seed >> (i * 4)) % 200) + i * 110;
    const drift = ((seed >> (i * 3)) % 60) - 30;
    const dark = i % 2 === 0;
    return {
      cx,
      drift,
      dark,
      d: `M${cx},90 C${cx + drift},250 ${cx - drift},430 ${cx + 8},560 C${cx + 12},660 ${cx - 4},730 ${cx - 6},800`,
    };
  });
  return (
    <g key={id}>
      {folds.map((f, i) => (
        <path
          key={i}
          d={f.d}
          fill="none"
          stroke={f.dark ? scheme.deep : scheme.foil}
          strokeWidth={f.dark ? 26 : 14}
          opacity={f.dark ? 0.22 : 0.1}
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

function Pattern({
  id,
  kind,
  scheme,
}: {
  id: string;
  kind: ArtSpec["pattern"];
  scheme: ArtSpec["scheme"];
}) {
  const gold = scheme.gold;
  const foil = scheme.foil;
  const light = scheme.top;
  const deep = scheme.deep;
  switch (kind) {
    case "weave":
      return (
        <pattern id={id} width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M0,12 24,0 M0,0 24,12" stroke={light} strokeWidth="1" opacity="0.28" />
          <path d="M0,24 24,12 M0,12 24,24" stroke={deep} strokeWidth="1" opacity="0.2" />
          <rect x="11" y="11" width="2" height="2" fill={gold} opacity="0.5" />
        </pattern>
      );
    case "dots":
      return (
        <pattern id={id} width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="6" cy="6" r="1.7" fill={gold} opacity="0.55" />
          <circle cx="17" cy="17" r="1.7" fill={gold} opacity="0.55" />
          <circle cx="6" cy="17" r="0.9" fill={foil} opacity="0.35" />
          <circle cx="17" cy="6" r="0.9" fill={foil} opacity="0.35" />
        </pattern>
      );
    case "motif": {
      // Small flower + dot scatter (printed-saree feel), softened.
      return (
        <pattern id={id} width="72" height="72" patternUnits="userSpaceOnUse">
          <g opacity="0.5">
            <g fill="none" stroke={gold} strokeWidth="1.4">
              <circle cx="18" cy="18" r="5" />
              <circle cx="18" cy="18" r="2.2" fill={gold} stroke="none" />
              <circle cx="18" cy="8" r="1.6" fill={foil} />
              <circle cx="28" cy="14" r="1.6" fill={foil} />
              <circle cx="24" cy="24" r="1.6" fill={foil} />
              <circle cx="12" cy="26" r="1.4" fill={foil} />
              <circle cx="10" cy="12" r="1.4" fill={foil} />
            </g>
            <circle cx="54" cy="40" r="1.3" fill={gold} />
            <circle cx="60" cy="58" r="1.3" fill={gold} />
          </g>
        </pattern>
      );
    }
    case "sheen": {
      // Chiffon: delicate grid + soft diagonal bands handled as overlay elsewhere.
      return (
        <pattern id={id} width="30" height="30" patternUnits="userSpaceOnUse">
          <path d="M0,15 30,15 M15,0 15,30" stroke={foil} strokeWidth="0.6" opacity="0.14" />
          <circle cx="15" cy="15" r="1" fill={gold} opacity="0.4" />
        </pattern>
      );
    }
    case "grid":
      return (
        <pattern id={id} width="18" height="18" patternUnits="userSpaceOnUse">
          <path d="M0,9 18,9 M9,0 9,18" stroke={foil} strokeWidth="0.7" opacity="0.16" />
          <circle cx="0" cy="0" r="1.4" fill={gold} opacity="0.5" />
        </pattern>
      );
    case "sparkle":
      return (
        <pattern id={id} width="64" height="64" patternUnits="userSpaceOnUse">
          <g stroke={gold} strokeWidth="1" fill="none" opacity="0.7">
            <path d="M16,6 l2.2,7.8 L26,16 l-7.8,2.2 L16,26 l-2.2,-7.8 L6,16 l7.8,-2.2 Z" />
            <circle cx="46" cy="40" r="1.6" fill={gold} stroke="none" />
            <circle cx="40" cy="54" r="1.2" fill={foil} />
            <path d="M52,12 l1.4,3.6 3.6,1.4 -3.6,1.4 -1.4,3.6 -1.4,-3.6 -3.6,-1.4 3.6,-1.4 Z" stroke={foil} />
          </g>
        </pattern>
      );
  }
}

/** Bottom pallu band with gold motif + hairline borders. */
function Pallu({
  id,
  scheme,
  seed,
}: {
  id: string;
  scheme: ArtSpec["scheme"];
  seed: number;
}) {
  const bumps = 3 + (seed % 2);
  const w = SW / bumps;
  const edge = Array.from({ length: bumps + 1 }, (_, i) => {
    const x = i * w;
    const cx = x + w / 2;
    return ` C${cx - w * 0.14},${728 + (i % 2) * 18} ${cx + w * 0.14},${702 + (i % 2) * 18} ${x + w},716`;
  }).join("");
  const edgePath = `M0,716${edge} L600,730 L600,800 L0,800 Z`;
  return (
    <g>
      <path d={edgePath} fill={scheme.deep} />
      <path
        d={edgePath}
        fill={`url(#${id}-pallu-pat)`}
        opacity="0.9"
      />
      <path d={`M0,${716}${edge}`} fill="none" stroke={scheme.gold} strokeWidth="2.5" opacity="0.85" />
      <path d={`M0,${710}${edge.replace(/716/g, "712")}`} fill="none" stroke={scheme.foil} strokeWidth="1" opacity="0.5" />
    </g>
  );
}

export default function SareeArt({
  spec,
  label,
  className,
  crop = "none",
}: SareeArtProps) {
  const { scheme, pattern, seed } = spec;
  const uid = `art${seed.toString(36)}${pattern}${scheme.key}`;

  return (
    <svg
      viewBox={crop === "portrait" ? "70 110 460 620" : `0 0 ${SW} ${SH}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role="img"
      aria-label={label ?? "Saree fabric artwork"}
    >
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor={scheme.top} />
          <stop offset="55%" stopColor={scheme.mid} />
          <stop offset="100%" stopColor={scheme.deep} />
        </linearGradient>
        <radialGradient id={`${uid}-sheen`} cx="0.5" cy="0.2" r="0.9">
          <stop offset="0%" stopColor={scheme.foil} stopOpacity="0.35" />
          <stop offset="55%" stopColor={scheme.foil} stopOpacity="0.05" />
          <stop offset="100%" stopColor={scheme.foil} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-vig`} cx="0.5" cy="0.5" r="0.75">
          <stop offset="62%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.22" />
        </radialGradient>
        <pattern id={`${uid}-pallu-pat`} width="34" height="30" patternUnits="userSpaceOnUse">
          <path
            d="M17,4 l3.4,6.6 7,0.6 -5.2,4.8 1.4,6.9 -6.6,-3.5 -6.6,3.5 1.4,-6.9 -5.2,-4.8 7,-0.6 Z"
            fill={scheme.gold}
            opacity="0.85"
          />
          <circle cx="3" cy="15" r="0.9" fill={scheme.foil} opacity="0.8" />
          <circle cx="31" cy="15" r="0.9" fill={scheme.foil} opacity="0.8" />
        </pattern>
        <Pattern id={`${uid}-pat`} kind={pattern} scheme={scheme} />
      </defs>

      {/* Fabric body */}
      <rect width={SW} height={SH} fill={`url(#${uid}-bg)`} />
      <rect width={SW} height={SH} fill={`url(#${uid}-pat)`} />
      <rect width={SW} height={SH} fill={`url(#${uid}-sheen)`} />

      {/* Folds */}
      <Folds id={`${uid}-folds`} scheme={scheme} seed={seed} />

      {/* Diagonal glint for sheer fabrics */}
      {(pattern === "sheen" || pattern === "grid") && (
        <g opacity="0.18">
          <path d="M-60,520 L180,80 L260,80 L20,520 Z" fill={scheme.foil} />
          <path d="M180,800 L420,360 L500,360 L260,800 Z" fill={scheme.foil} />
        </g>
      )}

      {/* Pallu */}
      <Pallu id={uid} scheme={scheme} seed={seed} />

      {/* Hairline frame + vignette */}
      <rect x="12" y="12" width={SW - 24} height={SH - 24} fill="none" stroke={scheme.gold} strokeWidth="1.6" opacity="0.55" rx="8" />
      <rect width={SW} height={SH} fill={`url(#${uid}-vig)`} />
    </svg>
  );
}
