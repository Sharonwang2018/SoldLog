import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SoldLog",
    short_name: "SoldLog",
    description: "Agent showcase and sold records — add to your home screen for quick access.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#fafaf9",
    theme_color: "#1c1917",
    icons: [
      {
        src: "/icons/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
