import Link from "next/link";
import { notFound } from "next/navigation";
import Button from "@/app/components/button";
import Container from "@/app/components/container";
import CourtImage from "@/app/components/court-image";
import { getCourtById } from "@/app/lib/courts-api";
import { mapApiCourt } from "@/app/lib/court-mapper";
import { formatPeso } from "@/app/lib/booking-utils";

type CourtDetailsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CourtDetailsPage({ params }: CourtDetailsPageProps) {
  const { id } = await params;
  const apiCourt = await getCourtById(id);

  if (!apiCourt) {
    notFound();
  }

  const court = mapApiCourt(apiCourt);

  return (
    <main className="flex-1 pb-16 sm:pb-20">
      <Container className="pt-6 sm:pt-9">
        <nav aria-label="Breadcrumb" className="text-sm">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[#64748B]">
            <li><Link href="/" className="rounded hover:text-[#164A41] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#164A41]">Home</Link></li>
            <li aria-hidden="true" className="text-[#94A3B8]">/</li>
            <li><Link href="/courts" className="rounded hover:text-[#164A41] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#164A41]">Courts</Link></li>
            <li aria-hidden="true" className="text-[#94A3B8]">/</li>
            <li aria-current="page" className="max-w-48 truncate font-medium text-[#1F2937] sm:max-w-none">{court.name}</li>
          </ol>
        </nav>

        <Link
          href="/courts"
          className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-semibold text-[#164A41] transition-colors hover:text-[#5C9142] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#164A41] motion-reduce:transition-none"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4"><path d="m15 18-6-6 6-6M9 12h11" /></svg>
          Back to Courts
        </Link>

        <header className="mt-7 sm:mt-9">
          <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-[#5C9142] sm:text-sm">
            <span aria-hidden="true" className="h-0.5 w-8 rounded-full bg-[#C5F277]" />
            Court Details
          </p>
          <div className="mt-4 flex flex-col gap-4 sm:mt-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="break-words text-3xl font-extrabold leading-tight tracking-tight text-[#164A41] sm:text-4xl lg:text-5xl">{court.name}</h1>
              {court.location && (
                <p className="mt-3 flex items-center gap-2 text-sm text-[#64748B] sm:text-base">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5 shrink-0 text-[#164A41]"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></svg>
                  {court.location}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <span className="inline-flex min-h-8 items-center rounded-full bg-[#EAF2E8] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#164A41]">{court.category}</span>
              <span className={`inline-flex min-h-8 items-center rounded-full px-3 py-1 text-xs font-semibold ${court.available ? "bg-[#EDF7DF] text-[#245A32]" : "bg-slate-100 text-slate-700"}`}>
                Sample status: {court.available ? "Available" : "Unavailable"}
              </span>
            </div>
          </div>
        </header>

        <div className="mt-7 overflow-hidden rounded-2xl border border-[#E1E8E2] bg-white p-2 shadow-[0_12px_30px_rgba(22,74,65,0.08)] sm:mt-9 sm:rounded-3xl sm:p-3">
          <CourtImage
            src={court.image}
            alt={`${court.category} pickleball court at ${court.name}`}
            variant={court.artwork}
            className="aspect-[4/3] rounded-xl sm:aspect-[16/8] sm:rounded-2xl lg:aspect-[2.1/1]"
          />
        </div>
        <p className="mt-2 text-xs text-[#64748B]">Sample court photography.</p>

        <div className="mt-8 grid items-start gap-6 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
          <div className="min-w-0 space-y-6 sm:space-y-7">
            <section aria-labelledby="about-court" className="rounded-2xl border border-[#E1E8E2] bg-white p-5 shadow-[0_8px_24px_rgba(31,41,55,0.04)] sm:rounded-3xl sm:p-7">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5C9142]">Get to know the court</p>
              <h2 id="about-court" className="mt-2 text-xl font-bold tracking-tight text-[#164A41] sm:text-2xl">About This Court</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#64748B] sm:text-base">{court.description}</p>
              <dl className="mt-6 grid gap-3 border-t border-[#E1E8E2] pt-5 sm:grid-cols-2">
                <div className="rounded-xl bg-[#F8FAF7] p-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Court type</dt>
                  <dd className="mt-1 font-semibold text-[#164A41]">{court.category}</dd>
                </div>
                {court.location && <div className="rounded-xl bg-[#F8FAF7] p-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Location</dt>
                  <dd className="mt-1 font-semibold text-[#164A41]">{court.location}</dd>
                </div>}
              </dl>
              <p className="mt-5 rounded-xl border border-[#C5F277]/70 bg-[#F5F9ED] px-4 py-3 text-sm leading-6 text-[#355B4B]">
                Availability shown here is sample information only and is not verified in real time.
              </p>
            </section>

            <section aria-labelledby="amenities-title" className="rounded-2xl border border-[#E1E8E2] bg-white p-5 shadow-[0_8px_24px_rgba(31,41,55,0.04)] sm:rounded-3xl sm:p-7">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5C9142]">At the venue</p>
              <h2 id="amenities-title" className="mt-2 text-xl font-bold tracking-tight text-[#164A41] sm:text-2xl">Court Amenities</h2>
              {court.amenities.length > 0 ? (
                <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                  {court.amenities.map((amenity) => (
                    <li key={amenity} className="flex min-h-12 items-center gap-3 rounded-xl border border-[#E1E8E2] bg-[#FCFDFC] px-4 py-3">
                      <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-[#EAF2E8] text-[#164A41]">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4"><path d="m5 12 4 4L19 6" /></svg>
                      </span>
                      <span className="text-sm font-medium text-[#1F2937]">{amenity}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-4 text-sm leading-6 text-[#64748B]">No amenities are listed for this court.</p>}
            </section>

            <section aria-labelledby="hours-title" className="rounded-2xl border border-[#E1E8E2] bg-white p-5 shadow-[0_8px_24px_rgba(31,41,55,0.04)] sm:rounded-3xl sm:p-7">
              <div className="flex items-start gap-4">
                <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#EAF2E8] text-[#164A41]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5C9142]">Plan your visit</p>
                  <h2 id="hours-title" className="mt-1 text-xl font-bold tracking-tight text-[#164A41]">Operating Hours</h2>
                  <p className="mt-2 text-sm leading-6 text-[#1F2937]">{court.operatingHours}</p>
                  <p className="mt-1 text-xs leading-5 text-[#64748B]">Sample hours; please confirm with the venue.</p>
                </div>
              </div>
            </section>
          </div>

          <aside aria-label="Booking information" className="lg:sticky lg:top-28">
            <section className="overflow-hidden rounded-2xl border border-[#DCE7DC] bg-white shadow-[0_16px_40px_rgba(22,74,65,0.11)] sm:rounded-3xl">
              <div className="bg-[#164A41] px-5 py-6 text-white sm:px-6 sm:py-7">
                <p className="text-sm font-medium text-white/75">Court rental</p>
                <p className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
                  {formatPeso(court.pricePerHour)}
                  <span className="ml-1 text-sm font-medium text-white/75">/ hour</span>
                </p>
              </div>
              <div className="p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#5C9142]">Your next game</p>
                <h2 className="mt-2 text-lg font-bold leading-snug text-[#164A41]">{court.name}</h2>
                <p className="mt-2 text-sm text-[#64748B]">{court.category}{court.location ? ` · ${court.location}` : ""}</p>

                <div className="mt-5 rounded-xl bg-[#F8FAF7] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Operating hours</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#1F2937]">{court.operatingHours}</p>
                </div>

                <Button href={`/courts/${court.id}/book`} className="mt-5 min-h-12 w-full rounded-xl text-base font-bold">
                  Book This Court
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="ml-2 size-4"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </Button>
                <p className="mt-3 text-center text-xs leading-5 text-[#64748B]">
                  Booking is a demo preview. Sample availability is not verified and no reservation is confirmed.
                </p>
              </div>
            </section>
          </aside>
        </div>
      </Container>
    </main>
  );
}
