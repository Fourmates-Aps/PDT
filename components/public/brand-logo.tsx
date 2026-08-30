import Image from "next/image";

/**
 * The Profil Design Trading wordmark.
 *
 * The supplied logo file is one image: a light-grey wordmark next to the opaque
 * New Wave Profile badge. It is drawn for the live site's charcoal header, so on
 * our bone background the wordmark would be all but invisible.
 *
 * `public/images/brand/` therefore holds three files cut from that one source:
 * the wordmark as delivered (`wordmark-light`), the same artwork painted in
 * ink-900 through its own alpha channel (`wordmark-ink`), and the badge on its
 * own. Nothing was redrawn — the letterforms are the client's.
 *
 * next/image is safe here, unlike for product photography: these are local files
 * we control, so the optimiser has something to optimise.
 */
export function BrandLogo({
  tone,
  className = "",
}: {
  /** `ink` for light backgrounds, `light` for the dark footer. */
  tone: "ink" | "light";
  className?: string;
}) {
  return (
    <Image
      src={`/images/brand/wordmark-${tone}.webp`}
      alt="Profil Design Trading"
      width={372}
      height={118}
      priority={tone === "ink"}
      className={className}
    />
  );
}

/** The New Wave Profile badge — a partner mark, never a substitute for the logo. */
export function NewWaveBadge({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/images/brand/new-wave-badge.webp"
      alt="New Wave Profile"
      width={117}
      height={131}
      className={className}
    />
  );
}
