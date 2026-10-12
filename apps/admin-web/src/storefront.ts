import "./storefront.css";
import { retireLegacyStockWorker } from "./legacy-stock-worker.js";

void retireLegacyStockWorker().catch(() => undefined);
