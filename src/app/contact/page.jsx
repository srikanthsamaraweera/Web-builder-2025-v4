import Link from "next/link";

export const metadata = {
  title: "Contact | Lankan Web Directory",
  description:
    "Contact Lankan Web Directory for listing support, general questions and partnership enquiries.",
};

const CONTACT_EMAIL = "info@lankan.org";

const enquiryTypes = [
  {
    number: "01",
    title: "Listing support",
    description:
      "Need help creating, updating or publishing your business page? Tell us the email address linked to your account.",
  },
  {
    number: "02",
    title: "General questions",
    description:
      "Ask us about how the directory works, account access or whether Lankan Web Directory is right for your business.",
  },
  {
    number: "03",
    title: "Partnerships",
    description:
      "If you support Sri Lankan businesses and see an opportunity to work together, we would be glad to hear your idea.",
  },
];

export default function ContactPage() {
  return (
    <main className="overflow-hidden bg-[#fffaf7] text-[#211b18]">
      <section className="relative border-b border-red-100">
        <div
          className="absolute -right-32 -top-40 h-96 w-96 rounded-full bg-[#BF283B]/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-40 -left-28 h-80 w-80 rounded-full bg-amber-200/30 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 min-[360px]:px-5 sm:px-6 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#BF283B]">
              Contact Lankan Web Directory
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.08] tracking-[-0.035em] sm:text-6xl">
              Let&apos;s talk about{" "}
              <span className="text-[#BF283B]">your business.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-stone-600 sm:text-lg sm:leading-8">
              Whether you need help with a listing, have a question or want to
              explore a partnership, send us an email. We will make sure your
              message reaches the right person.
            </p>
          </div>

          <div className="rounded-3xl bg-[#211b18] p-6 text-white shadow-2xl shadow-stone-900/20 sm:rounded-[2rem] sm:p-9">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-300">
              Email us
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mt-5 block break-all text-2xl font-bold leading-tight text-white underline decoration-red-400 decoration-2 underline-offset-8 transition hover:text-red-200 min-[360px]:text-3xl"
            >
              {CONTACT_EMAIL}
            </a>
            <p className="mt-6 text-sm leading-6 text-stone-300 sm:text-base sm:leading-7">
              Include a short subject and any useful account or listing details
              so we can understand your enquiry quickly.
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=Lankan%20Web%20Directory%20enquiry`}
              className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-[#BF283B] px-5 py-3.5 font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#a32131] sm:w-auto"
            >
              Write an email
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 min-[360px]:px-5 sm:px-6 sm:py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#BF283B]">
            How we can help
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Start with the reason you&apos;re getting in touch.
          </h2>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {enquiryTypes.map((type) => (
            <article
              key={type.number}
              className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-7"
            >
              <span className="text-sm font-bold tracking-[0.2em] text-[#BF283B]">
                {type.number}
              </span>
              <h3 className="mt-7 text-xl font-bold">{type.title}</h3>
              <p className="mt-3 text-sm leading-6 text-stone-600 sm:text-base sm:leading-7">
                {type.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-white px-4 py-16 text-center min-[360px]:px-5 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight">
            Looking for a local business?
          </h2>
          <p className="mt-4 leading-7 text-stone-600">
            Browse the directory to discover currently active Sri Lankan
            businesses and visit their pages directly.
          </p>
          <Link
            href="/#featured-listings"
            className="mt-7 inline-flex items-center justify-center rounded-xl border border-stone-300 bg-white px-6 py-3.5 font-bold text-stone-700 transition hover:border-[#BF283B] hover:text-[#BF283B]"
          >
            Explore listed businesses
          </Link>
        </div>
      </section>
    </main>
  );
}
