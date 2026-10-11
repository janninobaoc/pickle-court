import Image from "next/image";
import Container from "./container";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-[#164A41] text-[#F8FAF7]">
      <Container className="py-8 sm:py-9">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
          <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white"
              >
                <Image
                  src="/img/logo.png"
                  alt=""
                  width={40}
                  height={40}
                  className="size-full object-contain"
                />
              </span>
              <span className="text-lg font-extrabold tracking-tight text-[#F8FAF7]">
                PickleCourt
              </span>
            </div>

            <p className="mt-3 text-xl font-bold tracking-tight sm:text-2xl">
              <span className="text-[#F8FAF7]">Your Court.</span>{" "}
              <span className="text-[#C5F277]">Your Game.</span>
            </p>
            <p className="mt-2 max-w-md text-sm leading-6 text-[#F8FAF7]/75">
              Find your court, book your time, and get back to the game.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center gap-2 border-t border-[#F8FAF7]/20 pt-4 text-center text-xs text-[#F8FAF7]/70 sm:flex-row sm:justify-between sm:gap-4 sm:text-left">
          <p>© {currentYear} PickleCourt. All rights reserved.</p>
          <p>Built for the love of the game.</p>
        </div>
      </Container>
    </footer>
  );
}
