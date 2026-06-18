import type { NextConfig } from "next";

// GitHub Pages serves the site under `https://<user>.github.io/<repo>/` —
// configure basePath/assetPrefix so all asset URLs resolve correctly.
// Override with `NEXT_PUBLIC_BASE_PATH=""` for local dev / preview builds.
const repoBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/react-doctor";

const nextConfig: NextConfig = {
  // GitHub Pages is static-only; emit a fully static `out/` tree.
  output: "export",
  trailingSlash: true,
  // GH Pages doesn't run Next's image optimizer, so all `<Image>` URLs must
  // resolve without on-the-fly resizing.
  images: { unoptimized: true },
  basePath: repoBasePath || undefined,
  assetPrefix: repoBasePath || undefined,
  // Expose the base path to client-side code that needs to build URLs.
  env: { NEXT_PUBLIC_BASE_PATH: repoBasePath ?? "" },
  // `headers()` and `rewrites()` are runtime-only and would crash a static
  // export — they belong on the upstream Vercel deploy, not on GH Pages.
};

export default nextConfig;
