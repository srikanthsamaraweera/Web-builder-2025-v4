"use client";

import { useParams } from "next/navigation";
import TemplateOnePreview from "@/components/templates/TemplateOnePreview";

export default function TemplateOneBySlugPage() {
  const params = useParams();
  const slugParam = Array.isArray(params?.slug) ? params.slug[0] : params?.slug ?? "";

  return <TemplateOnePreview identifier={slugParam} identifierType="slug" />;
}

