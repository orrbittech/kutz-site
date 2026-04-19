import { getSiteSettingsPublic } from '@/lib/server/get-site-settings';

function buildCss(theme: Awaited<ReturnType<typeof getSiteSettingsPublic>>['theme']): string {
  return `:root {
  --color-brand-brown: ${theme.brandBrown};
  --color-brand-cream: ${theme.brandCream};
  --color-brand-orange: ${theme.brandOrange};
  --color-brand-white: ${theme.brandWhite};
  --color-background: ${theme.background};
  --color-foreground: ${theme.foreground};
  --color-primary: ${theme.primary};
  --color-muted: ${theme.muted};
  --color-card: ${theme.card};
  --color-border: ${theme.border};
}`;
}

/** Server-only: injects theme CSS variables from API (falls back to defaults). */
export async function ThemeStyleTag(): Promise<React.JSX.Element> {
  const s = await getSiteSettingsPublic();
  return <style dangerouslySetInnerHTML={{ __html: buildCss(s.theme) }} />;
}
