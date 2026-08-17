import type { Metadata } from 'next';
import './styles.css';

export const metadata: Metadata = { title: 'Selene — Try On Studio', description: 'Frontend-only virtual try-on shopping experience.' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
