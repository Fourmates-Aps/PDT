"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { Container, Eyebrow } from "@/components/landing/section";

export type HeroSlide = {
  /** A ready-to-use path — the server wrapper resolves the file extension. */
  image: string;
  title: string;
  /** Empty on their second slide, which is a headline and a button only. */
  body: string;
  cta: string;
  /** Already locale-prefixed by the server wrapper. */
  href: string;
};

export type HeroLabels = {
  eyebrow: string;
  previous: string;
  next: string;
  goTo: string;
  pause: string;
  play: string;
  label: string;
};

const INTERVAL_MS = 6000;

/**
 * The two-slide hero, crossfading the way theirs does.
 *
 * Three things their carousel does not do, all of which it needs:
 *
 *  - A PAUSE CONTROL. WCAG 2.2.2 requires any automatically moving content
 *    lasting more than five seconds to be pausable. A hero that rotates out from
 *    under someone mid-sentence is the canonical example.
 *  - RESPECT FOR `prefers-reduced-motion`. If the reader has asked the operating
 *    system to stop things moving, it does not start moving.
 *  - HIDING THE INACTIVE SLIDE. Faded-out content is still in the accessibility
 *    tree and still in the tab order, so without `inert` a keyboard user tabs
 *    into a button they cannot see and a screen reader reads both headlines as
 *    if they were one page.
 *
 * It also pauses on hover and on keyboard focus, because moving the thing
 * someone is reaching for is the same bug as moving the thing they are reading.
 *
 * With JavaScript off the first slide renders and its link works; only the
 * advancing is lost, which is the part that is decoration.
 */
export function HeroCarousel({
  slides,
  labels,
}: {
  slides: HeroSlide[];
  labels: HeroLabels;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const region = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  const advance = useCallback(() => {
    setIndex((current) => (current + 1) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (paused || reducedMotion || slides.length < 2) return;
    const timer = setInterval(advance, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [advance, paused, reducedMotion, slides.length]);

  // Pause while the pointer or focus is inside — but only report the pause
  // button's state for a DELIBERATE pause, so hovering does not make the button
  // claim the carousel is stopped.
  const autoPaused = paused || reducedMotion;

  return (
    <section
      ref={region}
      aria-roledescription="carousel"
      aria-label={labels.label}
      className="relative isolate overflow-hidden bg-ink-900"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!region.current?.contains(event.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
    >
      {/* Every slide occupies the same grid cell, so the band is as tall as the
          tallest one and nothing jumps as they change. */}
      <div className="grid">
        {slides.map((slide, i) => {
          const active = i === index;
          return (
            <div
              key={slide.image}
              className={`col-start-1 row-start-1 transition-opacity duration-700 ${
                active ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
              aria-hidden={!active}
              /*
               * `inert={!active}` — a real boolean, not an empty string.
               *
               * Passing `inert=""` (the pre-React-19 trick) makes React treat the
               * attribute as FALSE and warn about it, so the hidden slide stayed
               * in the tab order and the accessibility tree — the exact problem
               * this line exists to prevent. React 19 takes the boolean directly.
               */
              inert={!active}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${slides.length}`}
            >
              <Image
                src={slide.image}
                alt=""
                fill
                priority={i === 0}
                sizes="100vw"
                aria-hidden="true"
                className="-z-10 object-cover object-center"
              />
              <div
                className="absolute inset-0 -z-10 bg-gradient-to-r from-ink-900/95 via-ink-900/75 to-ink-900/25"
                aria-hidden="true"
              />

              <Container className="py-16 md:py-24 lg:py-28">
                <div className="max-w-[46ch]">
                  <Eyebrow tone="dark">{labels.eyebrow}</Eyebrow>
                  <div className="mt-4 h-0.75 w-14 rounded-sm bg-highvis-500" />
                  {/* Uppercased in CSS, not in the string — see the dictionary. */}
                  <h1 className="mt-6 text-display font-display font-bold uppercase text-balance text-bone-50">
                    {slide.title}
                  </h1>
                  {slide.body ? (
                    <p className="mt-6 max-w-[54ch] text-lead text-bone-50/80">
                      {slide.body}
                    </p>
                  ) : null}
                  <div className="mt-9">
                    <Link
                      href={slide.href}
                      className="inline-block rounded-md bg-highvis-500 px-6 py-3.5 text-[15px] font-semibold text-ink-900 transition-colors hover:bg-highvis-400"
                    >
                      {slide.cta}
                    </Link>
                  </div>
                </div>
              </Container>
            </div>
          );
        })}
      </div>

      {slides.length > 1 ? (
        <Container className="pointer-events-none absolute inset-x-0 bottom-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-pressed={autoPaused}
            aria-label={autoPaused ? labels.play : labels.pause}
            className="pointer-events-auto rounded-full border border-bone-50/30 p-1.5 text-bone-50/80 transition-colors hover:border-bone-50 hover:text-bone-50"
          >
            {autoPaused ? (
              <Play className="size-3.5" aria-hidden="true" />
            ) : (
              <Pause className="size-3.5" aria-hidden="true" />
            )}
          </button>

          <ul className="pointer-events-auto flex items-center gap-2">
            {slides.map((slide, i) => (
              <li key={slide.image}>
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={labels.goTo.replace("{n}", String(i + 1))}
                  aria-current={i === index}
                  className={`block size-2.5 rounded-full transition-colors ${
                    i === index
                      ? "bg-highvis-500"
                      : "bg-bone-50/40 hover:bg-bone-50/70"
                  }`}
                />
              </li>
            ))}
          </ul>
        </Container>
      ) : null}
    </section>
  );
}
