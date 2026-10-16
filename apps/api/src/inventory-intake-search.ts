import { mergeCatalogPickerEntries, type CatalogPickerEntry, type IntakeSearchResult } from "@ultimoturno/domain";

export async function inventoryIntakeSearch(catalog: () => Promise<{ entries: CatalogPickerEntry[] }>, local: () => Promise<CatalogPickerEntry[]>): Promise<IntakeSearchResult> {
  const [primary, fallback] = await Promise.allSettled([catalog(), local()]);
  if (primary.status === "rejected" && fallback.status === "rejected") throw new Error("No se pudo buscar en el catalogo ni en el inventario local. Volve a intentar.");
  if (primary.status === "rejected") return { entries: (fallback as PromiseFulfilledResult<CatalogPickerEntry[]>).value, warning: "No se pudo consultar el catalogo. Resultados del inventario local." };
  if (fallback.status === "rejected") return { entries: mergeCatalogPickerEntries(primary.value.entries, [], 30), warning: "No se pudo consultar el inventario local. Resultados del catalogo." };
  return { entries: mergeCatalogPickerEntries(primary.value.entries, fallback.value.slice(0, 30), 30) };
}
