/**
 * Product names and copy come from the merchant's catalog, so they are treated
 * as untrusted and escaped before they ever reach innerHTML.
 */
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Builds a detached element from a template string. */
export function fromHtml(html: string): HTMLElement {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild as HTMLElement;
}

export function on<K extends keyof HTMLElementEventMap>(
  root: ParentNode,
  selector: string,
  event: K,
  handler: (event: HTMLElementEventMap[K], element: HTMLElement) => void,
): void {
  root.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    element.addEventListener(event, (e) => handler(e as HTMLElementEventMap[K], element));
  });
}

export function formatPrice(amount: number, currency: string): string {
  if (!amount) return '';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}
