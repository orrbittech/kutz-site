/** Canonical site origin for metadata, sitemap, and JSON-LD (no trailing slash). */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
}
