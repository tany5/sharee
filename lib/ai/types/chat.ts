import type { FulfilmentStatus, PaymentStatus } from "@/lib/types";

/* ------------------------------ messages ------------------------------- */

/** Rich content block rendered inside an assistant message. */
export interface ProductCardBlock {
  kind: "product-cards";
  products: ChatProduct[];
  /** Exact filter description used by the tool ("Red sarees under ₹1,000"). */
  queryLabel: string;
}

/** One product as rendered in chat product cards (server-truth fields only). */
export interface ChatProduct {
  slug: string;
  name: string;
  category: string;
  colorway: string;
  price: number;
  rating: number;
  reviewCount: number;
  tags: string[];
  image?: string;
  images?: string[];
}

export interface OrderStatusBlock {
  kind: "order-status";
  order: {
    number: string;
    createdAt: string;
    estimatedDelivery: string;
    paymentStatus: PaymentStatus;
    fulfilment: FulfilmentStatus | undefined;
    tracking: { courier?: string; awb?: string; url?: string | null } | null;
    items: { name: string; qty: number; price: number; color: string }[];
    total: number;
  };
}

export interface LinkBlock {
  kind: "links";
  links: { label: string; href: string }[];
}

/** Union of rich blocks an assistant message may carry. */
export type MessageBlock = ProductCardBlock | OrderStatusBlock | LinkBlock;

/* ------------------------------ messages ------------------------------- */

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  /** Rendered text. Assistant messages may be partial while streaming. */
  text: string;
  blocks?: MessageBlock[];
  /** Server/computation origin marker for UI badges and tests. */
  origin?: "local" | "live";
  /** Populated when the assistant message is an error/fallback. */
  error?: boolean;
  createdAt: number;
}

/* ------------------------------ intents -------------------------------- */

export type Intent =
  | "GENERAL"
  | "FAQ"
  | "PRODUCT_SEARCH"
  | "PRODUCT_DETAILS"
  | "CATEGORY_SEARCH"
  | "SHIPPING"
  | "RETURNS"
  | "PAYMENTS"
  | "ORDER_STATUS"
  | "CART"
  | "WEBSITE_NAVIGATION"
  | "CONTACT"
  | "UNKNOWN";

export interface IntentResult {
  intent: Intent;
  /** True when a deterministic keyword rule matched (no LLM needed). */
  ruleBased: boolean;
}

/* ------------------------------- tools --------------------------------- */

/** A single explicitly-allowed tool the assistant may call. */
export interface ToolDefinition {
  name: string;
  description: string;
}

/** Payload for a product search tool call. */
export interface ProductSearchToolInput {
  q?: string;
  category?: string;
  color?: string;
  maxPrice?: number;
  minPrice?: number;
  limit?: number;
}

export interface ToolResult {
  ok: boolean;
  /** Customer-safe error message when ok is false. */
  error?: string;
}

/* -------------------------- worker protocol ---------------------------- */

/** Messages posted from the main thread to the AI worker. */
export type WorkerRequest =
  | { type: "load" }
  | { type: "generate"; requestId: number; prompt: string }
  | { type: "interrupt"; requestId: number };

/** Messages posted from the AI worker back to the main thread. */
export type WorkerResponse =
  | { type: "status"; state: "idle" | "loading" | "ready" | "error" }
  | { type: "progress"; progress: number } // 0..100
  | { type: "ready"; device: string }
  | { type: "token"; requestId: number; text: string }
  | { type: "done"; requestId: number }
  | { type: "error"; requestId?: number; message: string };
