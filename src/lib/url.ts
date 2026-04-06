/**
 * Get the public-facing base URL for the app.
 * On Railway, req.url resolves to the internal address (0.0.0.0:8080).
 * This returns the proper public URL for redirects.
 */
export function getPublicUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  );
}

/**
 * Create a URL using the public base URL instead of req.url
 */
export function publicUrl(path: string): string {
  const base = getPublicUrl();
  return `${base}${path}`;
}
