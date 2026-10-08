export type ResellerBatchDraftLine = {
  id: string; name: string; expansion: string; number: string; imageUrl: string;
  language: string; condition: string; finish: string; quantity: string; max: number; priceArs: number;
};

export function resellerBatchProblem(lines: ResellerBatchDraftLine[]): string {
  if (!lines.length || lines.length > 100) return "Selecciona entre 1 y 100 cartas.";
  for (const line of lines) {
    const quantity = Number(line.quantity);
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > line.max) return `${line.name}: indica una cantidad entre 1 y ${line.max}.`;
  }
  return "";
}

export function resellerBatchTotals(lines: ResellerBatchDraftLine[]) {
  return lines.reduce((total, line) => {
    const quantity = Number(line.quantity);
    if (Number.isSafeInteger(quantity) && quantity > 0) {
      total.units += quantity;
      total.valueArs += quantity * line.priceArs;
    }
    return total;
  }, { units: 0, valueArs: 0 });
}

export class ResellerBatchKeys {
  private paths = new Map<string, Map<string, string>>();
  get(path: string, body: unknown): string {
    const signature = JSON.stringify(body);
    const keys = this.paths.get(path) || new Map<string, string>();
    this.paths.set(path, keys);
    let key = keys.get(signature);
    if (!key) { key = crypto.randomUUID(); keys.set(signature, key); }
    return key;
  }
  reset(path?: string) { if (path) this.paths.delete(path); else this.paths.clear(); }
}
