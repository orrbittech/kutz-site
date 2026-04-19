import './globals.css';

/** Root pass-through — real document lives in `[locale]/layout.tsx` (next-intl). */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactNode {
  return children;
}
