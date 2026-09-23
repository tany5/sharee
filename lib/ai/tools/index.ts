/** Registry of explicitly-allowed assistant tools (for prompts + tests). */
import type { ToolDefinition } from "@/lib/ai/types/chat";

export const TOOLS: ToolDefinition[] = [
  { name: "product_search", description: "Search the real catalogue with validated filters (q, category, color, maxPrice, minPrice)." },
  { name: "product_details", description: "Fetch one real product by slug." },
  { name: "order_status", description: "Fetch the signed-in customer's own recent orders (session-authenticated)." },
  { name: "cart_help", description: "Validate a slug for the UI to add via the existing cart." },
];
