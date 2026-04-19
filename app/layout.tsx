import './globals.css';
import { Urbanist } from 'next/font/google';

const urbanist = Urbanist({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

/** Root document shell — required by Next.js; locale UI lives under `[locale]/layout.tsx`. */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactNode {
  return (
    <html lang="en">
      <body className={`${urbanist.variable} font-sans min-h-screen`}>{children}</body>
    </html>
  );
}
