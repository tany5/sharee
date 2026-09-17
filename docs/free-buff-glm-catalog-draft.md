# Free Buff GLM Draft: TheTanti Saree Catalog Images

Use this draft to process each saree image as a separate product.

## Goal

Create clean ecommerce catalog images for Meta/Facebook/Instagram and WhatsApp from the original saree photos.

Each source image is one different product. Do not combine products and do not create variants.

## Output Naming

Use the source image order sorted by filename.

- Product ID: `TT-SAREE-001`, `TT-SAREE-002`, `TT-SAREE-003`, etc.
- Catalog image filename: `tt-saree-001-catalog.png`, `tt-saree-002-catalog.png`, etc.
- WhatsApp poster filename: `tt-saree-001-whatsapp.jpg`, `tt-saree-002-whatsapp.jpg`, etc.

## Catalog Image Prompt

Retouch this product photo so the saree appears clean and professional for ecommerce catalog use. Remove the transparent plastic cover look, including shiny glare streaks, wrinkles, reflections, and crinkled plastic edges. Remove any printed product stamp, label, card, barcode, or packaging sticker visible on the saree. Replace removed label areas with plausible matching saree fabric and embroidery continuation based on surrounding colors and weave.

Keep the saree product isolated on a clean warm ivory studio background suitable for Meta catalog and WhatsApp. Preserve the saree's actual colors, border, floral embroidery, woven texture, print, and visible design. Use realistic product photography retouching with crisp fabric detail. Center the folded saree as a square catalog image with the product fully visible and lightly shadowed.

Do not add people, mannequins, hands, new logos, watermark, or extra text. Do not mention AI, generated content, retouching, or editing anywhere in the image or file metadata intended for customers.

## WhatsApp Poster Layout

Create a 1080 x 1920 portrait poster from the catalog image.

Top header:

`TheTanti`

Subheading:

`Flat Rs 199 | Shipping Included`

Bottom button:

`Order on WhatsApp: +91 90381 27527`

Bottom line:

`TT-SAREE-### | Ready stock | No extra charges`

Keep the product large, centered, and clear. Use warm ivory background, dark espresso header, muted gold subheading, and terracotta WhatsApp call-to-action button.

## Meta CSV Rules

Use these fixed catalog values:

- `availability`: `in stock`
- `condition`: `new`
- `brand`: `TheTanti`
- `price`: `199.00 INR`
- `shipping`: `IN:::0.00 INR`
- `offer_disclaimer`: `Flat Rs 199. Shipping included. No extra charges.`
- `gender`: `female`
- `size`: `free size`
- `age_group`: `adult`
- `pattern`: `embroidered / printed`
- `product_tags[0]`: `saree`
- `product_tags[1]`: `shipping included`
- `style[0]`: `ethnic`
- `item_group_id`: leave blank
- Do not write AI, AI-retouched, generated, synthetic, or edited in any customer-facing field.

Description template:

`Beautiful saree from TheTanti. Each image represents a separate saree product. Flat Rs 199 with shipping included and no extra charges. Ready stock.`

Product link template:

`https://www.thetanti.shop/products/tt-saree-###`

Image link template:

`https://www.thetanti.shop/catalog/products/tt-saree-###-catalog.png`
