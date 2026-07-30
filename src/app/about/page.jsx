import Link from "next/link";
import { TRIAL_DURATION_LABEL } from "@/config/product";

export const metadata = {
  title: "About | Lankan Web Directory",
  description:
    "Learn how Lankan Web Directory helps Sri Lankan businesses build a simple online presence and be discovered.",
};

const steps = [
  {
    number: "01",
    title: "Create your account",
    description:
      "Register in a few minutes. You do not need technical knowledge or a web developer to get started.",
  },
  {
    number: "02",
    title: "Tell your story",
    description:
      "Add your business details, services, images and contact information using one straightforward workspace.",
  },
  {
    number: "03",
    title: "Share your page",
    description:
      "Publish a professional mini website and use its link wherever your customers already find you.",
  },
];

const values = [
  {
    title: "Built for local business",
    description:
      "Designed around the practical needs of Sri Lankan entrepreneurs, independent professionals and growing teams.",
  },
  {
    title: "Simple by design",
    description:
      "Clear tools and useful guidance help you get online without wrestling with complicated website software.",
  },
  {
    title: "A stronger community",
    description:
      "Every quality listing makes it easier to discover and support businesses operating across Sri Lanka.",
  },
];

export default function AboutPage() {
  return (
    <main className="overflow-hidden bg-[#fffaf7] text-[#211b18]">
      <section className="relative border-b border-red-100">
        <div
          className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#BF283B]/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-36 -left-24 h-80 w-80 rounded-full bg-amber-200/30 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 min-[360px]:px-5 sm:px-6 sm:py-28 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <p className="mb-5 text-sm font-bold uppercase tracking-[0.22em] text-[#BF283B]">
              About Lankan Web Directory
            </p>
            <h1 className="max-w-3xl text-4xl font-bold leading-[1.08] tracking-[-0.035em] sm:text-6xl">
              Helping Sri Lankan businesses be{" "}
              <span className="text-[#BF283B]">seen, trusted and chosen.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-stone-600 sm:mt-7 sm:text-lg sm:leading-8">
              A good business deserves a clear place online. We make it easier
              to create a professional mini website, share what you offer and
              connect with more customers—without the usual cost or complexity
              of building a website from scratch.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-xl bg-[#BF283B] px-6 py-3.5 font-semibold text-white shadow-lg shadow-red-900/10 transition hover:-translate-y-0.5 hover:bg-[#a32131]"
              >
                Start your free trial
              </Link>
              <Link
                href="/#featured-listings"
                className="inline-flex items-center justify-center rounded-xl border border-stone-300 bg-white px-6 py-3.5 font-semibold text-stone-700 transition hover:border-[#BF283B] hover:text-[#BF283B]"
              >
                Explore local businesses
              </Link>
            </div>
          </div>

          <div className="mx-auto w-full max-w-md">
            <div className="rounded-3xl bg-[#211b18] p-6 text-white shadow-2xl shadow-stone-900/20 sm:rounded-[2rem] sm:p-9">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-300">
                Our purpose
              </p>
              <p className="mt-5 text-xl font-semibold leading-8 sm:mt-6 sm:text-2xl sm:leading-9">
                To give every Sri Lankan business a confident first step
                online.
              </p>
              <div className="my-6 h-px bg-white/15 sm:my-8" />
              <p className="text-sm leading-6 text-stone-300 sm:text-base sm:leading-7">
                From a home-based maker to an established service company, we
                believe being discoverable online should be practical,
                affordable and within reach.
              </p>
              <div className="mt-6 flex flex-col gap-1 rounded-2xl bg-[#BF283B] px-5 py-4 text-white sm:mt-8 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-red-100">
                  Made for
                </p>
                <p className="font-bold">Sri Lankan enterprise</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 min-[360px]:px-5 sm:px-6 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#BF283B]">
              Why we exist
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Your work is the hard part. Getting online should not be.
            </h2>
          </div>
          <div className="space-y-5 text-lg leading-8 text-stone-600">
            <p>
              Across Sri Lanka, valuable businesses still depend mainly on
              word of mouth and social media posts. Those channels matter, but
              customers also need one reliable place to understand a business,
              see its services and find the right contact details.
            </p>
            <p>
              Lankan Web Directory brings those essentials together. It gives
              business owners a focused page they can manage themselves and
              gives customers a growing directory of local businesses to
              explore.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 min-[360px]:px-5 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#BF283B]">
              How it works
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              From idea to online in three simple steps
            </h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {steps.map((step) => (
              <article
                key={step.number}
                className="rounded-2xl border border-stone-200 bg-[#fffaf7] p-6 transition hover:-translate-y-1 hover:border-red-200 hover:shadow-xl hover:shadow-stone-900/5 sm:p-7"
              >
                <span className="text-sm font-bold tracking-[0.2em] text-[#BF283B]">
                  {step.number}
                </span>
                <h3 className="mt-8 text-xl font-bold">{step.title}</h3>
                <p className="mt-3 leading-7 text-stone-600">
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 min-[360px]:px-5 sm:px-6 sm:py-24">
        <div className="overflow-hidden rounded-3xl bg-[#BF283B] text-white shadow-2xl shadow-red-900/15 sm:rounded-[2rem]">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
            <div className="flex items-center justify-center bg-[#a32131] px-5 py-9 sm:px-12 sm:py-12">
              <div className="text-center lg:text-left">
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-red-100">
                  Time to explore
                </p>
                <p className="mt-3 text-4xl font-bold min-[360px]:text-5xl sm:text-7xl">
                  {TRIAL_DURATION_LABEL}
                </p>
                <p className="mt-2 text-red-100">free trial</p>
              </div>
            </div>
            <div className="px-5 py-9 min-[360px]:px-6 sm:px-12 sm:py-12">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Try it properly before you decide.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-red-50 sm:text-lg sm:leading-8">
                Build your page, publish it and see how it supports your
                business during a {TRIAL_DURATION_LABEL} trial. It is enough
                time to learn the tools, share your page and judge the value
                for yourself.
              </p>
              <p className="mt-4 text-sm leading-6 text-red-100">
                Trial length is subject to the offer available when you
                register. We will always show your trial end date clearly in
                your account.
              </p>
              <Link
                href="/register"
                className="mt-8 inline-flex items-center justify-center rounded-xl bg-white px-6 py-3.5 font-bold text-[#BF283B] transition hover:-translate-y-0.5 hover:bg-red-50"
              >
                Create your business page
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#211b18] py-20 text-white sm:py-24">
        <div className="mx-auto max-w-6xl px-4 min-[360px]:px-5 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-red-300">
              What guides us
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Useful first. Local always.
            </h2>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {values.map((value) => (
              <article key={value.title} className="border-t border-white/20 pt-6">
                <h3 className="text-xl font-bold">{value.title}</h3>
                <p className="mt-3 leading-7 text-stone-300">
                  {value.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-16 text-center min-[360px]:px-5 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#BF283B]">
            Your business belongs online
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
            Let more people discover what you do.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-stone-600">
            Join a growing home for Sri Lankan businesses and create a page you
            will be proud to share.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex items-center justify-center rounded-xl bg-[#BF283B] px-7 py-4 font-semibold text-white shadow-lg shadow-red-900/10 transition hover:-translate-y-0.5 hover:bg-[#a32131]"
          >
            Start your free trial
          </Link>
        </div>
      </section>
    </main>
  );
}
