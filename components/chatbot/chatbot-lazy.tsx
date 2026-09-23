"use client";

/**
 * Client wrapper for the chatbot's dynamic import — `ssr: false` must live in
 * a client component (Next 16 rule), while the store layout stays a server
 * component. This file is tiny; the actual chatbot chunk loads on demand.
 */
import dynamic from "next/dynamic";

const Chatbot = dynamic(() => import("@/components/chatbot/chatbot"), {
  ssr: false,
});

export default function ChatbotLazy() {
  return <Chatbot />;
}
