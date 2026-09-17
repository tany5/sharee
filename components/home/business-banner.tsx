import Image from "next/image";

/**
 * Wholesale/business-enquiry banner — clicks open a WhatsApp chat with the
 * store's business number (wa.me requires the full international format),
 * preloaded with an enquiry message so the conversation starts itself.
 */
const WHATSAPP_NUMBER = "919038127527";
const ENQUIRY_TEXT = encodeURIComponent(
  "Hi TheTanti! I want to enquire about a business/wholesale order.",
);

export function BusinessBanner() {
  return (
    <section aria-label="Business enquiries" className="tt-container py-12 lg:py-16">
      <a
        href={`https://wa.me/${WHATSAPP_NUMBER}?text=${ENQUIRY_TEXT}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with TheTanti on WhatsApp for business enquiries"
        className="group block overflow-hidden rounded-[26px] border border-line shadow-lg shadow-accent/10 transition-transform duration-300 hover:scale-[1.01] hover:shadow-xl focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Image
          src="/banner/business-banner.webp"
          alt="TheTanti business enquiries — wholesale and bulk saree orders on WhatsApp"
          width={1600}
          height={581}
          sizes="(min-width: 1280px) 1216px, 92vw"
          className="h-auto w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />
      </a>
    </section>
  );
}
