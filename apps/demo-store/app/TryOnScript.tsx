'use client';

import Script from 'next/script';

const API_URL = process.env.NEXT_PUBLIC_TRYON_API_URL ?? 'http://localhost:4000';
const KEY = process.env.NEXT_PUBLIC_TRYON_KEY ?? '';

/**
 * The whole integration, from the merchant's side.
 *
 * A plain HTML store would write this by hand:
 *   <script async src="https://api.example.com/tryon.js" data-tryon-key="pk_…"></script>
 *
 * next/script is used here only so Next controls when it loads. Both values come
 * from apps/demo-store/.env.local, which `npm run seed` writes.
 */
export function TryOnScript() {
  if (!KEY) {
    return (
      <div
        style={{
          padding: '14px 18px',
          margin: '0 0 -1px',
          background: '#fdf3ef',
          borderBottom: '1px solid #e8d5cc',
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >
        <strong>Try-on plugin not configured.</strong> Run <code>npm run seed</code> at the repo
        root to create a merchant and write <code>apps/demo-store/.env.local</code>, then restart
        this dev server.
      </div>
    );
  }

  return (
    <Script
      src={`${API_URL}/tryon.js`}
      strategy="afterInteractive"
      data-tryon-key={KEY}
      data-tryon-api={API_URL}
    />
  );
}
