"use client";

import { useParams } from "next/navigation";
import TemplateOnePreview from "@/components/templates/TemplateOnePreview";

export default function PreviewById() {
  const params = useParams();
  const siteId = Array.isArray(params?.id) ? params?.id[0] : params?.id ?? "";

  return <TemplateOnePreview identifier={siteId} identifierType="id" />;
}

