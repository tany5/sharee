import type { SVGProps } from "react";

/**
 * Minimal alpana-style lotus — the single Bengali motif used across the
 * storefront (hero flourish + footer). Deliberately line-drawn and small so it
 * reads as discovered detail rather than announced decoration.
 */
export function LotusIcon({
  size = 26,
  strokeWidth = 1.4,
  ...rest
}: SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 32"
      width={size * 1.5}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      {...rest}
    >
      <path d="M24 28c-4.6 0-8.4-2.6-10.3-6.2 2.9-1.1 6.4-1.7 10.3-1.7s7.4.6 10.3 1.7C32.4 25.4 28.6 28 24 28Z" />
      <path d="M13.7 21.8C10.4 21 7.6 19.4 5.6 17c3-.9 6-.9 8.9 0" />
      <path d="M34.3 21.8c3.3-.8 6.1-2.4 8.1-4.8-3-.9-6-.9-8.9 0" />
      <path d="M24 28c-2.6-2.8-3.9-6-3.9-9.6s1.3-6.9 3.9-9.7c2.6 2.8 3.9 6.1 3.9 9.7S26.6 25.2 24 28Z" />
      <path d="M19.9 18.6c-2.9-1.7-4.9-4.1-6-7.3 3.2-.2 6 .6 8.4 2.5" />
      <path d="M28.1 18.6c2.9-1.7 4.9-4.1 6-7.3-3.2-.2-6 .6-8.4 2.5" />
    </svg>
  );
}
