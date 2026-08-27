import { TryOnRequest } from './provider.interface';

/**
 * Where each garment category goes on the body, phrased the way the model reads
 * best — a destination, not a category name. Mirrors the REGIONS map in the
 * jewellery POC's textiles vertical.
 */
const REGIONS: Record<string, string> = {
  dress: 'the full body, as a single garment from shoulders to hem',
  top: 'the upper body, leaving the existing trousers, skirt and shoes as they are',
  bottom: 'the lower body, from the waist down, leaving the existing top and shoes as they are',
  outerwear: 'the upper body, as an outer layer over whatever is already worn there',
  full_outfit: 'the full body — the matching upper and lower pieces together',
};

/**
 * Prompt handed to the image model.
 *
 * Ported from `domains/textiles/buildTryOnPrompt` in the jewellery POC, which
 * has been run against real customer photos; the rules are kept in that order
 * and largely in that wording, because they were arrived at by watching this
 * model fail. In particular:
 *
 *   - The garment reference is nearly always a catalogue photo with a DIFFERENT
 *     model wearing it. Without an explicit instruction the model blends that
 *     face and build into the output and the shopper comes back as someone else.
 *   - The old outfit survives as a fringe at the neckline, cuffs and hem unless
 *     full replacement is spelled out at those exact edges.
 *   - Fabric and print are quietly "improved" — a dotted georgette returns plain,
 *     a matte jersey returns ribbed. That is the defect that causes returns.
 *
 * Images are identified by filename (customer.*, garment.*) rather than by
 * position; the models follow that far more reliably than "the first image".
 */
export function buildTryOnPrompt(request: TryOnRequest): string {
  const { garmentName, garmentColor, garmentDescription, category, promptHint } = request;

  const material = [garmentColor].filter(Boolean).join(', ');
  const descriptor = `"${garmentName}"${material ? ` (${material})` : ''}`;
  const region = REGIONS[category] ?? REGIONS.dress;

  const lines = [
    'You are producing a virtual try-on for a clothing retailer.',
    '',
    'TWO INPUT IMAGES ARE PROVIDED:',
    '- "customer" — the shopper photo. This is the base image you are editing.',
    `- "garment" — the exact catalog product: ${descriptor}. This is your ONLY visual`,
    '  source of truth for the clothing. Reproduce it exactly as it appears.',
    '',
    `TASK: Dress the customer in the garment above. Place it on ${region}.`,
    garmentDescription ? `Product description: ${garmentDescription}` : '',
    promptHint ? `Visual reference notes: ${promptHint}` : '',
    '',
    '══ PRIORITY 1 — EXACT GARMENT REPRODUCTION ══',
    '- The "garment" image IS the product. Copy its exact colour, pattern (checks,',
    '  stripes, plaid, print), texture, weave, sheen, buttons, lapels, collar shape,',
    '  pocket placement, hem length and silhouette directly from that reference image.',
    '- DO NOT substitute a similar-looking garment from your training knowledge.',
    '- DO NOT simplify a patterned/checked/plaid fabric into a plain solid colour.',
    '- DO NOT change the colour. A navy check must remain a navy check, not plain navy.',
    '- DO NOT invent details not visible in the garment reference.',
    '- The customer will receive the real product — any visual mismatch causes a return.',
    '',
    '══ PRIORITY 2 — CUSTOMER FIDELITY ══',
    '- Preserve the customer exactly: face, skin tone, hair, pose, body proportions.',
    '- Never borrow the catalog model\'s appearance from the garment image.',
    '- Never slim, reshape or repose the customer. Fit the clothes to the body.',
    '- Fully replace the clothing in the specified region. No fringe of the old outfit',
    '  may survive at the neckline, cuffs, hem, shoulders or waist.',
    '- Leave the background, lighting, footwear and accessories unchanged.',
    '- Match the existing lighting direction and colour temperature.',
    '',
    'Output only the edited photograph. No captions or commentary.',
  ];


  return lines.filter((line) => line !== '').join('\n');
}
