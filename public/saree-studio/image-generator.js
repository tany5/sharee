/**
 * Saree AI Studio — Puter.js image generation.
 * No API keys: generation runs under the signed-in Puter account.
 */
(function () {
  "use strict";

  var STYLE_PRESETS = {
    premium_editorial:
      "premium editorial Indian fashion campaign, sophisticated minimal background, warm cinematic lighting, luxury magazine aesthetic, refined serif headline style",
    bengali_traditional:
      "traditional Bengali cultural setting, red and gold accents, tasteful brass lamp, old Kolkata home warmth, festive but clean ambience",
    modern_minimal:
      "clean modern minimal studio look, soft cream backdrop, elegant arch shape, gentle diffused lighting, contemporary boutique aesthetic",
    festive:
      "joyful festive atmosphere, marigold and deep red palette, warm golden lights, celebratory Indian mood, uncluttered premium layout",
    luxury_wedding:
      "luxurious bridal setting, rich silk textures, royal gold and maroon tones, regal cinematic lighting, high-end catalogue composition",
    boutique_fashion:
      "chic boutique fashion look, tasteful props, stylish contemporary composition, soft warm glow, fashion retail campaign polish",
  };

  var FORMAT_SIZES = { square: 1080, portrait: 1350, story: 1920 };

  function friendlyError(err) {
    var msg = String((err && (err.message || err.error)) || err || "");
    if (/auth|sign.?in|login|permission/i.test(msg)) {
      return "Please sign in to Puter to continue.";
    }
    if (/timeout|timed?.?out/i.test(msg)) {
      return "The AI took too long to respond. Please try again.";
    }
    if (/network|fetch|Failed to fetch/i.test(msg)) {
      return "Network problem while contacting Puter. Check your connection and retry.";
    }
    return "Image generation failed. Please try again.";
  }

  /** Prompt: product-preservation contract + composition + style preset. */
  function buildPrompt(styleKey, variationSeed) {
    var style = STYLE_PRESETS[styleKey] || STYLE_PRESETS.premium_editorial;
    var variation = [
      "elegant standing three-quarter pose with full saree visible",
      "graceful seated pose on a wooden chair with pallu flowing clearly",
      "confident walk pose with pallu in hand, full outfit visible",
      "poised portrait pose with hands clasped and saree border in focus",
      "heritage boutique pose near a brass lamp, clean negative space",
      "minimal fashion catalogue pose against a cream terracotta backdrop",
    ][variationSeed % 6];
    return [
      "Create a premium Indian saree fashion advertisement for TheTanti, a modern Bengali saree marketplace.",
      "Use the uploaded product image as the primary saree reference.",
      "The saree worn by the model must closely match the uploaded product in color, pattern, border, pallu, fabric appearance and overall design.",
      "Create an elegant realistic Bengali/Indian woman wearing this saree. She should look like a real everyday woman photographed professionally, not a plastic AI model.",
      "Show the model from head to toe when possible. Keep the model fully visible and never hidden behind text.",
      "The saree must be clearly visible and be the hero of the advertisement.",
      "Pose for this version: " + variation + ".",
      "Use realistic Indian fashion photography. Natural skin texture. Realistic face. Realistic hands. Realistic body proportions. Sharp high-resolution finish.",
      "Natural saree draping. Detailed fabric texture, pleats and pallu. Elegant blouse. Tasteful traditional jewellery.",
      "Leave significant negative space for promotional typography away from the face and saree details.",
      style + ".",
      "Use premium colors that complement the uploaded saree: reds, creams, golds, terracotta, magenta, teal or deep blue. Vary the composition from previous posts.",
      "The final image should look like a professional commercial campaign created by a premium Indian saree brand, not generic AI art.",
      "Do not distort the saree. Do not change the saree into another design. Do not add unnecessary objects.",
      "Do not add text, logos, fake brand names or watermarks inside the AI image because exact text will be added later.",
      "No regional coverage text. No crossed-out text. No spelling mistakes.",
      "Square 1:1 format, professional fashion advertisement, minimalistic and attractive.",
    ].join(" ");
  }

  /**
   * Describe the uploaded product via Puter vision (chat with image) so the
   * txt2img prompt can carry the saree's actual colours/border/pallu. Falls
   * back to a generic reference instruction if vision fails.
   */
  function describeSaree(dataUrl) {
    return window.puter.ai.chat
      ? window.puter.ai.chat(
          [
            {
              role: "user",
              content: [
                { type: "text", text: "Describe this saree in one dense sentence for an image prompt: primary colour, secondary colours, border style, pattern/motifs, pallu, fabric look. Only visible facts, no invented brand or fabric names." },
                { type: "file", puter_path: dataUrl },
              ],
            },
          ],
          { model: "gpt-5-nano" },
        )
      : Promise.reject(new Error("vision unavailable"));
  }

  /**
   * Generate the base campaign photo. Resolves { url } where url is a
   * puter.ai-hosted image URL or a data URL, depending on the model reply.
   */
  function generateCampaign(opts) {
    var styleKey = opts.styleKey;
    var variationSeed = opts.variationSeed || 0;
    var model = opts.model || "gpt-image-2.5-flare";
    var testMode = Boolean(opts.testMode);

    return describeSaree(opts.imageDataUrl)
      .then(function (desc) {
        var text = typeof desc === "string" ? desc : (desc && (desc.message && desc.message.content || desc.text)) || "";
        var sareeLine = String(text).trim().slice(0, 400);
        var prompt = buildPrompt(styleKey, variationSeed);
        if (sareeLine) prompt = "Uploaded saree appearance: " + sareeLine + ". " + prompt;
        if (testMode) return { prompt: prompt, url: null };
        return window.puter.ai.txt2img(prompt, { model: model }).then(function (out) {
          var url = typeof out === "string" ? out : out && (out.url || out.src);
          if (!url) throw new Error("Empty result from image model");
          return { prompt: prompt, url: url };
        });
      })
      .catch(function (err) {
        if (err && /vision unavailable/i.test(err.message)) {
          // No vision path — still generate with the reference instruction.
          var prompt = buildPrompt(styleKey, variationSeed);
          if (testMode) return { prompt: prompt, url: null };
          return window.puter.ai.txt2img(prompt, { model: model }).then(function (out) {
            var url = typeof out === "string" ? out : out && (out.url || out.src);
            if (!url) throw new Error("Empty result from image model");
            return { prompt: prompt, url: url };
          });
        }
        throw err;
      });
  }

  window.SareeAI = {
    buildPrompt: buildPrompt,
    describeSaree: describeSaree,
    generateCampaign: generateCampaign,
    friendlyError: friendlyError,
    FORMAT_SIZES: FORMAT_SIZES,
    STYLE_PRESETS: STYLE_PRESETS,
  };
})();
