import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import Button from "@/app/components/button";
import Container from "@/app/components/container";
import FeaturedCourtGrid, { FeaturedCourtGridSkeleton } from "@/app/components/featured-court-grid";

type IconKind = "search" | "calendar" | "check" | "bolt" | "clock" | "court";

function Icon({ kind }: { kind: IconKind }) {
  const paths: Record<IconKind, React.ReactNode> = {
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
    calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M7.5 3v4M16.5 3v4M3.5 9.5h17" /><path d="m9 14 2 2 4-4" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16.5 9" /></>,
    bolt: <path d="M13 2 4 13h6l-1 9 11-13h-7V2Z" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    court: <><rect x="3.5" y="4" width="17" height="16" rx="1" /><path d="M12 4v16M3.5 12h17M8 4v16M16 4v16" /></>,
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-6"
    >
      {paths[kind]}
    </svg>
  );
}

const steps: { number: string; title: string; description: string; icon: IconKind }[] = [
  {
    number: "01",
    title: "Explore Courts",
    description: "Browse our selection of indoor and outdoor pickleball courts to find the right place to play.",
    icon: "search",
  },
  {
    number: "02",
    title: "Choose Your Time",
    description: "Pick your preferred date and time, then review the court's hourly rate.",
    icon: "calendar",
  },
  {
    number: "03",
    title: "Book Your Court",
    description: "Review your booking details in the demo booking flow. No real reservation is created.",
    icon: "check",
  },
];

const benefits: { title: string; description: string; icon: IconKind }[] = [
  {
    title: "Easy Court Discovery",
    description: "Explore court options in one place and compare what fits your game.",
    icon: "bolt",
  },
  {
    title: "Flexible Scheduling",
    description: "Choose a time that works for you, your friends, and your game.",
    icon: "clock",
  },
  {
    title: "Simple Booking Experience",
    description: "Choose a court and review your booking details in a straightforward flow.",
    icon: "court",
  },
];

export default function Home() {
  return (
    <main className="flex-1">
      <section aria-labelledby="hero-title" className="relative isolate flex min-h-[610px] overflow-hidden bg-primary sm:min-h-[680px] lg:min-h-[740px]">
        <Image
          src="/img/hero.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover object-[62%_center]"
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(8,34,29,0.96)_0%,rgba(8,34,29,0.88)_32%,rgba(8,34,29,0.48)_62%,rgba(8,34,29,0.08)_100%)] max-md:bg-[linear-gradient(90deg,rgba(8,34,29,0.88)_0%,rgba(8,34,29,0.68)_62%,rgba(8,34,29,0.34)_100%)]" />
        <Container className="relative flex w-full items-center py-16 sm:py-20 lg:py-24">
          <div className="max-w-3xl">
            <p className="flex items-center gap-3 text-xs font-bold tracking-[0.24em] text-white sm:text-sm">
              <span aria-hidden="true" className="h-0.5 w-11 bg-accent" />
              PICKLEBALL COURT BOOKING
            </p>
            <h1 id="hero-title" className="mt-6 text-5xl font-extrabold leading-[0.98] tracking-[-0.055em] text-white sm:text-6xl md:text-7xl lg:text-[5.5rem]">
              <span className="block">Your Court.</span>
              <span className="mt-1 block text-accent">Your Game.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/90 sm:mt-7 sm:text-lg sm:leading-8 lg:text-xl">
              Find and book quality pickleball courts near you. Enjoy a simple way to discover courts, choose your schedule, and get on the court.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:items-center">
              <Button href="/courts" className="gap-3 rounded-2xl bg-accent px-7 py-3 text-base font-bold text-primary shadow-lg shadow-black/15 hover:bg-[#d4f695] focus-visible:outline-accent">
                Explore Courts
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Button>
              <Button href="#how-it-works" variant="secondary" className="gap-3 rounded-2xl border-white/75 bg-primary/20 px-7 py-3 text-base font-semibold text-white backdrop-blur-sm hover:border-white hover:bg-white/10 hover:text-white focus-visible:outline-white">
                How It Works
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
                  <path d="M12 5v14M6 13l6 6 6-6" />
                </svg>
              </Button>
            </div>
          </div>
        </Container>
      </section>

      <section aria-labelledby="featured-title" className="border-y border-border/70 bg-white py-16 sm:py-20 lg:py-24">
        <Container>
          <div className="mb-4 grid gap-6 sm:mb-12 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-8 lg:mb-8">
            <div className="max-w-2xl">
              <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary sm:text-sm">
                <span aria-hidden="true" className="h-0.5 w-9 rounded-full bg-accent" />
                Find Your Next Game
              </p>
              <h2 id="featured-title" className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight text-primary sm:text-5xl lg:text-6xl">
                Featured <span className="text-[#5C9142]">Courts.</span>
              </h2>
              <p className="mt-4 max-w-[600px] text-base leading-7 text-muted sm:mt-5 sm:text-lg sm:leading-8">
                Discover great places to play. Explore available pickleball courts and find the perfect spot for your next match. Court status means it can accept bookings; a specific time is confirmed when you book.
              </p>
            </div>
            <Link
              href="/courts"
              className="group inline-flex min-h-11 w-fit items-center gap-2 rounded-full px-1 text-sm font-bold text-primary transition-colors hover:text-[#5C9142] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary md:mb-1 md:justify-self-end sm:text-base"
            >
              View All Courts
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
                <path d="M7 17 17 7M8 7h9v9" />
              </svg>
            </Link>
          </div>
          <Suspense fallback={<FeaturedCourtGridSkeleton />}>
            <FeaturedCourtGrid />
          </Suspense>
        </Container>
      </section>

      <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-24 bg-[#f8faf7] py-16 sm:py-20 lg:py-24">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5c9142] sm:text-sm">Simple. Fast. Easy.</p>
            <h2 id="how-title" className="mt-3 text-4xl font-extrabold leading-[1.05] tracking-tight text-primary sm:text-5xl">
              How It <span className="text-[#5C9142]">Works.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
              Getting on the court is simple. Follow three easy steps to plan your next pickleball game.
            </p>
          </div>
          <div className="mt-10 grid items-stretch gap-5 sm:mt-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {steps.map((step) => (
              <article key={step.number} className="flex h-full flex-col rounded-2xl border border-[#e5eae5] bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-soft sm:p-7 lg:p-8">
                <div className="flex items-center justify-between gap-4">
                  <span className="grid size-14 place-items-center rounded-2xl bg-[#eff8dc] text-primary" aria-hidden="true">
                    <Icon kind={step.icon} />
                  </span>
                  <span className="text-sm font-bold tracking-[0.12em] text-[#5c9142]">{step.number}</span>
                </div>
                <h3 className="mt-6 text-xl font-bold tracking-tight text-primary">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted sm:text-base">{step.description}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section aria-labelledby="benefits-title" className="bg-primary py-20 sm:py-24 lg:py-28">
        <Container>
          <div className="max-w-3xl">
            <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent sm:text-sm">
              <span aria-hidden="true" className="h-0.5 w-9 rounded-full bg-accent" />
              Why PickleCourt
            </p>
            <h2 id="benefits-title" className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              More Playing. <span className="text-accent">Less Planning.</span>
            </h2>
            <p className="mt-5 max-w-[650px] text-base leading-7 text-[#D1E2DB] sm:mt-6 sm:text-lg sm:leading-8">
              Finding a place to play should be easy. PickleCourt brings court discovery and scheduling together in one simple experience, so you can spend less time planning and more time on the court.
            </p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3 lg:mt-14">
            {benefits.map((benefit) => (
              <article key={benefit.title} className="rounded-card border border-white bg-white/85 p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-soft sm:p-8">
                <span className="grid size-12 place-items-center rounded-xl bg-accent/50 text-primary" aria-hidden="true">
                  <Icon kind={benefit.icon} />
                </span>
                <h3 className="mt-5 text-lg font-bold text-foreground">{benefit.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{benefit.description}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section aria-labelledby="cta-title" className="bg-[#f8faf7] py-16 sm:py-20 lg:py-24">
        <Container>
          <div className="relative isolate overflow-hidden rounded-[1.75rem] bg-primary px-6 py-14 text-center shadow-[0_24px_60px_rgba(22,74,65,0.2)] sm:rounded-[2rem] sm:px-12 sm:py-20 lg:px-16 lg:py-24">
            <div aria-hidden="true" className="absolute -right-20 -top-28 -z-10 size-80 rounded-full border border-white/10 sm:size-[26rem]" />
            <div aria-hidden="true" className="absolute -bottom-40 -left-20 -z-10 size-80 rounded-full border-[36px] border-accent/10 sm:size-[28rem]" />
            <p className="relative flex items-center justify-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent sm:text-sm">
              <span aria-hidden="true" className="h-0.5 w-8 rounded-full bg-accent" />
              Your Next Game Starts Here
            </p>
            <h2 id="cta-title" className="relative mx-auto mt-5 max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Ready to Get <span className="text-accent">in the Game?</span>
            </h2>
            <p className="relative mx-auto mt-5 max-w-[550px] text-base leading-7 text-white/80 sm:mt-6 sm:text-lg sm:leading-8">
              Find your next pickleball court, choose a time that works for you, and get ready to play.
            </p>
            <Button href="/courts" variant="secondary" className="mt-6 gap-3 rounded-2xl border-white/75 bg-primary/20 px-7 py-3 text-base font-semibold text-white backdrop-blur-sm hover:border-white hover:bg-white/10 hover:text-white focus-visible:outline-white">
              Explore Courts
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
                <path d="M7 17 17 7M8 7h9v9" />
              </svg>
            </Button>
          </div>
        </Container>
      </section>
    </main>
  );
}
