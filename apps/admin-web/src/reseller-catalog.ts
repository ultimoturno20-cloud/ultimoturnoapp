export type ResellerCatalogItem = {
  inventoryItemId: string; sku: string; name: string; expansion: string; number: string;
  imageUrl: string; imageFallbackUrl?: string; language?: string; condition?: string; finish?: string; tags?: string;
  cardType?: 'pokemon' | 'supporter' | 'item' | 'stadium' | 'tool' | 'energy' | 'unknown';
  itemKind?: 'standard' | 'folder'; priceArs: number; availableQuantity?: number; remaining?: number; sellable?: number;
};
export type ResellerCatalogFilters = {
  search: string; languageGroup: string; expansion: string; language: string; condition: string;
  finish: string; tag: string; cardType: string; availability: string;
  sort: 'name' | 'expansion' | 'number' | 'price' | 'quantity';
};
export const defaultResellerCatalogFilters: ResellerCatalogFilters = {
  search: '', languageGroup: 'all', expansion: 'all', language: 'all', condition: 'all',
  finish: 'all', tag: 'all', cardType: 'all', availability: 'all', sort: 'name'
};
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function resellerCatalogTags(value = ''): string[] {
  return [...new Set(value.split(/[,;]+/).map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
}
export function filterResellerCatalog<T extends ResellerCatalogItem>(items: T[], filters: ResellerCatalogFilters): T[] {
  const tokens = normalize(filters.search).trim().split(/\s+/).filter(Boolean);
  const quantity = (item: T) => item.remaining ?? item.availableQuantity ?? 0;
  return items.filter((item) => {
    const language = normalize(item.language || '');
    const languageGroup = ['jp', 'ja', 'japanese', 'japones'].includes(language) ? 'japanese'
      : ['cn', 'zh', 'chs', 'cht', 'chinese', 'chino'].includes(language) ? 'chinese' : 'english';
    const identity = normalize([item.name, item.expansion, item.number, item.sku, item.language, item.condition, item.finish, item.tags].join(' '));
    return tokens.every((token) => identity.includes(token))
      && (filters.languageGroup === 'all' || filters.languageGroup === languageGroup)
      && (filters.expansion === 'all' || filters.expansion === item.expansion)
      && (filters.language === 'all' || filters.language === item.language)
      && (filters.condition === 'all' || filters.condition === item.condition)
      && (filters.finish === 'all' || filters.finish === item.finish)
      && (filters.tag === 'all' || resellerCatalogTags(item.tags).includes(filters.tag))
      && (filters.cardType === 'all' || (item.itemKind !== 'folder' && (item.cardType || 'unknown') === filters.cardType))
      && (filters.availability === 'all' || (filters.availability === 'sellable' ? (item.sellable ?? 0) > 0 : (item.sellable ?? 0) < quantity(item)));
  }).sort((left, right) => {
    let comparison = 0;
    if (filters.sort === 'price') comparison = right.priceArs - left.priceArs;
    if (filters.sort === 'quantity') comparison = quantity(right) - quantity(left);
    if (filters.sort === 'expansion') comparison = `${left.expansion} ${left.number}`.localeCompare(`${right.expansion} ${right.number}`, 'es', { numeric: true });
    if (filters.sort === 'number') comparison = left.number.localeCompare(right.number, 'es', { numeric: true });
    return comparison || left.name.localeCompare(right.name, 'es', { numeric: true }) || left.inventoryItemId.localeCompare(right.inventoryItemId);
  });
}
