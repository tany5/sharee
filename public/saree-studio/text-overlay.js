/**
 * Saree AI Studio — exact-text overlay (canvas).
 * The AI never renders promotional text: this module stamps it pixel-perfectly
 * on the LEFT column, with the offer amount as the largest element. The ₹
 * glyph is drawn from the literal string — never substituted by the browser.
 */
(function () {
  "use strict";

  /** Split an offer like "₹199 FLAT" into { amount, label } (largest glyph row). */
  function parseOffer(offer) {
    var m = /\s*([^\d]*[\d][\d,]*)\s*(.*)$/.exec(offer.trim());
    if (!m) return { amount: offer.trim(), label: "" };
    return { amount: m[1].trim(), label: (m[2] || "").trim() };
  }

  var SERIF = "Georgia, 'Times New Roman', serif";
  var SANS = "'Segoe UI', Arial, sans-serif";

  /**
   * Compose the final post: base image cover-drawn onto the canvas, then the
   * text column with a warm gradient wash for legibility.
   * Returns a data URL (PNG).
   */
  function composePost(opts) {
    var width = opts.width;
    var height = opts.height;
    var text = opts.text; // { brand, headline, offer, ship }
    var baseImg = opts.image; // HTMLImageElement (already loaded)

    var canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext("2d");

    // Cover-draw the generated photo.
    var scale = Math.max(width / baseImg.naturalWidth, height / baseImg.naturalHeight);
    var dw = baseImg.naturalWidth * scale;
    var dh = baseImg.naturalHeight * scale;
    ctx.drawImage(baseImg, (width - dw) / 2, (height - dh) / 2, dw, dh);

    // Left column wash: warm dark gradient, strongest at the text band.
    var grad = ctx.createLinearGradient(0, 0, width * 0.7, 0);
    grad.addColorStop(0, "rgba(64,26,14,0.78)");
    grad.addColorStop(0.55, "rgba(64,26,14,0.35)");
    grad.addColorStop(1, "rgba(64,26,14,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    var pad = Math.round(width * 0.062);
    var maxTextW = Math.round(width * 0.43);
    var cream = "#fdf3e7";
    var accent = "#e8b56a";

    // Brand mark/name.
    if (opts.logo) {
      var logoW = Math.round(width * 0.13);
      var logoH = Math.round(width * 0.13 * (opts.logo.naturalHeight / opts.logo.naturalWidth));
      ctx.drawImage(opts.logo, pad, Math.round(height * 0.055), logoW, logoH);
    }
    ctx.fillStyle = cream;
    ctx.font = "700 " + Math.round(width * 0.042) + "px " + SERIF;
    ctx.fillText(text.brand || "TheTanti", pad + (opts.logo ? Math.round(width * 0.15) : 0), Math.round(height * 0.105));
    ctx.font = "500 " + Math.round(width * 0.015) + "px " + SANS;
    drawSpaced(ctx, "SAREES FOR REAL LIFE", pad + (opts.logo ? Math.round(width * 0.15) : 0), Math.round(height * 0.13), width * 0.002);

    // Campaign headline.
    ctx.font = "700 " + Math.round(width * 0.03) + "px " + SANS;
    drawSpaced(ctx, (text.headline || "OUR SAREE").toUpperCase(), pad, Math.round(height * 0.24), width * 0.005);

    // Thin rule under the brand.
    ctx.fillStyle = "rgba(253,243,231,0.85)";
    ctx.fillRect(pad, Math.round(height * 0.255), Math.round(width * 0.12), 2);

    // Offer amount — THE largest element, serif black, auto-fitted.
    var offer = parseOffer(text.offer);
    var amountSize = Math.round(width * 0.135);
    ctx.font = "900 " + amountSize + "px " + SERIF;
    while (ctx.measureText(offer.amount).width > maxTextW && amountSize > 24) {
      amountSize -= 4;
      ctx.font = "900 " + amountSize + "px " + SERIF;
    }
    var offerY = Math.round(height * 0.43);
    ctx.fillStyle = cream;
    ctx.fillText(offer.amount, pad, offerY);

    // Label ("FLAT") under the amount in the accent colour.
    if (offer.label) {
      ctx.font = "700 " + Math.round(width * 0.036) + "px " + SANS;
      ctx.fillStyle = accent;
      ctx.fillText(offer.label.toUpperCase(), pad + 2, offerY + Math.round(width * 0.055));
    }

    // Supporting lines — clean sans, generous spacing.
    ctx.font = "600 " + Math.round(width * 0.026) + "px " + SANS;
    ctx.fillStyle = cream;
    ctx.fillText(text.ship.toUpperCase(), pad, Math.round(height * 0.64));

    ctx.fillStyle = "#6b1530";
    roundRect(ctx, pad, Math.round(height * 0.73), Math.round(width * 0.24), Math.round(width * 0.07), Math.round(width * 0.035));
    ctx.fill();
    ctx.fillStyle = "#fff7ed";
    ctx.font = "800 " + Math.round(width * 0.022) + "px " + SANS;
    ctx.fillText("SHOP NOW", pad + Math.round(width * 0.038), Math.round(height * 0.73) + Math.round(width * 0.045));

    // Accent rule.
    ctx.fillStyle = accent;
    ctx.fillRect(pad, Math.round(height * 0.68), Math.round(width * 0.16), 3);

    return canvas.toDataURL("image/png");
  }

  /** Letter-spaced fillText via per-character draws (canvas has no letter-spacing). */
  function drawSpaced(ctx, text, x, y, gap) {
    var cx = x;
    for (var i = 0; i < text.length; i += 1) {
      var ch = text[i];
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + gap;
    }
    return cx - x;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  window.SareeOverlay = { composePost: composePost, parseOffer: parseOffer };
})();
