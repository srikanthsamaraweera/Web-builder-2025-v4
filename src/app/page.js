export const dynamic = "force-static";

import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-[70vh] flex items-center justify-center">
      <section className="max-w-3xl text-center space-y-6">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-red-600">
            web builder
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-red-700">
            Launch a polished one-page website in minutes
          </h1>
          <p className="text-gray-700">
            Craft and publish a responsive landing page without touching code.
            Start your free month, choose a template, and keep full control of
            your content.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/register"
            className="rounded bg-red-600 text-white px-6 py-2.5 font-medium hover:bg-red-700 w-full sm:w-auto"
          >
            Start free trial
          </Link>
          <Link
            href="/login"
            className="rounded border border-red-300 text-red-700 px-6 py-2.5 font-medium hover:bg-red-50 w-full sm:w-auto"
          >
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}

