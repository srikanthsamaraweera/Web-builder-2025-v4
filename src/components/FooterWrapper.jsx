"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const HIDDEN_PATTERNS = [
  /^\/sites\/[^/]+\/preview1(?:\/.*)?$/,
  /^\/[^/]+\/t\d+(?:\/.*)?$/,
];

const footerLinks = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Privacy Policy", href: "#privacy-policy" },
  { label: "Contact", href: "#contact" },
];

export default function FooterWrapper() {
  const pathname = usePathname() || "";
  const shouldHide = HIDDEN_PATTERNS.some((pattern) => pattern.test(pathname));

  if (shouldHide) {
    return null;
  }

  return (
    <footer className="mt-16 border-t border-red-100 bg-[#1C1917] text-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-6 py-8 sm:flex-row">
        <nav aria-label="Footer navigation">
          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm">
            {footerLinks.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="text-gray-300 transition hover:text-white"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <p className="text-center text-sm text-gray-400 sm:text-right">
          &copy; {new Date().getFullYear()} Lankan Web Directory. All rights
          reserved.
        </p>
      </div>
    </footer>
  );
}
