/**
 * Listing-grid constants — shared by server pages, route handlers AND the
 * client-side infinite grid.
 *
 * This MUST stay a dependency-free module (no server-only imports): a client
 * component imports it, and importing a plain constant from a "use client"
 * module turns it into a client reference proxy instead of the value — which
 * silently disabled the first-page limit and rendered the entire catalogue at
 * once. Server components must import the constant from here (not from the
 * client component) for the same reason.
 */

/** Cards per page on the infinite-scroll listing grids (/sarees, categories). */
export const LISTING_PAGE_SIZE = 12;
