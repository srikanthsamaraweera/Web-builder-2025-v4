"use client";

import { usePathname } from "next/navigation";

const NO_PADDING_PATTERN = /^\/sites\/[^/]+\/preview1(?:\/.*)?$/;

export default function PageContainer({ children }) {
  const pathname = usePathname() || "";
  const noPadding = NO_PADDING_PATTERN.test(pathname);
  const baseClasses = "mx-auto ";
  const paddingClasses = "px-4 py-6 max-w-6xl";
  const classes = noPadding ? baseClasses : `${baseClasses} ${paddingClasses}`;

  return <main className={classes}>{children}</main>;
}
