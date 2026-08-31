const SECTION_DEFINITIONS = [
  { id: "hero", label: "Hero", enabled: true },
  { id: "services", label: "Products and Services", enabled: true },
  { id: "about", label: "About", enabled: true },
  { id: "gallery", label: "Gallery", enabled: true },
  { id: "openingHours", label: "Opening Hours", enabled: true },
  { id: "location", label: "Location", enabled: true },
  { id: "contact", label: "Contact", enabled: true },
  { id: "inquiry", label: "Inquiry Form", enabled: true },
];

export const SITE_SECTION_DEFINITIONS = Object.freeze(
  SECTION_DEFINITIONS.map((section) => Object.freeze({ ...section })),
);

const SECTION_BY_ID = new Map(
  SITE_SECTION_DEFINITIONS.map((section) => [section.id, section]),
);

export function createDefaultSiteSections() {
  return SITE_SECTION_DEFINITIONS.map(({ id, enabled }) => ({ id, enabled }));
}

export function normalizeSiteSections(sections) {
  if (!Array.isArray(sections)) return createDefaultSiteSections();

  const normalized = [];
  const included = new Set();

  for (const section of sections) {
    const id = typeof section?.id === "string" ? section.id.trim() : "";
    if (!SECTION_BY_ID.has(id) || included.has(id)) continue;

    normalized.push({
      id,
      enabled:
        typeof section.enabled === "boolean"
          ? section.enabled
          : SECTION_BY_ID.get(id).enabled,
    });
    included.add(id);
  }

  for (const definition of SITE_SECTION_DEFINITIONS) {
    if (included.has(definition.id)) continue;
    normalized.push({ id: definition.id, enabled: definition.enabled });
  }

  return normalized;
}

export function getSiteSectionDefinition(sectionId) {
  return SECTION_BY_ID.get(sectionId) || null;
}
