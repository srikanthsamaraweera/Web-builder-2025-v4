"use client";

import { usePathname } from "next/navigation";
import TopBar from "@/components/TopBar";

const HIDDEN_PATTERNS = [
  /^\/sites\/[^/]+\/preview1(?:\/.*)?$/,
  /^\/[^/]+\/t\d+(?:\/.*)?$/,
];

export default function TopBarWrapper() {
  const pathname = usePathname() || "";
  const shouldHide = HIDDEN_PATTERNS.some((pattern) => pattern.test(pathname));

  if (shouldHide) {
    return null;
  }

  return <TopBar />;
}
