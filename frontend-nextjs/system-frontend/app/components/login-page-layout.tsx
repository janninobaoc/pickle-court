import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import Container from "./container";

type AuthSplitLayoutProps = {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  footer: ReactNode;
  demoNotice?: string;
};

export default function AuthSplitLayout({
  children, eyebrow, title, description, footer, demoNotice,
}: AuthSplitLayoutProps) {
  return (
    <main className="flex flex-1 items-center py-8 sm:py-12">
      <Container className="max-w-6xl">
        <div className="grid overflow-hidden rounded-3xl border border-border bg-white shadow-soft lg:min-h-[650px] lg:grid-cols-2">
          <aside className="relative isolate hidden min-h-[650px] flex-col overflow-hidden bg-[#164A41] p-8 text-white sm:p-10 lg:flex lg:p-11 xl:p-12">
            <Image
              src="/img/hero.png"
              alt=""
              fill
              priority
              sizes="(min-width: 1280px) 560px, (min-width: 1024px) 50vw, 100vw"
              className="object-cover object-center"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 z-0 bg-gradient-to-b from-[#103B34]/85 via-[#164A41]/75 to-[#164A41]/80"
            />

            <Link href="/" aria-label="PickleCourt home" className="relative z-10 inline-flex w-fit items-center gap-3 rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C5F277]">
              <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-white shadow-[0_6px_20px_rgba(7,35,31,0.2)]">
                <Image src="/img/logo.png" alt="" width={48} height={48} priority className="size-full object-contain" />
              </span>
              <span className="text-xl font-bold tracking-tight">PickleCourt</span>
            </Link>

            <div className="relative z-10 flex flex-1 flex-col justify-center py-12">
              <h2 className="text-4xl font-extrabold leading-[0.98] tracking-[-0.04em] text-[#F8FAF7] lg:text-[3.25rem] xl:text-6xl">
                <span className="block">Your Court.</span>
                <span className="mt-2 block text-[#C5F277]">Your Game.</span>
              </h2>
              <p className="mt-5 max-w-sm text-base leading-7 text-white/90">
                Find your court, book your time, and get back to the game.
              </p>
            </div>
          </aside>

          <section className="flex items-center justify-center p-6 sm:p-10 lg:p-12">
            <div className="w-full max-w-md">
              <header>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#5C9142]">{eyebrow}</p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#164A41] sm:text-4xl">{title}</h1>
                <p className="mt-3 text-sm leading-6 text-[#64748B]">{description}</p>
              </header>
              {demoNotice && (
                <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {demoNotice}
                </p>
              )}
              <div className="mt-8">{children}</div>
              <div className="mt-7 border-t border-border pt-5 text-center text-sm text-[#64748B]">{footer}</div>
            </div>
          </section>
        </div>
      </Container>
    </main>
  );
}
