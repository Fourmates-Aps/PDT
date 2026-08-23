import type { ReactNode } from "react";

export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-[1200px] px-5 sm:px-8 ${className}`}>
      {children}
    </div>
  );
}

export function Eyebrow({
  children,
  tone = "light",
}: {
  children: ReactNode;
  tone?: "light" | "dark";
}) {
  return (
    <p
      className={`font-display text-eyebrow uppercase ${
        tone === "dark" ? "text-highvis-400" : "text-highvis-700"
      }`}
    >
      {children}
    </p>
  );
}

export function Section({
  id,
  children,
  tone = "background",
  className = "",
}: {
  id?: string;
  children: ReactNode;
  tone?: "background" | "surface" | "ink";
  className?: string;
}) {
  const tones = {
    background: "bg-bone-50 text-ink-800",
    surface: "bg-bone-100 text-ink-800",
    ink: "bg-ink-900 text-bone-50",
  };

  return (
    <section
      id={id}
      className={`scroll-mt-20 py-14 md:py-24 ${tones[tone]} ${className}`}
    >
      <Container>{children}</Container>
    </section>
  );
}

/** Heading block shared by every section, so vertical rhythm stays identical throughout. */
export function SectionHead({
  eyebrow,
  title,
  lead,
  tone = "light",
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  tone?: "light" | "dark";
}) {
  return (
    <header className="max-w-[46ch]">
      <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
      <h2
        className={`mt-3 text-h2 font-display font-semibold text-balance ${
          tone === "dark" ? "text-bone-50" : "text-ink-900"
        }`}
      >
        {title}
      </h2>
      {lead ? (
        <p
          className={`mt-4 text-lead text-pretty ${
            tone === "dark" ? "text-ink-300" : "text-ink-500"
          }`}
        >
          {lead}
        </p>
      ) : null}
    </header>
  );
}
