"use client";

import { useParams } from "next/navigation";
import TemplateOnePreview from "@/components/templates/TemplateOnePreview";

export default function SiteBySlugPage() {
  const params = useParams();
  const routeSegment = Array.isArray(params?.slug) ? params.slug[0] : params?.slug ?? "";
  const slug = routeSegment.endsWith("-site")
    ? routeSegment.slice(0, -"-site".length)
    : "";

  return <TemplateOnePreview identifier={slug} identifierType="slug" />;
}
