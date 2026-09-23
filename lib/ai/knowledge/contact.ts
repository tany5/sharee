/**
 * Contact knowledge — mirrors /contact and lib/site.ts.
 */
import { SITE } from "@/lib/site";
import type { KnowledgeChunk } from "./types";

export const contactChunks: KnowledgeChunk[] = [
  {
    id: "contact-support",
    category: "contact",
    title: "Contact and support",
    keywords: [
      "contact",
      "support",
      "help",
      "phone",
      "call",
      "whatsapp",
      "email",
      "human",
      "agent",
      "complaint",
      "grievance",
      "customer care",
    ],
    content:
      `TheTanti support: WhatsApp ${SITE.phone} (fastest — replies within minutes), ` +
      `phone ${SITE.phone} (Monday–Saturday, 10am–7pm IST), email ${SITE.email} (replies within 24 hours). ` +
      `Registered office: ${SITE.legalName}, ${SITE.address}. ` +
      `Full contact page: /contact.`,
  },
  {
    id: "contact-social",
    category: "contact",
    title: "Social media",
    keywords: [
      "instagram",
      "facebook",
      "social",
      "follow",
      "page",
      "dm",
      "media",
    ],
    content:
      `Follow TheTanti on Instagram at ${SITE.instagramHandle} (${SITE.instagramUrl}) ` +
      `and on Facebook at ${SITE.facebookUrl} for new arrivals and styling ideas. ` +
      `For order questions, WhatsApp ${SITE.phone} is fastest.`,
  },
];
