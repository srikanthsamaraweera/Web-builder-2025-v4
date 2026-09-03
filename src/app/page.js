import HeroAuthActions from "@/components/HeroAuthActions";
import {
  BASIC_DAILY_PRICE_LABEL,
  BASIC_MONTHLY_PRICE_LABEL,
  TRIAL_DURATION_LABEL,
} from "@/config/product";

const BENEFITS = [
  ["Ready in under 10 minutes", "Add your business details, choose a professional style, and review your website before publishing."],
  ["No technical knowledge needed", "There is no code, complicated page builder, or web-design terminology to learn."],
  ["Hosting is already included", "We handle the web hosting and mobile-friendly layout, so you can focus on your business."],
  ["Try before you pay", "Build and privately preview your website for free. Start your trial only when you are ready to publish."],
];

const STEPS = [
  ["Fill in your details", "Enter your business information, services, photos, opening hours, and contact details."],
  ["Choose your look", "Select a professional style, prominent colour, and light or dark theme."],
  ["Review and go live", "Check your website on desktop and mobile, then start your trial when you want to share it."],
];

export default function Home() {
  return (
    <main className="bg-[#fffaf7] text-[#211b18]">
      <section className="relative overflow-hidden border-b border-red-100">
        <div className="absolute -right-32 -top-48 h-96 w-96 rounded-full bg-[#BF283B]/10 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 min-[360px]:px-5 sm:px-6 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#BF283B]">
              Simple business website builder
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.08] tracking-[-0.035em] sm:text-5xl lg:text-6xl">
              Build your business website in{" "}
              <span className="text-[#BF283B]">under 10 minutes.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-stone-600 sm:text-lg sm:leading-8">
              No technical knowledge and no separate web hosting required. Just
              fill in a simple form, select a professional style, and publish
              when you are ready.
            </p>
            <HeroAuthActions />
            <p className="mt-4 text-sm font-medium text-stone-500">
              Build and preview for free. When you are ready to publish: {" "}
              <span className="font-bold text-[#211b18]">
                {BASIC_MONTHLY_PRICE_LABEL}/month
              </span>{" "}
              — about {BASIC_DAILY_PRICE_LABEL}/day, billed monthly.
            </p>
          </div>

          <aside className="w-full rounded-3xl bg-[#211b18] p-6 text-white shadow-2xl shadow-stone-900/15 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-300">From idea to online</p>
            <h2 className="mt-4 text-2xl font-bold leading-8 sm:text-3xl sm:leading-10">
              Everything your business page needs, without the usual complexity.
            </h2>
            <div className="mt-7 space-y-4">
              {["Enter your business information", "Select a ready-made website style", "Preview free, then publish when ready"].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#BF283B] text-sm font-bold" aria-hidden="true">✓</span>
                  <span className="text-sm font-semibold text-stone-100 sm:text-base">{item}</span>
                </div>
              ))}
            </div>
            <a href="#how-it-works" className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-red-300 transition hover:text-white">
              See how it works <span aria-hidden="true">↓</span>
            </a>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 min-[360px]:px-5 sm:px-6 sm:py-20">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#BF283B]">Designed for busy business owners</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Your website, made simple from the start.</h2>
          <p className="mt-3 text-base leading-7 text-stone-600">
            You provide the business information. The platform takes care of the layout, colours, mobile presentation, and hosting.
          </p>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {BENEFITS.map(([title, description], index) => (
            <article key={title} className="rounded-3xl border border-stone-200 bg-white p-6 transition hover:-translate-y-1 hover:border-red-200 hover:shadow-[0_20px_50px_rgba(31,26,24,0.08)]">
              <span className="text-xs font-bold tracking-[0.2em] text-[#BF283B]">0{index + 1}</span>
              <h3 className="mt-3 text-xl font-bold">{title}</h3>
              <p className="mt-2 leading-7 text-stone-600">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 border-y border-red-100 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 min-[360px]:px-5 sm:px-6 sm:py-20">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#BF283B]">Three easy steps</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Just fill, choose, and publish.</h2>
          </div>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {STEPS.map(([title, description], index) => (
              <article key={title} className="text-center md:text-left">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-lg font-bold text-[#BF283B] md:mx-0">{index + 1}</span>
                <h3 className="mt-4 text-xl font-bold">{title}</h3>
                <p className="mt-2 leading-7 text-stone-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 min-[360px]:px-5 sm:px-6 sm:py-20">
        <div className="rounded-3xl bg-[#211b18] px-6 py-10 text-center text-white shadow-2xl shadow-stone-900/10 sm:px-10 sm:py-14">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-300">Try it without pressure</p>
          <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
            Create your complete website before deciding to pay.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl leading-7 text-stone-300">
            Build and privately preview at no cost. When you are satisfied, start
            your {TRIAL_DURATION_LABEL} trial to publish and share your website.
          </p>
          <div className="mx-auto mt-6 w-fit rounded-2xl border border-white/15 bg-white/10 px-6 py-4">
            <p className="text-2xl font-bold text-white sm:text-3xl">
              {BASIC_MONTHLY_PRICE_LABEL}
              <span className="ml-1 text-base font-medium text-stone-300">/ month</span>
            </p>
            <p className="mt-1 text-sm text-stone-300">
              About {BASIC_DAILY_PRICE_LABEL} per day · billed monthly
            </p>
          </div>
          <HeroAuthActions
            guestLabel="Build my website free"
            userLabel="Create my website"
            showSignIn={false}
            className="justify-center"
          />
          <p className="mt-3 text-xs text-stone-400">No hosting setup. No technical skills required.</p>
        </div>
      </section>
    </main>
  );
}
