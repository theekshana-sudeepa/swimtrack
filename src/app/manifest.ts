import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SwimTrack — The Aquatic Control Room",
    short_name: "SwimTrack",
    description:
      "Personal swimming attendance platform, schedule manager, and participation analytics for squad practices.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#071B2B",
    theme_color: "#071B2B",
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
    ],
  };
}
