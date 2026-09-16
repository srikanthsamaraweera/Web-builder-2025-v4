const LAST_UPDATED = "September 10, 2026";

export function PolicySection({ id, number, title, children }) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-stone-200 pt-9">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#BF283B]">
        {number}
      </p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#211b18] sm:text-3xl">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-base leading-7 text-stone-600">
        {children}
      </div>
    </section>
  );
}

export default function PolicyLayout({ eyebrow, title, introduction, sections, children }) {
  return (
    <main className="bg-[#fffaf7] text-[#211b18]">
      <header className="relative overflow-hidden border-b border-red-100">
        <div className="absolute -right-32 -top-40 h-96 w-96 rounded-full bg-[#BF283B]/10 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-4 py-14 min-[360px]:px-5 sm:px-6 sm:py-20">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#BF283B]">{eyebrow}</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-bold leading-[1.08] tracking-[-0.035em] sm:text-6xl">{title}</h1>
          <p className="mt-6 max-w-3xl text-base leading-7 text-stone-600 sm:text-lg sm:leading-8">{introduction}</p>
          <p className="mt-5 text-sm font-semibold text-stone-500">Last updated: {LAST_UPDATED}</p>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 min-[360px]:px-5 sm:px-6 sm:py-20 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
        <aside className="rounded-2xl bg-[#211b18] p-5 text-white lg:sticky lg:top-24">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-300">On this page</p>
          <nav className="mt-4" aria-label={`${title} sections`}>
            <ol className="space-y-1">
              {sections.map((section) => (
                <li key={section.id}><a href={`#${section.id}`} className="block rounded-lg px-3 py-2 text-sm leading-5 text-stone-300 transition hover:bg-white/10 hover:text-white">{section.label}</a></li>
              ))}
            </ol>
          </nav>
        </aside>
        <article className="min-w-0 space-y-10 rounded-3xl border border-stone-200 bg-white p-5 shadow-[0_18px_50px_rgba(31,26,24,0.06)] min-[360px]:p-6 sm:p-10">{children}</article>
      </div>
    </main>
  );
}
