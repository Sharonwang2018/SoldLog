import { LandingHero } from "@/components/features/landing-hero";
import { Footer } from "@/components/shared/footer";
import { Navbar } from "@/components/shared/navbar";

export default function Home() {
  return (
    <>
      <Navbar />
      <LandingHero />
      <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <h2 className="text-center font-display text-3xl font-semibold text-stone-900 dark:text-stone-100">
          Everything buyers expect — nothing they don&apos;t.
        </h2>
        <ul className="mt-12 grid gap-6 sm:grid-cols-3">
          {[
            {
              title: "Public profile",
              body: "A single URL for your bio, brokerage, and a grid of recent sales.",
            },
            {
              title: "Sold stories",
              body: "Each closing gets its own page, tuned for SMS, DMs, and fast loads.",
            },
            {
              title: "Verification",
              body: "Closing docs mark deals as verified so your book stays credible.",
            },
          ].map((f) => (
            <li
              key={f.title}
              className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-950"
            >
              <h3 className="font-display text-lg font-semibold text-stone-900 dark:text-stone-100">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
                {f.body}
              </p>
            </li>
          ))}
        </ul>
      </section>
      <section
        id="how-it-works"
        className="border-t border-stone-200/80 bg-stone-100/50 py-16 dark:border-stone-800 dark:bg-stone-900/30 sm:py-24"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center font-display text-3xl font-semibold text-stone-900 dark:text-stone-100">
            How it works
          </h2>
          <ol className="mx-auto mt-12 max-w-2xl list-decimal space-y-4 pl-5 text-stone-700 dark:text-stone-300">
            <li>Claim your handle (e.g. soldlog.com/jack-wang).</li>
            <li>Add sold records with photos and closing details.</li>
            <li>Share your profile or any sale — optimized for mobile.</li>
          </ol>
        </div>
      </section>
      <Footer />
    </>
  );
}
