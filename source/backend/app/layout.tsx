import type { ReactNode } from 'react';

export const metadata = { title: 'S.D Factory Enc API', description: 'Secure API for S.D Factory Enc' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
