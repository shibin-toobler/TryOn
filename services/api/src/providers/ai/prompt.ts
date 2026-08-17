import { TryOnRequest } from './provider.interface';

const CATEGORY_INSTRUCTION: Record<string, string> = {
  dress: 'Replace whatever the person is currently wearing on their torso and legs with the dress.',
  top: 'Replace only the upper-body garment. Keep their existing trousers, skirt or shoes untouched.',
  bottom: 'Replace only the lower-body garment. Keep their existing top and shoes untouched.',
  outerwear: 'Layer the outerwear piece over the clothing the person already has on.',
  full_outfit: 'Replace the full outfit with the garment shown in the second image.',
};

/**
 * Prompt handed to the image model. The rules matter more than the prose here:
 * identity preservation is what separates a try-on from a generic edit.
 */
export function buildTryOnPrompt(request: TryOnRequest): string {
  const { garmentName, garmentColor, garmentDescription, category, promptHint } = request;

  const descriptor = [garmentColor, garmentName].filter(Boolean).join(' ');
  const lines = [
    'You are a virtual try-on engine for an online clothing store.',
    `The first image is a photograph of a real person. The second image is a product: ${descriptor}.`,
    garmentDescription ? `Product description: ${garmentDescription}` : '',
    '',
    'Produce a single photorealistic image of the SAME person from the first image wearing that exact garment.',
    '',
    'Rules:',
    `- ${CATEGORY_INSTRUCTION[category] ?? CATEGORY_INSTRUCTION.dress}`,
    "- Preserve the person's face, hair, skin tone, body proportions and pose exactly. They must remain recognisable as the same individual.",
    '- Keep the original background, lighting direction and camera framing.',
    '- Match the garment\'s colour, pattern, texture, neckline, sleeve length and hem precisely as shown in the product image.',
    '- Drape the fabric naturally over the body, with realistic folds and shadows consistent with the scene lighting.',
    '- Do not add text, watermarks, logos or extra people.',
    '- Do not slim, reshape, retouch or otherwise alter the body.',
    promptHint ? `- ${promptHint}` : '',
    '',
    'Output only the final photograph.',
  ];

  return lines.filter((line) => line !== '').join('\n');
}
