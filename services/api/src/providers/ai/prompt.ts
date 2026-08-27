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
    'You are producing a virtual try-on for a clothing retailer: showing a customer how a',
    'garment from the shop\'s stock would look on them, before they change into it.',
    '',
    'The input image named "customer" is the customer — that is the photograph you are',
    'editing. The input image named "garment" is the garment from the shop\'s stock.',
    '',
    'Dress the customer in this garment:',
    `${descriptor}. Put this on ${region}.${garmentDescription ? ` ${garmentDescription}` : ''}`,
    promptHint ? `Styling notes for this piece: ${promptHint}` : '',
    '',
    'ABSOLUTE REQUIREMENTS:',
    '- THE GARMENT REFERENCE IS USUALLY A CATALOGUE PHOTO WORN BY A DIFFERENT MODEL.',
    '  Take ONLY the garment from that image. Never transfer that model\'s face, skin tone,',
    '  hair, hands, body or build into the output. The only person in the output is the',
    '  customer from the "customer" image.',
    '- PRESERVE THE CUSTOMER EXACTLY. Their face, facial structure, skin tone, expression,',
    '  hair, pose, hands, height and body proportions must stay pixel-faithful to the',
    '  "customer" image. This is the single most important requirement and it outranks',
    '  making the garment look good.',
    '- NEVER RESHAPE THE CUSTOMER TO SUIT THE GARMENT. Do not slim them, lengthen their legs,',
    '  narrow their waist or shoulders, lighten their skin, or alter their figure in any way.',
    '  Fit the CLOTHES to the BODY, never the body to the clothes. If the garment would sit',
    '  differently on this person than on a catalogue model, show it sitting differently —',
    '  that honesty is the entire point of the preview.',
    '- FULLY REPLACE THE CLOTHING THEY ARE CURRENTLY WEARING, except where the garment above',
    '  is explicitly an outer layer, which goes OVER what they have on. This is a change of',
    '  outfit, not a layer painted on top of the old one. No part of the original outfit may',
    '  remain visible — check the neckline, cuffs, hemline, shoulders and waist especially,',
    '  where the previous clothing tends to survive as a fringe or an outline.',
    '- REPRODUCE THE GARMENT FAITHFULLY. Match its colour, weave, knit, rib, sheen, print',
    '  scale, motif placement and border exactly as they appear in the reference. Do not',
    '  invent embroidery or surface texture, re-scale a print, change a border, or substitute',
    '  a similar design. Keep its silhouette and length: a mini stays a mini, a floor-length',
    '  stays floor-length, and a train, slit, asymmetric hem or overskirt survives at the same',
    '  proportions — do not convert an unusual cut into a conventional one. The customer will',
    '  be handed the real garment straight after seeing this image, and any mismatch is a',
    '  lost sale.',
    '- DRAPE IT PHYSICALLY CORRECTLY for the fabric shown: stiff silks and satins hold',
    '  structure and sharp pleats, wool holds a tailored line, denim is rigid, chiffon and',
    '  georgette fall soft and close, net and organza stand away from the body, jersey and',
    '  knit cling. Pleats, folds and the fall of a hem must follow the actual pose.',
    '- Leave the background, lighting, footwear and any jewellery being worn untouched.',
    '- Match the photograph\'s existing lighting direction and colour temperature, with fabric',
    '  shadows and highlights that agree with it.',
    '- If the pose hides part of the garment, keep the pose and show the garment partially',
    '  occluded. Never rotate or re-pose the customer to display the clothing better.',
    '',
    'Output the edited photograph only.',
  ];

  return lines.filter((line) => line !== '').join('\n');
}
