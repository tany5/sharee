/** Approximate swatch colour for a colourway name (visual only). */
const SWATCHES: Record<string, string> = {
  maroon: "#6b1f2c",
  red: "#7c2d3a",
  "forest green": "#3a5442",
  "deep green": "#31503c",
  "navy blue": "#2c3a63",
  "indigo blue": "#39446e",
  blue: "#44558c",
  "mustard yellow": "#9a7420",
  yellow: "#c89b34",
  "blush pink": "#c27078",
  pink: "#d2878f",
  teal: "#2c6367",
  "rust orange": "#8a4622",
  orange: "#b46939",
  brown: "#7a5230",
  plum: "#5c3550",
  purple: "#6e4671",
  "ivory cream": "#eadbc0",
  cream: "#e6d5b6",
  white: "#f4efe6",
  beige: "#d9c3a0",
};

export function swatchFor(name: string): string {
  const key = name.toLowerCase();
  for (const [k, v] of Object.entries(SWATCHES)) {
    if (key.includes(k)) return v;
  }
  return "#886644";
}
