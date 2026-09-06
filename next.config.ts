import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep pdfkit unbundled so its built-in font (.afm) data files resolve from
  // node_modules at runtime instead of being broken by bundling.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
