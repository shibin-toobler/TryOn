/** Inline SVGs so the bundle has no icon-library dependency. */
const svg = (paths: string, size: number): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

export const icons = {
  sparkles: (size = 14) =>
    svg(
      '<path d="M9.9 2.1 8.6 6.3 4.4 7.6l4.2 1.3 1.3 4.2 1.3-4.2 4.2-1.3-4.2-1.3z"/><path d="M18 13l-.7 2.3-2.3.7 2.3.7.7 2.3.7-2.3 2.3-.7-2.3-.7z"/>',
      size,
    ),
  close: (size = 17) => svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', size),
  upload: (size = 15) =>
    svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 9l5-5 5 5"/><path d="M12 4v12"/>', size),
  imagePlus: (size = 26) =>
    svg(
      '<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/><path d="M18 2v6"/><path d="M15 5h6"/><circle cx="9" cy="9" r="2"/><path d="m21 15-4.5-4.5L7 20"/>',
      size,
    ),
  arrowRight: (size = 14) => svg('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>', size),
  refresh: (size = 14) =>
    svg('<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>', size),
  alert: (size = 20) =>
    svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16.5h.01"/>', size),
  trash: (size = 13) =>
    svg('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>', size),
  plus: (size = 18) => svg('<path d="M12 5v14"/><path d="M5 12h14"/>', size),
  minus: (size = 18) => svg('<path d="M5 12h14"/>', size),
  expand: (size = 15) =>
    svg('<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>', size),
  bag: (size = 14) =>
    svg('<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>', size),
};
