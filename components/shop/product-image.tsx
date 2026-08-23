"use client";

import { useState } from "react";

/**
 * Supplier images are hotlinked from the you.dk CDN for now. The dev brief's
 * integration layer mirrors them into our own storage — until then a supplier
 * CDN outage or hotlink protection would leave empty frames, so every image
 * falls back to a drawn placeholder rather than a broken icon.
 */
const PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="550">
       <rect width="440" height="550" fill="#f4f2ed"/>
       <text x="220" y="280" font-family="system-ui,sans-serif" font-size="15"
             fill="#98a3aa" text-anchor="middle">Billede ikke tilgængeligt</text>
     </svg>`,
  );

export function ProductImage({
  src,
  alt,
  className = "",
  sizes,
}: {
  src: string | null;
  alt: string;
  className?: string;
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    /* eslint-disable-next-line @next/next/no-img-element --
       next/image is the wrong tool here for now. These are hotlinked supplier
       URLs on the you.dk CDN, so the optimiser would fetch and cache 1,300+
       third-party images we do not control and may be blocked from. Once the
       integration layer mirrors them into our own storage (dev brief §9.2),
       switch this to next/image. */
    <img
      src={failed || !src ? PLACEHOLDER : src}
      alt={alt}
      loading="lazy"
      decoding="async"
      sizes={sizes}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
