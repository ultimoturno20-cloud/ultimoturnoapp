import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  Share,
  ScrollView,
  StyleSheet,
  StatusBar as NativeStatusBar,
  Text,
  TextInput,
  View
} from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import * as LocalAuthentication from "expo-local-authentication";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Polyline } from "react-native-svg";
import ClaimsFeature from "./src/ClaimsFeature";
import {
  cancelSale,
  authenticateUser,
  closeSale,
  completeOrder,
  createPurchase,
  generateOrderBuyerMessage,
  generatePendingOrderLabels,
  getCardDetails,
  getDashboard,
  getStockCatalog,
  getSystemHealth,
  importScannerStock,
  listSales,
  listStock,
  listPurchases,
  listOrders,
  pingApi,
  recordOrderPayment,
  resetRemoteUserPassword,
  receivePurchase,
  searchStock,
  updateClaimCard,
  updateStock,
  updateOrder
} from "./src/api";
import {
  createUserPassword,
  loadBiometricStatus,
  loadCart,
  loadConfig,
  loadPendingSales,
  loadPendingActions,
  loadStockCatalog,
  loadRecentSearches,
  loadFavorites,
  loadOrCreateDeviceId,
  loadUserSession,
  loadUser,
  loadUserAuthStatus,
  resetUserPassword,
  saveCart,
  saveConfig,
  savePendingSales,
  savePendingActions,
  saveStockCatalog,
  saveRecentSearches,
  saveFavorites,
  saveUserSession,
  saveUser,
  setUserBiometricEnabled,
  verifyUserPassword
} from "./src/storage";

const ORIGINS = ["Mesa", "Evento", "Online", "Local", "Otro"];
const VIEWS = {
  DASHBOARD: "dashboard",
  SALE: "sale",
  ORDERS: "orders",
  HISTORY: "history",
  PURCHASES: "purchases",
  IMPORT: "import",
  CLAIMS: "claims",
  STOCK: "stock",
  MORE: "more"
};
const DEFAULT_SALE_FILTERS = {
  stockOnly: true,
  condition: "Todas",
  language: "Todos",
  sort: "relevance"
};
const SORT_OPTIONS = [
  { value: "relevance", label: "Mejor" },
  { value: "priceDesc", label: "$ Alto" },
  { value: "priceAsc", label: "$ Bajo" },
  { value: "name", label: "A-Z" },
  { value: "qty", label: "Stock" }
];
const ORDER_STATUS_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "unpaid", label: "Debe" },
  { value: "deposit", label: "Con seña" },
  { value: "paid", label: "Pagadas" },
  { value: "undelivered", label: "Retiro" }
];
const USERS = [
  { id: "seb", name: "Seb", role: "admin", subtitle: "Admin y configuracion", initials: "S", color: "#e1c91a", bg: "#111719", image: require("./assets/user-seb.jpeg") },
  { id: "may", name: "Mayu", role: "staff", subtitle: "Mesa y retiros", initials: "MY", color: "#1fa067", bg: "#06201d", image: require("./assets/user-mayu.jpeg") },
  { id: "melo", name: "Melo", role: "staff", subtitle: "Stock y eventos", initials: "ME", color: "#f48ab7", bg: "#2a111b", image: require("./assets/user-melo.jpeg") },
  { id: "ger", name: "Ger", role: "sales", subtitle: "Solo ventas", initials: "G", color: "#ef233c", bg: "#2a0d13", image: require("./assets/user-ger.png") }
];
const BRAND_LOGO = require("./assets/ultimo-turno-logo.jpeg");
const APP_VERSION = "2.2.0 Beta";
const IS_BETA = APP_VERSION.includes("Beta");
const PASSWORDS_PAUSED = true;
const DEFAULT_API_CONFIG = {
  apiUrl: "https://script.google.com/macros/s/AKfycbwAJKCcbBwwMqdO0khsiY6yyHkQOcdW6BaECIb1u6GfxOSmB9DCVFGlBWLnbiSstSch/exec",
  apiToken: "d23e6a2d96ee47809d52484566e7b76e",
  requestTimeoutMs: 60000
};
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const startupErrorStyles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    backgroundColor: "#09090a"
  },
  logo: { width: 92, height: 92, marginBottom: 24, borderRadius: 8 },
  title: { color: "#ffffff", fontSize: 22, fontWeight: "800", textAlign: "center" },
  message: { color: "#a9a9b2", fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 12 },
  button: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: "#ef233c"
  },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "800" }
});

async function safeStorageRead(loader, fallback) {
  try {
    const value = await loader();
    return value === undefined ? fallback : value;
  } catch (error) {
    console.warn("UltimoTurno storage recovery", error);
    return fallback;
  }
}

class AppCrashBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("UltimoTurno startup error", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <SafeAreaView style={startupErrorStyles.screen}>
        <ExpoStatusBar style="light" />
        <Image source={BRAND_LOGO} style={startupErrorStyles.logo} resizeMode="contain" />
        <Text style={startupErrorStyles.title}>No pudimos iniciar UltimoTurno</Text>
        <Text style={startupErrorStyles.message}>
          {String(this.state.error && this.state.error.message ? this.state.error.message : this.state.error)}
        </Text>
        <Pressable style={startupErrorStyles.button} onPress={() => this.setState({ error: null })}>
          <Text style={startupErrorStyles.buttonText}>Reintentar</Text>
        </Pressable>
      </SafeAreaView>
    );
  }
}

export default function RootApp() {
  return (
    <AppCrashBoundary>
      <App />
    </AppCrashBoundary>
  );
}

function App() {
  const [config, setConfig] = useState(DEFAULT_API_CONFIG);
  const [deviceId, setDeviceId] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [lastUser, setLastUser] = useState(null);
  const [userAuthStatus, setUserAuthStatus] = useState({});
  const [biometricStatus, setBiometricStatus] = useState({});
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState("Huella");
  const [showSettings, setShowSettings] = useState(false);
  const [view, setView] = useState(VIEWS.DASHBOARD);
  const [status, setStatus] = useState("Listo");
  const [loading, setLoading] = useState(false);
  const [booted, setBooted] = useState(false);

  const [dashboard, setDashboard] = useState(null);
  const [orders, setOrders] = useState([]);
  const [todaySales, setTodaySales] = useState(null);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyRange, setHistoryRange] = useState("today");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [purchases, setPurchases] = useState([]);
  const [purchaseQuery, setPurchaseQuery] = useState("");
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [orderQuery, setOrderQuery] = useState("");
  const [updatingOrders, setUpdatingOrders] = useState({});
  const [orderLabelsLoading, setOrderLabelsLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [buyerMessage, setBuyerMessage] = useState(null);
  const [stockItems, setStockItems] = useState([]);
  const [stockCatalog, setStockCatalog] = useState({ updatedAt: "", items: [] });
  const [stockQuery, setStockQuery] = useState("");
  const [selectedStockItem, setSelectedStockItem] = useState(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [systemHealth, setSystemHealth] = useState(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [saleFilters, setSaleFilters] = useState(DEFAULT_SALE_FILTERS);
  const [lastAddedSku, setLastAddedSku] = useState("");
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedCardLoading, setSelectedCardLoading] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState([]);
  const [pendingSales, setPendingSales] = useState([]);
  const [pendingActions, setPendingActions] = useState([]);
  const [syncingActions, setSyncingActions] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [syncingSales, setSyncingSales] = useState(false);
  const [buyer, setBuyer] = useState("");
  const [origin, setOrigin] = useState("Mesa");
  const [orderStatus, setOrderStatus] = useState("all");
  const searchTimer = useRef(null);
  const lastAddedTimer = useRef(null);
  const orderUpdateQueue = useRef(Promise.resolve());
  const saleSyncRunning = useRef(false);
  const actionSyncRunning = useRef(false);
  const catalogSyncRunning = useRef(false);

  const hasApi = !!config.apiUrl && !!config.apiToken;
  const permissions = useMemo(() => getUserPermissions(currentUser), [currentUser]);
  const pendingOrderUpdates = Object.keys(updatingOrders).length;
  const pendingSaleCount = pendingSales.length;
  const pendingActionCount = pendingActions.length;
  const [apiOnline, setApiOnline] = useState(true);

  useEffect(() => {
    async function boot() {
      const userIds = USERS.map((user) => user.id);
      const [
        savedConfig,
        savedCart,
        savedPendingSales,
        savedPendingActions,
        savedRecentSearches,
        savedFavorites,
        savedStockCatalog,
        savedUser,
        authStatus,
        bioStatus,
        savedDeviceId
      ] = await Promise.all([
        safeStorageRead(loadConfig, DEFAULT_API_CONFIG),
        safeStorageRead(loadCart, []),
        safeStorageRead(loadPendingSales, []),
        safeStorageRead(loadPendingActions, []),
        safeStorageRead(loadRecentSearches, []),
        safeStorageRead(loadFavorites, []),
        safeStorageRead(loadStockCatalog, { updatedAt: "", items: [] }),
        safeStorageRead(loadUser, null),
        safeStorageRead(() => loadUserAuthStatus(userIds), {}),
        safeStorageRead(() => loadBiometricStatus(userIds), {}),
        safeStorageRead(loadOrCreateDeviceId, `device-${Date.now()}`)
      ]);
      const savedProfile = savedUser && findUserProfile(savedUser.id);
      const nextConfig = {
        ...savedConfig,
        apiUrl: DEFAULT_API_CONFIG.apiUrl,
        apiToken: DEFAULT_API_CONFIG.apiToken,
        requestTimeoutMs: DEFAULT_API_CONFIG.requestTimeoutMs
      };
      setConfig(nextConfig);
      setDeviceId(savedDeviceId);
      setCart(savedCart);
      setPendingSales(savedPendingSales);
      setPendingActions((savedPendingActions || []).filter((action) => action.type !== "updatePackingLine"));
      setRecentSearches(savedRecentSearches);
      setFavorites(savedFavorites);
      setStockCatalog(savedStockCatalog);
      setLastUser(savedProfile || null);
      setUserAuthStatus(authStatus);
      setBiometricStatus(bioStatus);
      setShowSettings(false);
      setBooted(true);
    }
    boot();
  }, []);

  useEffect(() => {
    async function checkBiometrics() {
      try {
        const hardware = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        setBiometricAvailable(hardware && enrolled);
        setBiometricLabel(getBiometricLabel(types));
      } catch (err) {
        setBiometricAvailable(false);
      }
    }
    checkBiometrics();
  }, []);

  useEffect(() => {
    if (booted) saveCart(cart).catch(() => {});
  }, [booted, cart]);

  useEffect(() => {
    if (booted) savePendingSales(pendingSales).catch(() => {});
  }, [booted, pendingSales]);

  useEffect(() => { if (booted) savePendingActions(pendingActions).catch(() => {}); }, [booted, pendingActions]);
  useEffect(() => { if (booted) saveRecentSearches(recentSearches).catch(() => {}); }, [booted, recentSearches]);
  useEffect(() => { if (booted) saveFavorites(favorites).catch(() => {}); }, [booted, favorites]);

  useEffect(() => {
    if (!booted || !hasApi || !currentUser) return;
    if (view === VIEWS.DASHBOARD) loadDashboard();
    if (view === VIEWS.ORDERS && permissions.canOrders) loadOrders(orderQuery);
    if (view === VIEWS.HISTORY && permissions.canHistory) loadHistory();
    if (view === VIEWS.PURCHASES && permissions.canPurchases) loadPurchases(purchaseQuery);
    if (view === VIEWS.STOCK && permissions.canManageStock) loadStock(stockQuery);
    if (view === VIEWS.MORE && permissions.canConfig) loadSystemHealth();
    if (currentUser && pendingSales.length) syncPendingSales();
    if (currentUser && pendingActions.length) syncPendingActions();
  }, [booted, hasApi, view, currentUser && currentUser.id, config.sessionToken]);

  useEffect(() => {
    if (!booted || !hasApi || !currentUser || (!PASSWORDS_PAUSED && !config.sessionToken)) return;
    syncStockCatalog(false);
  }, [booted, hasApi, currentUser && currentUser.id, config.sessionToken]);

  useEffect(() => {
    if (!booted || !hasApi || !currentUser || !pendingSales.length) return;
    const timer = setTimeout(() => syncPendingSales(false), 1200);
    return () => clearTimeout(timer);
  }, [booted, hasApi, currentUser, pendingSales.length]);

  useEffect(() => {
    if (!booted || !hasApi || !currentUser || !pendingActions.length) return;
    const timer = setTimeout(() => syncPendingActions(false), 1500);
    return () => clearTimeout(timer);
  }, [booted, hasApi, currentUser, pendingActions.length]);

  useEffect(() => {
    if (view !== VIEWS.SALE) return;
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      runSearch(query);
    }, 280);
    return () => clearTimeout(searchTimer.current);
  }, [query, view]);

  useEffect(() => {
    if (!booted || !hasApi || view !== VIEWS.HISTORY || !permissions.canHistory) return;
    loadHistory();
  }, [historyRange]);

  const totals = useMemo(() => {
    return cart.reduce(
      (acc, item) => {
        acc.count += item.quantity;
        acc.ars += item.quantity * (Number(item.priceArs) || 0);
        acc.usd += item.quantity * (Number(item.priceUsd) || 0);
        return acc;
      },
      { count: 0, ars: 0, usd: 0 }
    );
  }, [cart]);

  const adjustedResults = useMemo(() => adjustStockForPendingSales(results, pendingSales), [results, pendingSales]);
  const saleFilterOptions = useMemo(() => buildSaleFilterOptions(adjustedResults), [adjustedResults]);
  const filteredResults = useMemo(() => filterAndSortSaleResults(adjustedResults, saleFilters), [adjustedResults, saleFilters]);
  const filteredOrders = useMemo(() => filterOrdersByStatus(orders, orderStatus), [orders, orderStatus]);

  async function loadDashboard() {
    if (!hasApi) return;
    setLoading(true);
    setStatus("Actualizando dashboard...");
    try {
      const data = await getDashboard(config, 6);
      setApiOnline(true);
      setDashboard(data);
      setStatus(data && data.updatedAt ? `Actualizado ${data.updatedAt}` : "Dashboard listo");
    } catch (err) {
      setApiOnline(false);
      setStatus(errorText(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadOrders(value = orderQuery) {
    if (!hasApi) return;
    setLoading(true);
    setStatus("Cargando ordenes...");
    try {
      const data = await listOrders(config, { q: value, mode: "pending", limit: 60 });
      setApiOnline(true);
      setOrders(data.orders || []);
      setStatus(data.total ? `${data.total} ordenes pendientes` : "Sin ordenes pendientes");
    } catch (err) {
      setApiOnline(false);
      setStatus(errorText(err));
    } finally {
      setLoading(false);
    }
  }

  async function runSearch(value = query) {
    if (!hasApi) return;
    setLoading(true);
    setStatus(value ? "Buscando..." : "Stock disponible");
    try {
      const data = await searchStock(config, value, 30);
      setApiOnline(true);
      setResults(data || []);
      if (String(value || "").trim()) {
        setRecentSearches((current) => [String(value).trim(), ...current.filter((item) => item !== String(value).trim())].slice(0, 8));
      }
      setStatus(data && data.length ? `${data.length} resultados` : "Sin resultados");
    } catch (err) {
      setApiOnline(false);
      const localResults = searchLocalStockCatalog(stockCatalog.items, value, 30);
      setResults(localResults);
      setStatus(localResults.length ? `${localResults.length} resultados offline` : errorText(err));
    } finally {
      setLoading(false);
    }
  }

  async function syncStockCatalog(force) {
    if (!hasApi || !currentUser || catalogSyncRunning.current) return;
    const updatedAt = stockCatalog.updatedAt ? new Date(stockCatalog.updatedAt).getTime() : 0;
    if (!force && stockCatalog.items.length && Date.now() - updatedAt < 6 * 60 * 60 * 1000) return;
    catalogSyncRunning.current = true;
    try {
      const data = await getStockCatalog(config);
      const next = { updatedAt: data.updatedAt || new Date().toISOString(), items: data.items || [] };
      setStockCatalog(next);
      await saveStockCatalog(next);
    } catch (err) {
      // The previous catalog remains usable offline.
    } finally {
      catalogSyncRunning.current = false;
    }
  }

  async function loadHistory() {
    if (!hasApi || !permissions.canHistory) return;
    setHistoryLoading(true);
    setStatus("Cargando historial...");
    try {
      const range = getHistoryDateRange(historyRange);
      const data = await listSales(config, { q: historyQuery, ...range, limit: 150 });
      setApiOnline(true);
      setTodaySales(data);
      setStatus(data && data.summary ? `${formatQty(data.summary.sales || 0)} ventas` : "Historial listo");
    } catch (err) {
      setApiOnline(false);
      setStatus(errorText(err));
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadStock(value = stockQuery) {
    if (!hasApi || !permissions.canManageStock) return;
    setStockLoading(true);
    setStatus("Cargando stock...");
    try {
      const data = await listStock(config, { q: value, mode: "all", limit: 120 });
      setApiOnline(true);
      setStockItems(data.items || []);
      setStatus(`${formatQty(data.total || 0)} items de stock`);
    } catch (err) {
      setApiOnline(false);
      setStatus(errorText(err));
    } finally {
      setStockLoading(false);
    }
  }

  async function loadSystemHealth() {
    if (!hasApi || !permissions.canConfig) return;
    try {
      const data = await getSystemHealth(config);
      setSystemHealth(data);
      setApiOnline(true);
    } catch (err) {
      setApiOnline(false);
      setSystemHealth(null);
    }
  }

  async function loadPurchases(value = purchaseQuery) {
    if (!hasApi || !permissions.canPurchases) return;
    setPurchaseLoading(true);
    setStatus("Cargando compras...");
    try {
      const data = await listPurchases(config, { q: value, mode: "pending", limit: 100 });
      setApiOnline(true);
      setPurchases(data.purchases || []);
      setStatus(data.total ? `${data.total} compras pendientes` : "Sin compras pendientes");
    } catch (err) {
      setApiOnline(false);
      setStatus(errorText(err));
    } finally {
      setPurchaseLoading(false);
    }
  }

  async function submitPurchase(payload) {
    if (!permissions.canPurchases) return;
    setPurchaseLoading(true);
    setStatus("Guardando compra...");
    const actionPayload = withActionMeta(payload, "compra", currentUser);
    try {
      await createPurchase(config, actionPayload);
      setApiOnline(true);
      if (actionPayload.received) invalidateStockCatalog();
      setStatus(actionPayload.received ? "Compra cargada y recibida" : "Compra cargada");
      loadPurchases(purchaseQuery);
    } catch (err) {
      setApiOnline(false);
      if (isRetryableSaleError(err)) {
        enqueuePendingAction("createPurchase", actionPayload, "Compra pendiente");
        Alert.alert("Compra guardada en cola", "Se sincronizara cuando vuelva la conexion.");
      } else {
        Alert.alert("No pude cargar la compra", errorText(err));
        setStatus(errorText(err));
      }
    } finally {
      setPurchaseLoading(false);
    }
  }

  async function markPurchaseReceived(purchase, quantity, wholePurchase = false) {
    if (!permissions.canPurchases || !purchase || purchase.synced) return;
    setPurchaseLoading(true);
    setStatus("Marcando compra recibida...");
    const receiveTarget = wholePurchase ? { purchaseId: purchase.purchaseId } : { row: purchase.row, quantity };
    const actionPayload = withActionMeta(receiveTarget, "recibir-compra", currentUser);
    try {
      await receivePurchase(config, actionPayload);
      setApiOnline(true);
      invalidateStockCatalog();
      setStatus("Compra recibida y stock actualizado");
      loadPurchases(purchaseQuery);
      if (view === VIEWS.SALE) runSearch(query);
    } catch (err) {
      setApiOnline(false);
      if (isRetryableSaleError(err)) {
        enqueuePendingAction("receivePurchase", actionPayload, "Recepcion pendiente");
        Alert.alert("Recepcion guardada", "El stock se actualizara al recuperar conexion.");
      } else {
        Alert.alert("No pude recibir la compra", errorText(err));
        setStatus(errorText(err));
      }
    } finally {
      setPurchaseLoading(false);
    }
  }

  async function submitScannerImport(items) {
    if (!permissions.canImportStock) return;
    setImportLoading(true);
    setStatus("Importando stock...");
    const actionPayload = withActionMeta({ items }, "importar-stock", currentUser);
    try {
      const result = await importScannerStock(config, actionPayload);
      setApiOnline(true);
      invalidateStockCatalog();
      setStatus(`Importadas ${formatQty(result.imported || 0)} cartas. Revisar: ${formatQty(result.review || 0)}`);
      if (view === VIEWS.SALE) runSearch(query);
      return result;
    } catch (err) {
      setApiOnline(false);
      if (isRetryableSaleError(err)) {
        enqueuePendingAction("importScannerStock", actionPayload, `Importacion ${formatQty(items.length)} filas`);
        Alert.alert("Importacion guardada", "Quedo en la cola offline y se enviara automaticamente.");
        return { queued: true, imported: 0, review: 0, details: [] };
      }
      Alert.alert("No pude importar stock", errorText(err));
      setStatus(errorText(err));
      return null;
    } finally {
      setImportLoading(false);
    }
  }

  function enqueuePendingAction(type, payload, summary) {
    const now = new Date().toISOString();
    setPendingActions((current) => {
      if (current.some((item) => item.id === payload.localActionId)) return current;
      return [...current, { id: payload.localActionId, type, payload, summary, createdAt: now, updatedAt: now, attempts: 0, lastError: "" }];
    });
    setStatus("Accion guardada en cola offline");
  }

  async function executePendingAction(action) {
    if (action.type === "createPurchase") return createPurchase(config, action.payload);
    if (action.type === "receivePurchase") return receivePurchase(config, action.payload);
    if (action.type === "importScannerStock") return importScannerStock(config, action.payload);
    if (action.type === "updateOrder") return updateOrder(config, action.payload);
    if (action.type === "recordOrderPayment") return recordOrderPayment(config, action.payload);
    if (action.type === "completeOrder") return completeOrder(config, action.payload);
    if (action.type === "updateClaimCard") return updateClaimCard(config, action.payload);
    if (action.type === "updateStock") return updateStock(config, action.payload);
    if (action.type === "cancelSale") return cancelSale(config, action.payload);
    throw new Error(`Accion offline desconocida: ${action.type}`);
  }

  async function syncPendingActions(manual = true) {
    if (!hasApi || !pendingActions.length || actionSyncRunning.current) return;
    actionSyncRunning.current = true;
    setSyncingActions(true);
    if (manual) setStatus("Sincronizando acciones pendientes...");
    let synced = 0;
    for (const action of pendingActions.slice()) {
      try {
        await executePendingAction(action);
        synced += 1;
        setPendingActions((current) => current.filter((item) => item.id !== action.id));
        setApiOnline(true);
      } catch (err) {
        const message = errorText(err);
        setApiOnline(false);
        setPendingActions((current) => current.map((item) => item.id === action.id ? { ...item, attempts: (item.attempts || 0) + 1, lastError: message, updatedAt: new Date().toISOString() } : item));
        if (isRetryableSaleError(err)) break;
      }
    }
    actionSyncRunning.current = false;
    setSyncingActions(false);
    if (synced) {
      setStatus(`${formatQty(synced)} acciones sincronizadas`);
      if (view === VIEWS.ORDERS) loadOrders(orderQuery);
      if (view === VIEWS.STOCK) loadStock(stockQuery);
      if (view === VIEWS.PURCHASES) loadPurchases(purchaseQuery);
      if (view === VIEWS.HISTORY) loadHistory();
      if (view === VIEWS.DASHBOARD) loadDashboard();
    }
  }

  async function saveSettings() {
    const next = {
      ...config,
      apiUrl: DEFAULT_API_CONFIG.apiUrl,
      apiToken: DEFAULT_API_CONFIG.apiToken,
      requestTimeoutMs: DEFAULT_API_CONFIG.requestTimeoutMs,
      deviceId
    };
    await saveConfig(next);
    setConfig(next);
    setShowSettings(false);
    setStatus("Configuracion guardada");
    try {
      await pingApi(next);
      setApiOnline(true);
      if (!next.sessionToken && !PASSWORDS_PAUSED) {
        setCurrentUser(null);
        setLastUser(currentUser);
        setView(VIEWS.DASHBOARD);
        Alert.alert("API conectada", `Entra otra vez como ${currentUser ? currentUser.name : "usuario"} para vincular este celular de forma segura.`);
        return;
      }
      setView(VIEWS.DASHBOARD);
      const data = await getDashboard(next, 6);
      setDashboard(data);
      setStatus("API conectada");
    } catch (err) {
      setApiOnline(false);
      setStatus(errorText(err));
    }
  }

  function openView(nextView) {
    if (nextView === VIEWS.ORDERS && !permissions.canOrders) return;
    if (nextView === VIEWS.HISTORY && !permissions.canHistory) return;
    if (nextView === VIEWS.PURCHASES && !permissions.canPurchases) return;
    if (nextView === VIEWS.IMPORT && !permissions.canImportStock) return;
    if (nextView === VIEWS.CLAIMS && !permissions.canClaims) return;
    if (nextView === VIEWS.STOCK && !permissions.canManageStock) return;
    setView(nextView);
    setSelectedCard(null);
    setSelectedCardLoading(false);
    setSelectedOrder(null);
    setPaymentOrder(null);
    setSelectedStockItem(null);
    setCartOpen(false);
    setShowSettings(false);
  }

  function toggleSettings() {
    if (!permissions.canConfig) {
      Alert.alert("Sin permiso", "Solo Seb puede modificar la configuracion de API.");
      return;
    }
    setShowSettings((value) => !value);
  }

  async function resetPasswordForUser(user) {
    if (!permissions.canResetPasswords) return;
    Alert.alert("Resetear contrasena", `La proxima vez ${user.name} tendra que crear una nueva contrasena.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Resetear",
        style: "destructive",
        onPress: async () => {
          try {
            if (hasApi) await resetRemoteUserPassword(config, withActionMeta({ userId: user.id }, "reset-acceso", currentUser));
            await resetUserPassword(user.id);
            await saveUserSession(user.id, "");
            setUserAuthStatus((current) => ({ ...current, [user.id]: false }));
            setBiometricStatus((current) => ({ ...current, [user.id]: false }));
            setStatus(`Contrasena de ${user.name} reseteada`);
          } catch (err) {
            Alert.alert("No pude resetear el acceso", errorText(err));
          }
        }
      }
    ]);
  }

  async function loginUser(user, password, confirmPassword) {
    if (PASSWORDS_PAUSED) {
      await saveUser({ id: user.id, name: user.name });
      setCurrentUser(user);
      setLastUser(user);
      setStatus(`Hola ${user.name}`);
      return { ok: true };
    }
    const cleanPassword = String(password || "");
    if (cleanPassword.length < 4) return { ok: false, error: "Usa al menos 4 caracteres." };

    const needsLocalPassword = !userAuthStatus[user.id];
    let localPasswordValid = false;
    if (needsLocalPassword) {
      if (cleanPassword !== String(confirmPassword || "")) return { ok: false, error: "Las contrasenas no coinciden." };
    } else {
      localPasswordValid = await verifyUserPassword(user.id, cleanPassword);
      if (!localPasswordValid && !hasApi) return { ok: false, error: "Contrasena incorrecta." };
    }

    if (hasApi) {
      try {
        const auth = await authenticateUser(config, { userId: user.id, password: cleanPassword, deviceId });
        await saveUserSession(user.id, auth.sessionToken);
        const nextConfig = { ...config, sessionToken: auth.sessionToken, deviceId };
        await saveConfig(nextConfig);
        setConfig(nextConfig);
      } catch (err) {
        if (!isRetryableSaleError(err)) return { ok: false, error: errorText(err) };
        const savedSession = await loadUserSession(user.id);
        if (!savedSession || !localPasswordValid) return { ok: false, error: `No pude validar este usuario en el HUB: ${errorText(err)}` };
        setConfig((current) => ({ ...current, sessionToken: savedSession, deviceId }));
      }
    }

    const createdPassword = needsLocalPassword || !localPasswordValid;
    if (createdPassword) {
      await createUserPassword(user.id, cleanPassword);
      setUserAuthStatus((current) => ({ ...current, [user.id]: true }));
    }

    await saveUser({ id: user.id, name: user.name });
    setCurrentUser(user);
    setLastUser(user);
    setStatus(`Hola ${user.name}`);
    if (biometricAvailable && !biometricStatus[user.id]) {
      Alert.alert(
        `Activar ${biometricLabel}`,
        createdPassword ? "Queres usarlo para entrar mas rapido la proxima vez?" : "Queres usarlo para entrar mas rapido?",
        [
          { text: "Ahora no", style: "cancel" },
          {
            text: "Activar",
            onPress: async () => {
              const ok = await authenticateBiometric(`Activar ${biometricLabel}`);
              if (!ok) return;
              await setUserBiometricEnabled(user.id, true);
              setBiometricStatus((current) => ({ ...current, [user.id]: true }));
            }
          }
        ]
      );
    }
    return { ok: true };
  }

  async function loginUserWithBiometric(user) {
    if (!userAuthStatus[user.id]) return { ok: false, error: "Primero crea una contrasena." };
    if (!biometricStatus[user.id]) return { ok: false, error: `${biometricLabel} no esta activado para ${user.name}.` };
    const ok = await authenticateBiometric(`Entrar como ${user.name}`);
    if (!ok) return { ok: false, error: "No se pudo verificar la identidad." };
    const sessionToken = await loadUserSession(user.id);
    if (hasApi && !sessionToken) return { ok: false, error: "Ingresa una vez con tu contrasena para vincular la sesion segura del HUB." };
    if (sessionToken) setConfig((current) => ({ ...current, sessionToken, deviceId }));
    await saveUser({ id: user.id, name: user.name });
    setCurrentUser(user);
    setLastUser(user);
    setStatus(`Hola ${user.name}`);
    return { ok: true };
  }

  async function logoutUser() {
    setCurrentUser(null);
    setView(VIEWS.DASHBOARD);
    setSelectedCard(null);
    setSelectedOrder(null);
    setCartOpen(false);
    setShowSettings(false);
  }

  function openCardDetail(card) {
    setCartOpen(false);
    setSelectedCard(card);
    setSelectedCardLoading(true);
    getCardDetails(config, card.sku)
      .then((freshCard) => {
        setSelectedCard((current) => (current && current.sku === card.sku ? { ...current, ...freshCard } : current));
        setResults((current) => current.map((item) => (item.sku === card.sku ? { ...item, ...freshCard } : item)));
      })
      .catch((err) => {
        setStatus(errorText(err));
      })
      .finally(() => {
        setSelectedCardLoading(false);
      });
  }

  function addToCart(stockItem, overrides = {}) {
    const hasArs = Object.prototype.hasOwnProperty.call(overrides, "priceArs");
    const hasUsd = Object.prototype.hasOwnProperty.call(overrides, "priceUsd");
    const nextPriceArs = hasArs ? Number(overrides.priceArs) || 0 : Number(stockItem.precioFinalArs) || 0;
    const nextPriceUsd = hasUsd ? Number(overrides.priceUsd) || 0 : Number(stockItem.priceUsd) || 0;
    setCart((current) => {
      const existing = current.find((item) => item.sku === stockItem.sku);
      if (existing) {
        return current.map((item) => {
          if (item.sku !== stockItem.sku) return item;
          return {
            ...item,
            quantity: Math.min(item.available, item.quantity + 1),
            priceArs: hasArs ? nextPriceArs : item.priceArs,
            priceUsd: hasUsd ? nextPriceUsd : item.priceUsd
          };
        });
      }
      return [
        ...current,
        {
          sku: stockItem.sku,
          nombre: stockItem.nombre,
          expansion: stockItem.expansion,
          numero: stockItem.numero,
          available: stockItem.quantity,
          quantity: 1,
          priceArs: nextPriceArs,
          priceUsd: nextPriceUsd,
          pcUsd: Number(stockItem.pcUsd) || 0,
          ultimaCompraUsd: Number(stockItem.ultimaCompraUsd) || 0
        }
      ];
    });
  }

  function handleAddToCart(stockItem, overrides) {
    if ((Number(stockItem.quantity) || 0) <= 0) {
      Alert.alert("Sin stock disponible", "Esta carta ya esta reservada por ventas pendientes de sincronizar.");
      return;
    }
    addToCart(stockItem, overrides);
    setLastAddedSku(stockItem.sku || "");
    setStatus("Carta agregada al carrito");
    impactLight();
    clearTimeout(lastAddedTimer.current);
    lastAddedTimer.current = setTimeout(() => setLastAddedSku(""), 950);
  }

  function toggleFavorite(sku) {
    setFavorites((current) => current.includes(sku) ? current.filter((item) => item !== sku) : [...current, sku]);
    selectionFeedback();
  }

  function updateCartItem(index, patch) {
    setCart((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function changeQty(index, delta) {
    setCart((current) =>
      current.map((item, i) => {
        if (i !== index) return item;
        return { ...item, quantity: Math.max(1, Math.min(item.available, item.quantity + delta)) };
      })
    );
  }

  function removeItem(index) {
    setCart((current) => current.filter((_, i) => i !== index));
  }

  function clearCart() {
    if (!cart.length) return;
    Alert.alert("Vaciar carrito", "Esto quita todas las cartas de la venta actual.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Vaciar",
        style: "destructive",
        onPress: () => {
          setCart([]);
          setStatus("Carrito vaciado");
        }
      }
    ]);
  }

  async function submitSale(forcedBuyer) {
    if (!cart.length) return;
    if (!forcedBuyer && !buyer.trim()) {
      Alert.alert("Comprador vacio", "Puedo cerrar la venta como Mesa.", [
        { text: "Cancelar", style: "cancel" },
        { text: "Usar Mesa", onPress: () => submitSale("Mesa") }
      ]);
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    setStatus("Cerrando venta...");
    const salePayload = buildLocalSalePayload({
      buyer: forcedBuyer || buyer.trim() || "Mesa",
      origin,
      seller: currentUser ? currentUser.name : "",
      cart
    });
    try {
      const result = await closeSale(config, salePayload);
      setApiOnline(true);
      applySaleToStockCatalog(salePayload);
      setCart([]);
      setBuyer("");
      setCartOpen(false);
      setStatus(`Venta cerrada: ${formatArs(result.totalArs)}${result.totalUsd ? ` + ${formatUsd(result.totalUsd)}` : ""}`);
      runSearch(query);
    } catch (err) {
      setApiOnline(false);
      if (isRetryableSaleError(err)) {
        enqueuePendingSale(salePayload, err);
        setCart([]);
        setBuyer("");
        setCartOpen(false);
        Alert.alert("Venta guardada en cola", "No se pudo sincronizar ahora, pero la venta quedo guardada en este celular y la app va a reintentar.");
      } else {
        Alert.alert("No pude cerrar la venta", errorText(err));
        setStatus(errorText(err));
      }
    } finally {
      setLoading(false);
    }
  }

  function enqueuePendingSale(payload, err) {
    const queuedAt = new Date().toISOString();
    setPendingSales((current) => {
      if (current.some((sale) => sale.localSaleId === payload.localSaleId)) return current;
      return [
        ...current,
        {
          localSaleId: payload.localSaleId,
          createdAt: queuedAt,
          updatedAt: queuedAt,
          attempts: 0,
          lastError: errorText(err),
          payload,
          summary: summarizeSalePayload(payload)
        }
      ];
    });
    setStatus("Venta guardada en cola offline");
  }

  async function syncPendingSales(manual = true) {
    if (!hasApi || !pendingSales.length || saleSyncRunning.current) return;
    saleSyncRunning.current = true;
    setSyncingSales(true);
    if (manual) setStatus("Sincronizando ventas pendientes...");

    const snapshot = pendingSales.slice();
    let synced = 0;
    let retryableStop = false;

    for (const sale of snapshot) {
      try {
        await closeSale(config, sale.payload);
        synced++;
        setApiOnline(true);
        applySaleToStockCatalog(sale.payload);
        setPendingSales((current) => current.filter((item) => item.localSaleId !== sale.localSaleId));
      } catch (err) {
        const message = errorText(err);
        setApiOnline(false);
        setPendingSales((current) =>
          current.map((item) =>
            item.localSaleId === sale.localSaleId
              ? { ...item, attempts: (item.attempts || 0) + 1, lastError: message, updatedAt: new Date().toISOString() }
              : item
          )
        );
        if (isRetryableSaleError(err)) {
          retryableStop = true;
          break;
        }
      }
    }

    saleSyncRunning.current = false;
    setSyncingSales(false);
    if (synced) {
      setStatus(`${formatQty(synced)} venta${synced === 1 ? "" : "s"} sincronizada${synced === 1 ? "" : "s"}`);
      if (view === VIEWS.SALE) runSearch(query);
      if (view === VIEWS.DASHBOARD) loadDashboard();
      if (view === VIEWS.HISTORY && permissions.canHistory) loadHistory();
    } else if (manual) {
      setStatus(retryableStop ? "No hay conexion estable para sincronizar" : "Pendientes con error para revisar");
    }
  }

  function applySaleToStockCatalog(payload) {
    const soldBySku = {};
    (payload.items || []).forEach((item) => {
      soldBySku[item.sku] = (soldBySku[item.sku] || 0) + (Number(item.quantity) || 0);
    });
    setStockCatalog((current) => {
      const next = {
        updatedAt: current.updatedAt,
        items: (current.items || []).map((item) => soldBySku[item.sku]
          ? { ...item, quantity: Math.max(0, (Number(item.quantity) || 0) - soldBySku[item.sku]) }
          : item)
      };
      saveStockCatalog(next);
      return next;
    });
  }

  function invalidateStockCatalog() {
    setStockCatalog((current) => {
      const next = { ...current, updatedAt: "" };
      saveStockCatalog(next);
      return next;
    });
  }

  function markOrder(order, patch) {
    if (updatingOrders[order.orderId]) return;
    const nextPaid = patch.paid === undefined ? order.paid : !!patch.paid;
    const nextDelivered = patch.delivered === undefined ? order.delivered : !!patch.delivered;
    const nextPacked = patch.packed === undefined ? nextDelivered || order.packed : !!patch.packed;
    const nextPatch = { paid: nextPaid, delivered: nextDelivered, packed: nextPacked };
    const actionPayload = withActionMeta({ orderId: order.orderId, ...nextPatch }, "actualizar-orden", currentUser);

    setUpdatingOrders((current) => ({ ...current, [order.orderId]: true }));
    applyLocalOrderUpdate(order.orderId, nextPatch);
    setStatus(nextPaid && nextDelivered ? "Orden marcada, sync en cola" : "Orden marcada en cola");

    orderUpdateQueue.current = orderUpdateQueue.current
      .catch(() => null)
      .then(() => updateOrder(config, actionPayload))
      .then(() => {
        setApiOnline(true);
        setStatus(nextPaid && nextDelivered ? "Orden actualizada, sync en cola" : "Orden actualizada");
      })
      .catch((err) => {
        setApiOnline(false);
        if (isRetryableSaleError(err)) {
          enqueuePendingAction("updateOrder", actionPayload, `Orden ${order.orderId}`);
          setStatus("Orden guardada en cola offline");
        } else {
          Alert.alert("No pude actualizar la orden", errorText(err));
          setStatus(errorText(err));
          loadOrders(orderQuery);
          if (dashboard) loadDashboard();
        }
      })
      .finally(() => {
        setUpdatingOrders((current) => {
          const next = { ...current };
          delete next[order.orderId];
          return next;
        });
      });
  }

  async function submitOrderPayment(order, payment) {
    const payload = withActionMeta({ orderId: order.orderId, ...payment }, "pago-orden", currentUser);
    setUpdatingOrders((current) => ({ ...current, [order.orderId]: true }));
    try {
      const result = await recordOrderPayment(config, payload);
      applyLocalPaymentUpdate(order.orderId, result);
      setPaymentOrder(null);
      setApiOnline(true);
      setStatus(result.paid ? "Orden pagada" : "Seña registrada");
      impactSuccess();
    } catch (err) {
      setApiOnline(false);
      if (isRetryableSaleError(err)) {
        enqueuePendingAction("recordOrderPayment", payload, `Pago ${order.orderId}`);
        setPaymentOrder(null);
        Alert.alert("Pago guardado en cola", "Se sincronizara al recuperar conexion.");
      } else Alert.alert("No pude registrar el pago", errorText(err));
    } finally {
      setUpdatingOrders((current) => { const next = { ...current }; delete next[order.orderId]; return next; });
    }
  }

  function applyLocalPaymentUpdate(orderId, result) {
    const patch = {
      paid: !!result.paid,
      paidArs: Number(result.paidArs) || 0,
      paidUsd: Number(result.paidUsd) || 0,
      balanceArs: Number(result.balanceArs) || 0,
      balanceUsd: Number(result.balanceUsd) || 0,
      hasDeposit: !result.paid && ((Number(result.paidArs) || 0) > 0 || (Number(result.paidUsd) || 0) > 0)
    };
    setOrders((current) => current.map((item) => item.orderId === orderId ? { ...item, ...patch } : item));
    setSelectedOrder((current) => current && current.orderId === orderId ? { ...current, ...patch } : current);
  }

  function confirmCompleteOrder(order) {
    Alert.alert(
      "Completar orden",
      `Completar orden ${order.orderId} de cliente ${order.buyer || "sin comprador"}?\n\nSe marcara como pagada, embalada y entregada.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Completar", style: "destructive", onPress: () => submitCompleteOrder(order) }
      ]
    );
  }

  async function submitCompleteOrder(order) {
    const payload = withActionMeta({ orderId: order.orderId }, "completar-orden", currentUser);
    setUpdatingOrders((current) => ({ ...current, [order.orderId]: true }));
    applyLocalOrderUpdate(order.orderId, { paid: true, packed: true, delivered: true });
    try {
      await completeOrder(config, payload);
      setApiOnline(true);
      setSelectedOrder(null);
      setPaymentOrder(null);
      setStatus(`Orden ${order.orderId} completada`);
      notificationSuccess();
    } catch (err) {
      setApiOnline(false);
      if (isRetryableSaleError(err)) {
        enqueuePendingAction("completeOrder", payload, `Completar ${order.orderId}`);
        setStatus("Orden completa en cola offline");
      } else {
        Alert.alert("No pude completar la orden", errorText(err));
        loadOrders(orderQuery);
      }
    } finally {
      setUpdatingOrders((current) => { const next = { ...current }; delete next[order.orderId]; return next; });
    }
  }

  async function generateBuyerMessageForOrder(order) {
    if (!order || !order.orderId || updatingOrders[order.orderId]) return;
    const payload = withActionMeta({ orderId: order.orderId }, "mensaje-comprador", currentUser);
    setUpdatingOrders((current) => ({ ...current, [order.orderId]: true }));
    try {
      const result = await generateOrderBuyerMessage(config, payload);
      const message = String(result && result.message ? result.message : "").trim();
      if (!message) throw new Error("El HUB no devolvio ningun mensaje.");
      const copied = await copyTextToClipboard(message);
      setBuyerMessage({ orderId: order.orderId, buyer: order.buyer || result.buyer || "", message });
      setApiOnline(true);
      setStatus(copied ? "Mensaje copiado" : "Mensaje generado");
      if (!copied) Alert.alert("Mensaje generado", "Te lo dejo abierto para copiarlo manualmente.");
      selectionFeedback();
    } catch (err) {
      setApiOnline(false);
      Alert.alert("No pude generar el mensaje", errorText(err));
      setStatus(errorText(err));
    } finally {
      setUpdatingOrders((current) => {
        const next = { ...current };
        delete next[order.orderId];
        return next;
      });
    }
  }

  async function generateLabelsForPendingOrders() {
    if (orderLabelsLoading) return;
    const payload = withActionMeta({}, "etiquetas-pendientes", currentUser);
    setOrderLabelsLoading(true);
    try {
      const result = await generatePendingOrderLabels(config, payload);
      setApiOnline(true);
      setStatus(`${result.labels || 0} etiquetas listas`);
      Alert.alert(
        "Etiquetas listas",
        `${result.labels || 0} etiquetas generadas en la hoja ${result.sheetName || "Etiquetas A4"}.\n\nAbrila desde la planilla para imprimir en A4.`
      );
      notificationSuccess();
    } catch (err) {
      setApiOnline(false);
      Alert.alert("No pude generar etiquetas", errorText(err));
      setStatus(errorText(err));
    } finally {
      setOrderLabelsLoading(false);
    }
  }

  function togglePackingLine() {
    selectionFeedback();
  }

  async function saveStockItem(item, patch) {
    const payload = withActionMeta({ sku: item.sku, ...patch }, "actualizar-stock", currentUser);
    setStockLoading(true);
    try {
      const result = await updateStock(config, payload);
      setStockItems((current) => current.map((entry) => entry.sku === item.sku ? result.item : entry));
      setSelectedStockItem(result.item);
      setApiOnline(true);
      invalidateStockCatalog();
      setStatus("Stock actualizado");
      impactSuccess();
    } catch (err) {
      setApiOnline(false);
      if (isRetryableSaleError(err)) {
        enqueuePendingAction("updateStock", payload, `Stock ${item.nombre}`);
        setSelectedStockItem(null);
        Alert.alert("Ajuste guardado", "Se sincronizara cuando vuelva la conexion.");
      } else Alert.alert("No pude actualizar stock", errorText(err));
    } finally {
      setStockLoading(false);
    }
  }

  async function cancelHistorySale(sale, reason) {
    if (!String(reason || "").trim()) return;
    const payload = withActionMeta({ saleKey: sale.saleKey, reason: String(reason).trim() }, "anular-venta", currentUser);
    try {
      await cancelSale(config, payload);
      setStatus("Venta anulada y stock restaurado");
      invalidateStockCatalog();
      loadHistory();
      notificationSuccess();
    } catch (err) {
      if (isRetryableSaleError(err)) enqueuePendingAction("cancelSale", payload, `Anular ${sale.saleKey}`);
      else Alert.alert("No pude anular la venta", errorText(err));
    }
  }

  function applyLocalOrderUpdate(orderId, patch) {
    setSelectedOrder((current) => (current && current.orderId === orderId ? { ...current, ...patch } : current));
    setOrders((current) =>
      current
        .map((item) => (item.orderId === orderId ? { ...item, ...patch } : item))
        .filter((item) => !(item.paid && item.delivered))
    );
    setDashboard((current) => {
      if (!current || !current.summary) return current;
      var summary = { ...current.summary };
      var was = findOrderInDashboardOrList_(current.orders || orders, orderId);
      if (was) {
        var beforePaid = !!was.paid;
        var beforeDelivered = !!was.delivered;
        var afterPaid = patch.paid === undefined ? beforePaid : !!patch.paid;
        var afterDelivered = patch.delivered === undefined ? beforeDelivered : !!patch.delivered;
        if (!beforePaid && afterPaid) {
          summary.unpaidOrders = Math.max(0, (summary.unpaidOrders || 0) - 1);
          summary.arsToCollect = Math.max(0, (summary.arsToCollect || 0) - (Number(was.totalArs) || 0));
          summary.usdToCollect = Math.max(0, (summary.usdToCollect || 0) - (Number(was.totalUsd) || 0));
        }
        if (!beforeDelivered && afterDelivered) {
          summary.undeliveredOrders = Math.max(0, (summary.undeliveredOrders || 0) - 1);
        }
        if (!(beforePaid && beforeDelivered) && afterPaid && afterDelivered) {
          summary.activeOrders = Math.max(0, (summary.activeOrders || 0) - 1);
        }
      }
      return {
        ...current,
        summary,
        orders: (current.orders || [])
          .map((item) => (item.orderId === orderId ? { ...item, ...patch } : item))
          .filter((item) => !(item.paid && item.delivered))
      };
    });
  }

  const sectionTitle = showSettings ? "Configuracion" : view === VIEWS.SALE
    ? (cartOpen ? "Carrito" : selectedCard ? "Detalle carta" : "Venta mesa")
    : view === VIEWS.ORDERS
      ? (selectedOrder ? "Detalle orden" : "Ordenes")
      : view === VIEWS.HISTORY
        ? "Historial"
        : view === VIEWS.PURCHASES
          ? "Compras"
          : view === VIEWS.IMPORT
            ? "Importar"
            : view === VIEWS.CLAIMS
              ? "Claims"
              : view === VIEWS.STOCK
                ? (selectedStockItem ? "Editar stock" : "Stock")
                : view === VIEWS.MORE
                  ? "Mas"
                  : "Dashboard";

  if (!booted) {
    return (
      <SafeAreaView style={styles.safe}>
        <ExpoStatusBar style="light" />
        <View style={styles.statusSpacer} />
        <View style={styles.bootScreen}>
          <ActivityIndicator color="#ef233c" />
        </View>
      </SafeAreaView>
    );
  }

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.safe}>
        <ExpoStatusBar style="light" />
        <View style={styles.statusSpacer} />
        <LoginScreen
          users={USERS}
          defaultUser={lastUser}
          authStatus={userAuthStatus}
          biometricStatus={biometricStatus}
          biometricAvailable={biometricAvailable}
          biometricLabel={biometricLabel}
          passwordsPaused={PASSWORDS_PAUSED}
          onLogin={loginUser}
          onBiometricLogin={loginUserWithBiometric}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ExpoStatusBar style="light" />
      <View style={styles.statusSpacer} />
      <View style={styles.header}>
        <Pressable style={styles.brandHeader} onPress={() => openView(VIEWS.DASHBOARD)}>
          <Image source={BRAND_LOGO} style={styles.headerLogo} resizeMode="cover" />
          <View style={styles.headerText}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>UltimoTurno</Text>
              {IS_BETA ? (
                <View style={styles.betaBadge}>
                  <Text style={styles.betaBadgeText}>BETA</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.subtitle}>{currentUser.name} - {sectionTitle} - {status}</Text>
          </View>
        </Pressable>
        {view === VIEWS.SALE ? (
          <TapPressable
            style={[styles.cartHeaderButton, cartOpen && styles.cartHeaderActive]}
            onPress={() => {
              setSelectedCard(null);
              setCartOpen((value) => !value);
            }}
            scaleTo={0.94}
          >
            <CartGlyph active={cartOpen} />
            <Text style={[styles.cartHeaderText, cartOpen && styles.cartHeaderTextActive]}>Carrito</Text>
            {totals.count ? (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{totals.count > 99 ? "99" : totals.count}</Text>
              </View>
            ) : null}
          </TapPressable>
        ) : (
          <TapPressable style={styles.headerAvatarButton} onPress={() => openView(VIEWS.MORE)} scaleTo={0.94}>
            <UserAvatar user={currentUser} size={36} />
          </TapPressable>
        )}
      </View>

      <SyncStatusBanner
        apiOnline={apiOnline}
        pendingOrders={pendingOrderUpdates}
        pendingSales={pendingSaleCount}
        pendingActions={pendingActionCount}
        cartCount={totals.count}
      />

      {showSettings && permissions.canConfig ? (
        <View style={styles.settings}>
          <Text style={styles.label}>URL Web App</Text>
          <Text style={styles.lockedConfigValue} numberOfLines={3}>{DEFAULT_API_CONFIG.apiUrl}</Text>
          <Text style={styles.label}>Token</Text>
          <Text style={styles.lockedConfigValue}>Fijado en la app</Text>
          <View style={styles.inlineActions}>
            {hasApi ? (
              <TapPressable style={[styles.orderButton, styles.flexButton]} onPress={() => setShowSettings(false)} scaleTo={0.97}>
                <Ionicons name="close" size={20} color="#f8fafc" />
                <Text style={styles.orderButtonText}>Cancelar</Text>
              </TapPressable>
            ) : null}
            <TapPressable style={[styles.primaryButton, styles.flexButton]} onPress={saveSettings} scaleTo={0.97}>
              <Ionicons name="save-outline" size={20} color="#fff" />
              <Text style={styles.primaryText}>Guardar</Text>
            </TapPressable>
          </View>
        </View>
      ) : null}

      {!hasApi && (!showSettings || !permissions.canConfig) ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Falta conectar la API</Text>
          <Text style={styles.empty}>{permissions.canConfig ? "Carga la URL Web App y el token para usar la app." : "Pedile a Seb que configure la API en este celular."}</Text>
          {permissions.canConfig ? (
            <TapPressable style={styles.primaryButton} onPress={() => setShowSettings(true)} scaleTo={0.97}>
              <Text style={styles.primaryText}>Abrir configuracion</Text>
            </TapPressable>
          ) : null}
        </View>
      ) : null}

      {hasApi && !showSettings && view === VIEWS.DASHBOARD ? (
        <DashboardScreen
          dashboard={dashboard}
          loading={loading}
          onRefresh={loadDashboard}
          onSale={() => openView(VIEWS.SALE)}
          onOrders={() => openView(VIEWS.ORDERS)}
          onHistory={() => openView(VIEWS.HISTORY)}
          onPurchases={() => openView(VIEWS.PURCHASES)}
          onImport={() => openView(VIEWS.IMPORT)}
          onClaims={() => openView(VIEWS.CLAIMS)}
          onStock={() => openView(VIEWS.STOCK)}
          onMore={() => openView(VIEWS.MORE)}
          onSettings={toggleSettings}
          currentUser={currentUser}
          permissions={permissions}
          onLogout={logoutUser}
          pendingSales={pendingSales}
          syncingSales={syncingSales}
          onSyncPendingSales={() => syncPendingSales(true)}
        />
      ) : null}

      {hasApi && !showSettings && view === VIEWS.HISTORY && permissions.canHistory ? (
        <HistoryScreen
          data={todaySales}
          loading={historyLoading}
          onRefresh={loadHistory}
          query={historyQuery}
          setQuery={setHistoryQuery}
          range={historyRange}
          setRange={setHistoryRange}
          onCancelSale={cancelHistorySale}
          canCancel={permissions.canCancelSales}
        />
      ) : null}

      {hasApi && !showSettings && view === VIEWS.PURCHASES && permissions.canPurchases ? (
        <PurchasesScreen
          purchases={purchases}
          loading={purchaseLoading}
          purchaseQuery={purchaseQuery}
          setPurchaseQuery={setPurchaseQuery}
          loadPurchases={loadPurchases}
          submitPurchase={submitPurchase}
          markReceived={markPurchaseReceived}
        />
      ) : null}

      {hasApi && !showSettings && view === VIEWS.STOCK && permissions.canManageStock ? (
        selectedStockItem ? (
          <StockEditScreen
            item={selectedStockItem}
            loading={stockLoading}
            onBack={() => setSelectedStockItem(null)}
            onSave={saveStockItem}
          />
        ) : (
          <StockManagementScreen
            items={stockItems}
            query={stockQuery}
            setQuery={setStockQuery}
            loading={stockLoading}
            onSearch={loadStock}
            onOpen={setSelectedStockItem}
          />
        )
      ) : null}

      {hasApi && !showSettings && view === VIEWS.MORE ? (
        <MoreScreen
          permissions={permissions}
          health={systemHealth}
          apiOnline={apiOnline}
          pendingActions={pendingActions}
          pendingSales={pendingSales}
          syncing={syncingActions || syncingSales}
          currentUser={currentUser}
          users={USERS}
          onSync={() => { syncPendingSales(true); syncPendingActions(true); }}
          onOpen={openView}
          onSettings={toggleSettings}
          onLogout={logoutUser}
          onResetPassword={resetPasswordForUser}
        />
      ) : null}

      {hasApi && !showSettings && view === VIEWS.IMPORT && permissions.canImportStock ? (
        <ScannerImportScreen loading={importLoading} submitImport={submitScannerImport} />
      ) : null}

      {hasApi && !showSettings && view === VIEWS.CLAIMS && permissions.canClaims ? (
        <ClaimsFeature
          config={config}
          currentUser={currentUser}
          canConfigure={permissions.canConfig}
          onStatus={setStatus}
          onQueueAction={(payload, summary) => enqueuePendingAction("updateClaimCard", payload, summary)}
        />
      ) : null}

      {hasApi && !showSettings && view === VIEWS.SALE ? (
        cartOpen ? (
          <CartScreen
            cart={cart}
            totals={totals}
            updateCartItem={updateCartItem}
            changeQty={changeQty}
            removeItem={removeItem}
            clearCart={clearCart}
            buyer={buyer}
            setBuyer={setBuyer}
            origin={origin}
            setOrigin={setOrigin}
            submitSale={submitSale}
            loading={loading}
            onBack={() => setCartOpen(false)}
          />
        ) : selectedCard ? (
          <CardDetailScreen
            card={selectedCard}
            loading={selectedCardLoading}
            onBack={() => setSelectedCard(null)}
            onAdd={(card, prices) => {
              handleAddToCart(card, prices);
            }}
            onAddAndBack={(card, prices) => {
              handleAddToCart(card, prices);
              setSelectedCard(null);
            }}
            onAddAndCart={(card, prices) => {
              handleAddToCart(card, prices);
              setSelectedCard(null);
              setCartOpen(true);
            }}
          />
        ) : (
          <SaleScreen
            query={query}
            setQuery={setQuery}
            runSearch={runSearch}
            loading={loading}
            results={filteredResults}
            rawResultCount={adjustedResults.length}
            filters={saleFilters}
            setFilters={setSaleFilters}
            filterOptions={saleFilterOptions}
            addToCart={(item) => {
              handleAddToCart(item);
            }}
            lastAddedSku={lastAddedSku}
            recentSearches={recentSearches}
            favorites={favorites}
            toggleFavorite={toggleFavorite}
            selectCard={openCardDetail}
            cart={cart}
            totals={totals}
            updateCartItem={updateCartItem}
            changeQty={changeQty}
            removeItem={removeItem}
            buyer={buyer}
            setBuyer={setBuyer}
            origin={origin}
            setOrigin={setOrigin}
            submitSale={submitSale}
          />
        )
      ) : null}

      {hasApi && !showSettings && view === VIEWS.ORDERS ? (
        paymentOrder ? (
          <OrderPaymentScreen
            order={paymentOrder}
            loading={!!updatingOrders[paymentOrder.orderId]}
            onBack={() => setPaymentOrder(null)}
            onSubmit={submitOrderPayment}
          />
        ) : selectedOrder ? (
          <OrderDetailScreen
            order={selectedOrder}
            updatingOrders={updatingOrders}
            loading={loading}
            onBack={() => setSelectedOrder(null)}
            markOrder={markOrder}
            onToggleLine={togglePackingLine}
            onPayment={setPaymentOrder}
            onComplete={confirmCompleteOrder}
            onMessage={generateBuyerMessageForOrder}
          />
        ) : (
          <OrdersScreen
            orders={orders}
            visibleOrders={filteredOrders}
            loading={loading}
            updatingOrders={updatingOrders}
            orderQuery={orderQuery}
            setOrderQuery={setOrderQuery}
            orderStatus={orderStatus}
            setOrderStatus={setOrderStatus}
            loadOrders={loadOrders}
            openPacking={setSelectedOrder}
            openPayment={setPaymentOrder}
            completeOrder={confirmCompleteOrder}
            onMessage={generateBuyerMessageForOrder}
            generatePendingLabels={generateLabelsForPendingOrders}
            labelsLoading={orderLabelsLoading}
          />
        )
      ) : null}

      {buyerMessage ? (
        <BuyerMessagePanel
          data={buyerMessage}
          onClose={() => setBuyerMessage(null)}
          onCopy={async () => {
            const copied = await copyTextToClipboard(buyerMessage.message);
            setStatus(copied ? "Mensaje copiado" : "No pude copiar automaticamente");
            Alert.alert(copied ? "Copiado" : "Copialo manualmente", copied ? "Mensaje listo para pegar." : "Selecciona el texto y copialo desde el navegador.");
          }}
          onShare={() => Share.share({ message: buyerMessage.message }).catch((err) => Alert.alert("No pude compartir", errorText(err)))}
        />
      ) : null}

      <BottomNavigation
        view={view}
        permissions={permissions}
        cartCount={totals.count}
        pendingCount={pendingSaleCount + pendingActionCount}
        onOpen={openView}
      />
    </SafeAreaView>
  );
}

function BottomNavigation({ view, permissions, cartCount, pendingCount, onOpen }) {
  const tabs = [
    { view: VIEWS.DASHBOARD, label: "Inicio", icon: "home-outline", activeIcon: "home" },
    { view: VIEWS.SALE, label: "Venta", icon: "search-outline", activeIcon: "search" },
    ...(permissions.canOrders ? [{ view: VIEWS.ORDERS, label: "Ordenes", icon: "cube-outline", activeIcon: "cube" }] : []),
    ...(permissions.canClaims ? [{ view: VIEWS.CLAIMS, label: "Claims", icon: "layers-outline", activeIcon: "layers" }] : []),
    { view: VIEWS.MORE, label: "Mas", icon: "grid-outline", activeIcon: "grid" }
  ];
  const activeMain = [VIEWS.DASHBOARD, VIEWS.SALE, VIEWS.ORDERS, VIEWS.CLAIMS, VIEWS.MORE].includes(view) ? view : VIEWS.MORE;
  return (
    <View style={styles.bottomNav}>
      {tabs.map((tab) => {
        const active = activeMain === tab.view;
        const badge = tab.view === VIEWS.SALE ? cartCount : tab.view === VIEWS.MORE ? pendingCount : 0;
        return (
          <TapPressable key={tab.view} style={styles.bottomNavButton} onPress={() => onOpen(tab.view)} scaleTo={0.92}>
            <View>
              <Ionicons name={active ? tab.activeIcon : tab.icon} size={23} color={active ? "#ef233c" : "#a1a1aa"} />
              {badge ? <View style={styles.bottomBadge}><Text style={styles.bottomBadgeText}>{badge > 99 ? "99" : badge}</Text></View> : null}
            </View>
            <Text style={[styles.bottomNavLabel, active && styles.bottomNavLabelActive]}>{tab.label}</Text>
          </TapPressable>
        );
      })}
    </View>
  );
}

function MoreScreen({ permissions, health, apiOnline, pendingActions, pendingSales, syncing, currentUser, users, onSync, onOpen, onSettings, onLogout, onResetPassword }) {
  const options = [
    permissions.canManageStock && { view: VIEWS.STOCK, label: "Stock", sub: "Cantidad, precios y ubicaciones", icon: "albums-outline" },
    permissions.canPurchases && { view: VIEWS.PURCHASES, label: "Compras", sub: "Lotes y recepciones parciales", icon: "bag-handle-outline" },
    permissions.canImportStock && { view: VIEWS.IMPORT, label: "Importar", sub: "CSV MonPrice y revision", icon: "cloud-upload-outline" },
    permissions.canClaims && { view: VIEWS.CLAIMS, label: "Claims", sub: "Preparar, revisar y publicar", icon: "layers-outline" },
    permissions.canHistory && { view: VIEWS.HISTORY, label: "Historial", sub: "Ventas, filtros y anulaciones", icon: "time-outline" }
  ].filter(Boolean);
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      <View style={styles.userPanel}>
        <UserAvatar user={currentUser} size={54} />
        <View style={styles.userPanelText}>
          <Text style={styles.userPanelName}>{currentUser.name}</Text>
          <Text style={styles.userPanelSub}>{roleLabel(currentUser.role)}</Text>
        </View>
        <TapPressable style={styles.smallButton} onPress={onLogout} scaleTo={0.95}>
          <Ionicons name="log-out-outline" size={17} color="#f8fafc" />
          <Text style={styles.smallButtonText}>Salir</Text>
        </TapPressable>
      </View>
      <View style={[styles.healthPanel, !apiOnline && styles.healthPanelWarn]}>
        <View style={styles.healthIcon}><Ionicons name={apiOnline ? "shield-checkmark" : "cloud-offline-outline"} size={26} color={apiOnline ? "#22c55e" : "#facc15"} /></View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{apiOnline ? "Sistema conectado" : "Trabajando sin conexion"}</Text>
          <Text style={styles.cardSub}>{health ? `${health.pendingReview || 0} revisiones pendientes` : "Estado del HUB no disponible"}</Text>
        </View>
        <TapPressable style={styles.iconButton} onPress={onSync}>{syncing ? <ActivityIndicator color="#ef233c" /> : <Ionicons name="sync" size={20} color="#ef233c" />}</TapPressable>
      </View>
      {(pendingActions.length || pendingSales.length) ? (
        <View style={styles.pendingSalesPanel}>
          <Text style={styles.sectionTitle}>Cola offline</Text>
          <Text style={styles.pendingSalesSub}>{pendingSales.length} ventas y {pendingActions.length} acciones esperando sincronizacion</Text>
          {pendingActions.slice(0, 5).map((action) => <View key={action.id} style={styles.pendingSaleRow}><View style={styles.cardBody}><Text style={styles.pendingSaleBuyer}>{action.summary}</Text><Text style={styles.pendingSaleMeta}>{action.attempts || 0} intentos</Text></View><Ionicons name="time-outline" size={20} color="#facc15" /></View>)}
        </View>
      ) : null}
      <View style={styles.moreGrid}>
        {options.map((option) => (
          <TapPressable key={option.view} style={styles.moreAction} onPress={() => onOpen(option.view)} scaleTo={0.97}>
            <Ionicons name={option.icon} size={25} color="#ef233c" />
            <Text style={styles.configActionTitle}>{option.label}</Text>
            <Text style={styles.configActionSub}>{option.sub}</Text>
          </TapPressable>
        ))}
      </View>
      {permissions.canConfig ? (
        <TapPressable style={styles.configAction} onPress={onSettings} scaleTo={0.97}>
          <View style={styles.actionWithIcon}><Ionicons name="settings-outline" size={23} color="#ef233c" /><View style={styles.cardBody}><Text style={styles.configActionTitle}>Configuracion</Text><Text style={styles.configActionSub}>API, token y diagnostico</Text></View></View>
        </TapPressable>
      ) : null}
      {permissions.canResetPasswords ? (
        <View style={styles.adminPanel}>
          <Text style={styles.sectionTitle}>Accesos del equipo</Text>
          <Text style={styles.adminPanelSub}>Desde aca podes reiniciar un acceso sin tocar la planilla.</Text>
          {users.map((user) => (
            <View key={user.id} style={styles.adminUserRow}>
              <UserAvatar user={user} size={42} />
              <View style={styles.adminUserText}>
                <Text style={styles.adminUserName}>{user.name}</Text>
                <Text style={styles.adminUserRole}>{roleLabel(user.role)}</Text>
              </View>
              <TapPressable style={styles.iconButton} onPress={() => onResetPassword(user)} scaleTo={0.94} accessibilityLabel={`Resetear acceso de ${user.name}`}>
                <Ionicons name="key-outline" size={19} color="#ef233c" />
              </TapPressable>
            </View>
          ))}
        </View>
      ) : null}
      <Text style={styles.versionText}>UltimoTurno {APP_VERSION}</Text>
    </ScrollView>
  );
}

function LoginScreen({ users, defaultUser, authStatus, biometricStatus, biometricAvailable, biometricLabel, passwordsPaused, onLogin, onBiometricLogin }) {
  const [selectedUser, setSelectedUser] = useState(defaultUser || null);
  const [choosingUser, setChoosingUser] = useState(passwordsPaused || !defaultUser);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [working, setWorking] = useState(false);
  const biometricPrompted = useRef(false);
  const hasPassword = selectedUser ? !!authStatus[selectedUser.id] : false;
  const canUseBiometric = !!(selectedUser && hasPassword && biometricAvailable && biometricStatus[selectedUser.id]);

  useEffect(() => {
    if (!selectedUser && defaultUser && !choosingUser) setSelectedUser(defaultUser);
  }, [defaultUser, selectedUser, choosingUser]);

  useEffect(() => {
    biometricPrompted.current = false;
  }, [selectedUser && selectedUser.id]);

  useEffect(() => {
    if (!canUseBiometric || working || biometricPrompted.current) return;
    biometricPrompted.current = true;
    submitBiometric();
  }, [canUseBiometric, working, selectedUser && selectedUser.id]);

  async function submit() {
    if (!selectedUser || working) return;
    setWorking(true);
    setLoginError("");
    const result = await onLogin(selectedUser, password, confirmPassword);
    setWorking(false);
    if (!result.ok) {
      setLoginError(result.error || "No pude iniciar sesion.");
      return;
    }
    setPassword("");
    setConfirmPassword("");
  }

  async function submitBiometric() {
    if (!selectedUser || working) return;
    setWorking(true);
    setLoginError("");
    const result = await onBiometricLogin(selectedUser);
    setWorking(false);
    if (!result.ok) setLoginError(result.error || `No pude validar ${biometricLabel}.`);
  }

  async function selectUser(user) {
    if (!passwordsPaused) {
      setSelectedUser(user);
      setChoosingUser(false);
      return;
    }
    if (working) return;
    setWorking(true);
    setLoginError("");
    const result = await onLogin(user, "", "");
    setWorking(false);
    if (!result.ok) setLoginError(result.error || "No pude abrir el perfil.");
  }

  if (selectedUser && !choosingUser && !passwordsPaused) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.loginContent} keyboardShouldPersistTaps="handled">
        <View style={styles.loginBrand}>
          <UserAvatar user={selectedUser} size={118} />
          <Text style={styles.loginTitle}>{selectedUser.name}</Text>
          <Text style={styles.loginSub}>{hasPassword ? "Ingresar contrasena" : "Crear contrasena"}</Text>
        </View>

        <View style={styles.loginForm}>
          {canUseBiometric ? (
            <TapPressable style={styles.biometricButton} onPress={submitBiometric} disabled={working} scaleTo={0.96}>
              <Text style={styles.biometricButtonText}>{working ? `Validando ${biometricLabel}...` : `Entrar con ${biometricLabel}`}</Text>
            </TapPressable>
          ) : null}
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={hasPassword ? "Contrasena" : "Nueva contrasena"}
            placeholderTextColor="#71717a"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          {!hasPassword ? (
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repetir contrasena"
              placeholderTextColor="#71717a"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          ) : null}
          {loginError ? <Text style={styles.loginError}>{loginError}</Text> : null}
          <TapPressable style={[styles.primaryButton, working && styles.disabledButton]} onPress={submit} disabled={working} scaleTo={0.97}>
            <Text style={styles.primaryText}>{working ? "..." : hasPassword ? "Entrar" : "Crear y entrar"}</Text>
          </TapPressable>
          <TapPressable style={styles.smallButton} onPress={() => {
            setChoosingUser(true);
            setPassword("");
            setConfirmPassword("");
            setLoginError("");
          }} scaleTo={0.95}>
            <Text style={styles.smallButtonText}>Cambiar usuario</Text>
          </TapPressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.loginContent}>
      <View style={styles.loginBrand}>
        <Image source={BRAND_LOGO} style={styles.loginLogo} resizeMode="contain" />
        <Text style={styles.loginTitle}>UltimoTurno</Text>
        <Text style={styles.loginSub}>Elegir perfil</Text>
      </View>

      <View style={styles.loginUsers}>
        {users.map((user) => (
          <TapPressable key={user.id} style={styles.loginUserCard} onPress={() => selectUser(user)} disabled={working} scaleTo={0.97}>
            <UserAvatar user={user} size={82} />
            <View style={styles.loginUserText}>
              <Text style={styles.loginUserName}>{user.name}</Text>
              <Text style={styles.loginUserSub}>
                {passwordsPaused ? "Entrar sin contrasena" : authStatus[user.id] ? (biometricStatus[user.id] ? `${biometricLabel} activo` : "Con contrasena") : "Configurar acceso"}
              </Text>
            </View>
          </TapPressable>
        ))}
      </View>
    </ScrollView>
  );
}

function DashboardScreen({
  dashboard,
  loading,
  onRefresh,
  onSale,
  onOrders,
  onHistory,
  onPurchases,
  onImport,
  onClaims,
  onStock,
  onMore,
  onSettings,
  currentUser,
  permissions,
  onLogout,
  pendingSales,
  syncingSales,
  onSyncPendingSales
}) {
  const summary = (dashboard && dashboard.summary) || {};
  const orders = (dashboard && dashboard.orders) || [];
  const pendingTotals = summarizePendingSales(pendingSales);
  const weekTrend = summary.soldWeekTrend || [];
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
      <DashboardHero summary={summary} trend={weekTrend} />

      <View style={styles.dashboardGrid}>
        {permissions.canOrders ? <Metric title="Ordenes activas" value={summary.activeOrders || 0} /> : null}
        {permissions.canOrders ? <Metric title="Por cobrar" value={summary.unpaidOrders || 0} sub={formatArs(summary.arsToCollect || 0)} /> : null}
        {permissions.canOrders ? <Metric title="Por entregar" value={summary.undeliveredOrders || 0} /> : <Metric title="Vendido semana" value={formatQty(summary.soldWeekCards || 0)} sub={formatArs(summary.soldWeekArs || 0)} />}
        <Metric title="Stock" value={formatQty(summary.stockUnits || 0)} sub={`${formatQty(summary.stockSkus || 0)} SKUs`} />
      </View>

      <View style={styles.userPanel}>
        <UserAvatar user={currentUser} size={54} />
        <View style={styles.userPanelText}>
          <Text style={styles.userPanelName}>{currentUser.name}</Text>
          <Text style={styles.userPanelSub}>Perfil activo</Text>
        </View>
        <TapPressable style={styles.smallButton} onPress={onLogout} scaleTo={0.95}>
          <Text style={styles.smallButtonText}>Cambiar</Text>
        </TapPressable>
      </View>

      <View style={styles.actionRow}>
        <TapPressable style={styles.bigAction} onPress={onSale} scaleTo={0.97}>
          <Ionicons name="search" size={24} color="#fff" />
          <Text style={styles.bigActionTitle}>Venta</Text>
          <Text style={styles.bigActionSub}>Buscar cartas y cerrar mesa</Text>
        </TapPressable>
        {permissions.canOrders ? (
          <TapPressable style={styles.bigActionAlt} onPress={onOrders} scaleTo={0.97}>
            <Ionicons name="cube-outline" size={24} color="#fff" />
            <Text style={styles.bigActionTitle}>Ordenes</Text>
            <Text style={styles.bigActionSub}>Cobrar y entregar claims</Text>
          </TapPressable>
        ) : null}
      </View>

      {permissions.canClaims ? (
        <TapPressable style={styles.configAction} onPress={onClaims} scaleTo={0.97}>
          <View style={styles.actionWithIcon}>
            <Ionicons name="layers-outline" size={23} color="#ef233c" />
            <View style={styles.cardBody}>
              <Text style={styles.configActionTitle}>Claims</Text>
              <Text style={styles.configActionSub}>Importar, revisar cartas y crear adelantos</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#a1a1aa" />
          </View>
        </TapPressable>
      ) : null}

      {permissions.canPurchases || permissions.canImportStock ? (
        <View style={styles.actionRow}>
          {permissions.canPurchases ? (
            <TapPressable style={styles.configActionHalf} onPress={onPurchases} scaleTo={0.97}>
              <Ionicons name="bag-handle-outline" size={22} color="#ef233c" />
              <Text style={styles.configActionTitle}>Compras</Text>
              <Text style={styles.configActionSub}>Claims comprados y recepcion</Text>
            </TapPressable>
          ) : null}
          {permissions.canImportStock ? (
            <TapPressable style={styles.configActionHalf} onPress={onImport} scaleTo={0.97}>
              <Ionicons name="cloud-upload-outline" size={22} color="#ef233c" />
              <Text style={styles.configActionTitle}>Importar</Text>
              <Text style={styles.configActionSub}>CSV escaneado a stock</Text>
            </TapPressable>
          ) : null}
        </View>
      ) : null}

      {permissions.canManageStock ? (
        <TapPressable style={styles.configAction} onPress={onStock} scaleTo={0.97}>
          <View style={styles.actionWithIcon}>
            <Ionicons name="albums-outline" size={22} color="#ef233c" />
            <View style={styles.cardBody}>
              <Text style={styles.configActionTitle}>Gestionar stock</Text>
              <Text style={styles.configActionSub}>Cantidad, precio, ubicacion y estado</Text>
            </View>
          </View>
        </TapPressable>
      ) : null}

      {permissions.canHistory || permissions.canConfig ? (
        <View style={styles.actionRow}>
          {permissions.canHistory ? (
            <TapPressable style={styles.configActionHalf} onPress={onHistory} scaleTo={0.97}>
              <Ionicons name="time-outline" size={22} color="#ef233c" />
              <Text style={styles.configActionTitle}>Historial</Text>
              <Text style={styles.configActionSub}>Ventas cerradas hoy</Text>
            </TapPressable>
          ) : null}
          {permissions.canConfig ? (
            <TapPressable style={styles.configActionHalf} onPress={onSettings} scaleTo={0.97}>
              <Ionicons name="settings-outline" size={22} color="#ef233c" />
              <Text style={styles.configActionTitle}>Configuracion</Text>
              <Text style={styles.configActionSub}>API y token interno</Text>
            </TapPressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Pendientes recientes</Text>
        <TapPressable style={styles.smallButton} onPress={onRefresh} scaleTo={0.95}>
          <Text style={styles.smallButtonText}>{loading ? "..." : "Actualizar"}</Text>
        </TapPressable>
      </View>

      {pendingSales.length ? (
        <View style={styles.pendingSalesPanel}>
          <View style={styles.sectionHead}>
            <View>
              <Text style={styles.sectionTitle}>Ventas pendientes</Text>
              <Text style={styles.pendingSalesSub}>
                {formatQty(pendingSales.length)} en cola - {formatArs(pendingTotals.ars)}{pendingTotals.usd ? ` + ${formatUsd(pendingTotals.usd)}` : ""}
              </Text>
            </View>
            <TapPressable style={[styles.smallButton, syncingSales && styles.disabledButton]} onPress={onSyncPendingSales} disabled={syncingSales} scaleTo={0.95}>
              <Text style={styles.smallButtonText}>{syncingSales ? "..." : "Sync"}</Text>
            </TapPressable>
          </View>
          {pendingSales.slice(0, 4).map((sale) => (
            <View key={sale.localSaleId} style={styles.pendingSaleRow}>
              <View style={styles.cardBody}>
                <Text style={styles.pendingSaleBuyer}>{sale.summary.buyer || "Mesa"}</Text>
                <Text style={styles.pendingSaleMeta}>
                  {formatQty(sale.summary.cards)} cartas - {sale.summary.seller || "Sin vendedor"}
                </Text>
                {sale.lastError ? <Text style={styles.pendingSaleError} numberOfLines={1}>{sale.lastError}</Text> : null}
              </View>
              <Text style={styles.pendingSaleTotal}>
                {formatArs(sale.summary.ars)}{sale.summary.usd ? ` + ${formatUsd(sale.summary.usd)}` : ""}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {permissions.canOrders ? orders.map((order) => (
        <OrderCard key={order.orderId} order={order} compact />
      )) : null}
      {permissions.canOrders && !orders.length ? <Text style={styles.empty}>No hay ordenes pendientes.</Text> : null}
    </ScrollView>
  );
}

function HistoryScreen({ data, loading, onRefresh, query, setQuery, range, setRange, onCancelSale, canCancel }) {
  const summary = (data && data.summary) || {};
  const sales = (data && data.sales) || [];
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");

  function confirmCancel() {
    if (!cancelTarget || !cancelReason.trim()) return;
    Alert.alert("Confirmar anulacion", `Anular ${cancelTarget.saleKey} y devolver sus cartas al stock?`, [
      { text: "Volver", style: "cancel" },
      { text: "Anular venta", style: "destructive", onPress: () => {
        onCancelSale(cancelTarget, cancelReason.trim());
        setCancelTarget(null);
        setCancelReason("");
      } }
    ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
      <View style={styles.sectionHead}>
        <View>
          <Text style={styles.sectionTitle}>Historial de ventas</Text>
          <Text style={styles.historyUpdated}>{data && data.updatedAt ? `Actualizado ${data.updatedAt}` : "Todavia sin actualizar"}</Text>
        </View>
        <TapPressable style={styles.iconButton} onPress={onRefresh} scaleTo={0.95}>
          {loading ? <ActivityIndicator color="#ef233c" /> : <Ionicons name="refresh" size={20} color="#ef233c" />}
        </TapPressable>
      </View>

      <View style={styles.searchBoxSlim}>
        <TextInput value={query} onChangeText={setQuery} onSubmitEditing={onRefresh} placeholder="Comprador, carta o vendedor" placeholderTextColor="#71717a" style={styles.input} />
        <TapPressable style={styles.goButtonSmall} onPress={onRefresh} scaleTo={0.94}><Ionicons name="search" size={19} color="#fff" /></TapPressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {[{ value: "today", label: "Hoy" }, { value: "week", label: "7 dias" }, { value: "month", label: "30 dias" }, { value: "all", label: "Todo" }].map((option) => (
          <TapPressable key={option.value} style={[styles.filterChip, range === option.value && styles.filterChipActive]} onPress={() => setRange(option.value)} scaleTo={0.96}>
            <Text style={[styles.filterChipText, range === option.value && styles.filterChipTextActive]}>{option.label}</Text>
          </TapPressable>
        ))}
      </ScrollView>

      <View style={styles.dashboardGrid}>
        <Metric title="Ventas" value={summary.sales || 0} />
        <Metric title="Cartas" value={formatQty(summary.cards || 0)} />
        <Metric title="ARS" value={formatArs(summary.totalArs || 0)} />
        <Metric title="USD" value={formatUsd(summary.totalUsd || 0)} />
      </View>

      {sales.map((sale) => (
        <View key={sale.saleKey} style={styles.historyCard}>
          <View style={styles.orderTop}>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{sale.buyer || "Mesa"}</Text>
              <Text style={styles.cardSub}>{sale.origin || "Venta"} {sale.date ? `- ${sale.date}` : ""}</Text>
            </View>
            <Text style={styles.orderTotal}>{formatArs(sale.totalArs)}{sale.totalUsd ? ` + ${formatUsd(sale.totalUsd)}` : ""}</Text>
          </View>
          <Text style={styles.orderItems} numberOfLines={4}>{sale.itemsText || "Sin detalle"}</Text>
          <View style={styles.chips}>
            <Chip label={`${formatQty(sale.cards)} cartas`} />
            {sale.seller ? <Chip label={`Vendedor ${sale.seller}`} /> : null}
          </View>
          {canCancel && !sale.cancelled ? (
            <TapPressable style={styles.dangerOutlineButton} onPress={() => setCancelTarget(sale)} scaleTo={0.96}>
              <Ionicons name="arrow-undo-outline" size={18} color="#f87171" />
              <Text style={styles.dangerOutlineText}>Anular y devolver stock</Text>
            </TapPressable>
          ) : null}
        </View>
      ))}

      {cancelTarget ? (
        <View style={styles.dangerPanel}>
          <Text style={styles.sectionTitle}>Anular {cancelTarget.saleKey}</Text>
          <TextInput value={cancelReason} onChangeText={setCancelReason} placeholder="Motivo obligatorio" placeholderTextColor="#71717a" style={styles.input} />
          <View style={styles.inlineActions}>
            <TapPressable style={styles.orderButton} onPress={() => { setCancelTarget(null); setCancelReason(""); }}><Text style={styles.orderButtonText}>Cancelar</Text></TapPressable>
            <TapPressable style={[styles.dangerButton, !cancelReason.trim() && styles.disabledButton]} onPress={confirmCancel} disabled={!cancelReason.trim()}><Text style={styles.primaryText}>Confirmar anulacion</Text></TapPressable>
          </View>
        </View>
      ) : null}

      {!sales.length ? (
        <View style={styles.richEmpty}>
          <Text style={styles.emptyTitle}>{loading ? "Cargando..." : "Sin ventas hoy"}</Text>
          <Text style={styles.empty}>Cuando cierres una venta desde la app va a aparecer aca.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function DashboardHero({ summary, trend }) {
  const points = (trend || []).map((item) => Number(item.ars) || 0);
  const totalWeek = Number(summary.soldWeekArs) || 0;
  const stockValue = Number(summary.stockValueArs) || 0;
  return (
    <View style={styles.businessHero}>
      <View style={styles.businessHeroTop}>
        <Image source={BRAND_LOGO} style={styles.businessHeroLogo} resizeMode="contain" />
        <View style={styles.businessHeroCopy}>
          <Text style={styles.businessHeroEyebrow}>UltimoTurno</Text>
          <Text style={styles.businessHeroTitle}>Resumen vivo</Text>
        </View>
      </View>

      <View style={styles.businessHeroStats}>
        <View style={styles.businessHeroStat}>
          <Text style={styles.businessHeroLabel}>Vendido esta semana</Text>
          <Text style={styles.businessHeroValue}>{formatArs(totalWeek)}</Text>
          <Text style={styles.businessHeroSub}>{formatQty(summary.soldWeekCards || 0)} cartas{summary.soldWeekUsd ? ` + ${formatUsd(summary.soldWeekUsd)}` : ""}</Text>
        </View>
        <View style={styles.businessHeroStat}>
          <Text style={styles.businessHeroLabel}>Valor stock</Text>
          <Text style={styles.businessHeroValue}>{formatArs(stockValue)}</Text>
          <Text style={styles.businessHeroSub}>{formatQty(summary.stockUnits || 0)} cartas{summary.stockValueUsd ? ` - ${formatUsd(summary.stockValueUsd)}` : ""}</Text>
        </View>
      </View>

      <MiniTrend points={points} labels={(trend || []).map((item) => item.label)} />
      <MiniLineTrend data={summary.stockValueTrend || []} />
    </View>
  );
}

function MiniTrend({ points, labels }) {
  const values = points && points.length ? points : [0, 0, 0, 0, 0, 0, 0];
  const max = Math.max(1, ...values);
  return (
    <View style={styles.trendWrap}>
      <View style={styles.trendBars}>
        {values.map((value, index) => {
          const height = Math.max(8, Math.round((Number(value) || 0) / max * 54));
          return (
            <View key={`${index}-${labels && labels[index] || ""}`} style={styles.trendColumn}>
              <View style={[styles.trendBar, { height }]} />
              <Text style={styles.trendLabel}>{labels && labels[index] ? labels[index] : ""}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function MiniLineTrend({ data }) {
  const values = (data || []).map((item) => Number(item.ars) || 0);
  if (values.length < 2) {
    return <View style={styles.lineTrendEmpty}><Text style={styles.trendEmptyText}>La evolucion del stock aparecera con los snapshots diarios.</Text></View>;
  }
  const width = 320;
  const height = 72;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const points = values.map((value, index) => {
    const x = (index / Math.max(1, values.length - 1)) * width;
    const y = height - 8 - ((value - min) / span) * (height - 18);
    return `${x},${y}`;
  }).join(" ");
  const last = points.split(" ").pop().split(",").map(Number);
  return (
    <View style={styles.lineTrendWrap}>
      <View style={styles.sectionHead}><Text style={styles.businessHeroLabel}>Evolucion del stock</Text><Text style={styles.lineTrendValue}>{formatArs(values[values.length - 1])}</Text></View>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Polyline points={points} fill="none" stroke="#ef233c" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={last[0]} cy={last[1]} r="4" fill="#ef233c" />
      </Svg>
    </View>
  );
}

function PurchasesScreen({ purchases, loading, purchaseQuery, setPurchaseQuery, loadPurchases, submitPurchase, markReceived }) {
  const [provider, setProvider] = useState("");
  const [pcUrl, setPcUrl] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitUsd, setUnitUsd] = useState(0);
  const [notes, setNotes] = useState("");
  const [receivedNow, setReceivedNow] = useState(false);
  const [draftItems, setDraftItems] = useState([]);
  const groups = useMemo(() => groupPurchases(purchases), [purchases]);

  function resetLine() {
    setPcUrl("");
    setQuantity(1);
    setUnitUsd(0);
  }

  function addLine() {
    if (!pcUrl.trim()) {
      Alert.alert("Falta link", "Pega el link de PriceCharting de la carta comprada.");
      return;
    }
    setDraftItems((current) => [...current, {
      localKey: makeLocalActionId("compra-linea"), pcUrl: pcUrl.trim(),
      quantity: Math.max(1, Number(quantity) || 1), unitUsd: Number(unitUsd) || 0
    }]);
    resetLine();
    impactLight();
  }

  function submit() {
    const items = draftItems.length ? draftItems : (pcUrl.trim() ? [{ pcUrl: pcUrl.trim(), quantity: Math.max(1, Number(quantity) || 1), unitUsd: Number(unitUsd) || 0 }] : []);
    if (!items.length) {
      Alert.alert("Compra vacia", "Agrega al menos una carta al lote.");
      return;
    }
    submitPurchase({ provider, items, notes, received: receivedNow });
    setDraftItems([]);
    resetLine();
    setNotes("");
    setReceivedNow(false);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
      <View style={styles.formPanel}>
        <View style={styles.sectionHead}>
          <View><Text style={styles.sectionTitle}>Nuevo lote de compra</Text><Text style={styles.historyUpdated}>{draftItems.length} lineas preparadas</Text></View>
          <Ionicons name="bag-add-outline" size={24} color="#ef233c" />
        </View>
        <TextInput value={provider} onChangeText={setProvider} placeholder="Proveedor / claim" placeholderTextColor="#71717a" style={styles.input} />
        <TextInput value={pcUrl} onChangeText={setPcUrl} placeholder="Link PriceCharting" placeholderTextColor="#71717a" autoCapitalize="none" autoCorrect={false} style={styles.input} />
        <View style={styles.priceRow}>
          <MoneyInput label="Cantidad" value={quantity} onChange={setQuantity} />
          <MoneyInput label="USD unidad" value={unitUsd} onChange={setUnitUsd} />
          <TapPressable style={styles.addLineButton} onPress={addLine} scaleTo={0.94}><Ionicons name="add" size={24} color="#fff" /></TapPressable>
        </View>
        {draftItems.map((item, index) => (
          <View key={item.localKey} style={styles.draftPurchaseLine}>
            <View style={styles.cardBody}><Text style={styles.cardTitle} numberOfLines={1}>{item.pcUrl.split("/").pop()}</Text><Text style={styles.cardSub}>{item.quantity} x {formatUsd(item.unitUsd)}</Text></View>
            <TapPressable style={styles.iconButton} onPress={() => setDraftItems((current) => current.filter((_, i) => i !== index))}><Ionicons name="trash-outline" size={19} color="#f87171" /></TapPressable>
          </View>
        ))}
        <TextInput value={notes} onChangeText={setNotes} placeholder="Notas del lote" placeholderTextColor="#71717a" style={styles.input} />
        <View style={styles.inlineActions}>
          <TapPressable style={[styles.filterChip, receivedNow && styles.filterChipActive]} onPress={() => setReceivedNow((value) => !value)} scaleTo={0.96}>
            <Text style={[styles.filterChipText, receivedNow && styles.filterChipTextActive]}>Recibida ahora</Text>
          </TapPressable>
          <TapPressable style={[styles.primaryButton, loading && styles.disabledButton]} onPress={submit} disabled={loading} scaleTo={0.97}>
            <Text style={styles.primaryText}>{loading ? "..." : `Guardar lote${draftItems.length ? ` (${draftItems.length})` : ""}`}</Text>
          </TapPressable>
        </View>
      </View>

      <View style={styles.searchBoxSlim}>
        <TextInput
          value={purchaseQuery}
          onChangeText={setPurchaseQuery}
          onSubmitEditing={() => loadPurchases(purchaseQuery)}
          placeholder="Buscar compra pendiente"
          placeholderTextColor="#71717a"
          style={styles.searchInput}
        />
        <TapPressable style={styles.goButton} onPress={() => loadPurchases(purchaseQuery)} scaleTo={0.93}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.goText}>Go</Text>}
        </TapPressable>
      </View>

      <Text style={styles.sectionTitle}>Compras pendientes</Text>
      {groups.map((group) => <PurchaseGroupCard key={group.purchaseId} group={group} loading={loading} markReceived={markReceived} />)}
      {!purchases.length ? <Text style={styles.empty}>No hay compras pendientes.</Text> : null}
    </ScrollView>
  );
}

function PurchaseGroupCard({ group, loading, markReceived }) {
  const [partial, setPartial] = useState({});
  return (
    <View style={styles.purchaseCard}>
      <View style={styles.orderTop}>
        <View style={styles.cardBody}><Text style={styles.cardTitle}>{group.provider || "Sin proveedor"}</Text><Text style={styles.cardSub}>{group.purchaseId} - {group.date}</Text></View>
        <Chip label={`${group.items.length} lineas`} />
      </View>
      {group.items.map((purchase) => (
        <View key={`${purchase.row}-${purchase.pcId || purchase.pcUrl}`} style={styles.purchaseLine}>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>{purchase.item || purchase.nombre || "Compra sin nombre"}</Text>
            <Text style={styles.cardSub}>{formatQty(purchase.receivedQuantity)} de {formatQty(purchase.quantity)} recibidas - {purchase.unitUsd ? formatUsd(purchase.unitUsd) : "Sin costo"}</Text>
          </View>
          {!purchase.synced ? (
            <View style={styles.partialReceiveRow}>
              <TextInput value={String(partial[purchase.row] ?? purchase.remainingQuantity ?? 1)} onChangeText={(value) => setPartial((current) => ({ ...current, [purchase.row]: value }))} keyboardType="numeric" style={styles.partialInput} />
              <TapPressable style={[styles.iconPrimaryButton, loading && styles.disabledButton]} onPress={() => markReceived(purchase, Number(partial[purchase.row] ?? purchase.remainingQuantity ?? 1))} disabled={loading}>
                <Ionicons name="checkmark" size={20} color="#fff" />
              </TapPressable>
            </View>
          ) : <Ionicons name="checkmark-circle" size={24} color="#22c55e" />}
        </View>
      ))}
      {group.items.some((item) => !item.synced) ? (
        <TapPressable style={styles.orderButton} onPress={() => markReceived(group.items[0], undefined, true)} disabled={loading}><Text style={styles.orderButtonText}>Recibir lote completo</Text></TapPressable>
      ) : null}
    </View>
  );
}

function ScannerImportScreen({ loading, submitImport }) {
  const [csvText, setCsvText] = useState("");
  const [items, setItems] = useState([]);
  const [lastResult, setLastResult] = useState(null);
  const [fileName, setFileName] = useState("");
  const [fileLoading, setFileLoading] = useState(false);
  const [manualPasteOpen, setManualPasteOpen] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");

  function parse() {
    try {
      if (!csvText.trim()) {
        Alert.alert("Falta CSV", "Elegi un archivo o pega el CSV antes de revisar.");
        return;
      }
      const parsed = parseMonPriceCsv(csvText);
      setItems(parsed);
      setLastResult(null);
      setReviewMessage(`${formatQty(parsed.length)} filas listas para revisar`);
    } catch (err) {
      Alert.alert("CSV invalido", errorText(err));
    }
  }

  function cancelImport() {
    setCsvText("");
    setItems([]);
    setLastResult(null);
    setFileName("");
    setManualPasteOpen(false);
    setReviewMessage("");
  }

  async function pickCsvFile() {
    setFileLoading(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", "text/plain", "application/vnd.ms-excel", "*/*"],
        copyToCacheDirectory: true,
        multiple: false,
        base64: true
      });
      if (result.canceled || !result.assets || !result.assets.length) return;

      const asset = result.assets[0];
      const text = await readPickedTextFile(asset);
      const parsed = parseMonPriceCsv(text);
      setCsvText(text);
      setItems(parsed);
      setFileName(asset.name || "CSV importado");
      setManualPasteOpen(false);
      setLastResult(null);
      setReviewMessage(`${formatQty(parsed.length)} filas listas para revisar`);
    } catch (err) {
      Alert.alert("No pude leer el archivo", errorText(err));
    } finally {
      setFileLoading(false);
    }
  }

  function patchItem(index, patch) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function submit() {
    const active = items.filter((item) => !item.skip && (Number(item.quantity) || 0) > 0);
    if (!active.length) {
      Alert.alert("Nada para importar", "Deja al menos una carta activa con cantidad mayor a cero.");
      return;
    }
    const result = await submitImport(active);
    if (result) {
      setLastResult(result);
      const detailsByKey = {};
      (result.details || []).forEach((detail) => {
        if (detail.localKey) detailsByKey[detail.localKey] = detail;
      });
      if (Object.keys(detailsByKey).length) {
        setItems((current) => current
          .map((item) => {
            const detail = detailsByKey[item.localKey];
            if (!detail) return item;
            if (detail.status === "review") {
              return { ...item, importError: detail.error || "Revisar match", skip: false };
            }
            return item;
          })
          .filter((item) => item.skip || !detailsByKey[item.localKey] || detailsByKey[item.localKey].status === "review"));
      } else {
        setItems((current) => current.filter((item) => item.skip || !active.includes(item)));
      }
      setReviewMessage("");
    }
  }

  const activeCount = items.filter((item) => !item.skip && (Number(item.quantity) || 0) > 0).length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
      <View style={styles.formPanel}>
        <Text style={styles.sectionTitle}>Importar CSV MonPrice</Text>
        <View style={styles.inlineActions}>
          <TapPressable style={[styles.orderButtonPrimary, fileLoading && styles.disabledButton]} onPress={pickCsvFile} disabled={fileLoading} scaleTo={0.96}>
            <Text style={styles.orderButtonPrimaryText}>{fileLoading ? "Leyendo..." : "Elegir archivo CSV"}</Text>
          </TapPressable>
          <TapPressable style={styles.orderButton} onPress={() => setManualPasteOpen((value) => !value)} scaleTo={0.96}>
            <Text style={styles.orderButtonText}>{manualPasteOpen ? "Ocultar pegado" : "Pegar manual"}</Text>
          </TapPressable>
          {fileName ? <Text style={styles.filePickedText} numberOfLines={1}>{fileName}</Text> : null}
        </View>
        {manualPasteOpen ? (
          <TextInput
            value={csvText}
            onChangeText={(text) => {
              setCsvText(text);
              setFileName("");
              setItems([]);
              setReviewMessage("");
            }}
            placeholder="Pega aca el CSV completo con headers"
            placeholderTextColor="#71717a"
            multiline
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, styles.csvInput]}
          />
        ) : csvText ? (
          <View style={styles.csvHiddenNotice}>
            <Text style={styles.csvHiddenText}>{items.length ? `${formatQty(items.length)} filas cargadas para revisar` : "CSV cargado"}</Text>
          </View>
        ) : null}
        <View style={styles.inlineActions}>
          <TapPressable style={styles.orderButton} onPress={parse} scaleTo={0.96}>
            <Text style={styles.orderButtonText}>Revisar CSV</Text>
          </TapPressable>
          <TapPressable style={[styles.orderButton, (!csvText && !items.length) && styles.disabledButton]} onPress={cancelImport} disabled={!csvText && !items.length} scaleTo={0.96}>
            <Text style={styles.orderButtonText}>Cancelar</Text>
          </TapPressable>
          <TapPressable style={[styles.orderButtonPrimary, (!activeCount || loading) && styles.disabledButton]} onPress={submit} disabled={!activeCount || loading} scaleTo={0.96}>
            <Text style={styles.orderButtonPrimaryText}>{loading ? "..." : `Importar ${formatQty(activeCount)}`}</Text>
          </TapPressable>
        </View>
        {reviewMessage ? <Text style={styles.importResult}>{reviewMessage}</Text> : null}
        {lastResult ? (
          <Text style={styles.importResult}>
            Importadas {formatQty(lastResult.imported || 0)} - Revisar {formatQty(lastResult.review || 0)} - Omitidas {formatQty(lastResult.skipped || 0)}
          </Text>
        ) : null}
      </View>

      {items.length ? (
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Revision previa</Text>
          <Text style={styles.filterCountInline}>{formatQty(activeCount)} activas</Text>
        </View>
      ) : null}

      {items.map((item, index) => (
        <View key={item.localKey} style={[styles.importCard, item.skip && styles.importCardSkipped]}>
          <View style={styles.orderTop}>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{item.name || "Sin nombre"}</Text>
              <Text style={styles.cardSub}>{item.expansion || "Sin expansion"} {item.number ? `- ${item.number}` : ""}</Text>
              {item.jpDetected || String(item.language || "").toUpperCase() === "JP" ? (
                <Text style={styles.importWarning}>JP: si no matchea por expansion + numero, pega el link de PriceCharting.</Text>
              ) : null}
              {item.importError ? <Text style={styles.pendingSaleError}>{item.importError}</Text> : null}
            </View>
            <Text style={styles.orderTotal}>{item.averagePrice ? formatUsd(item.averagePrice) : ""}</Text>
          </View>
          <View style={styles.importControls}>
            <TapPressable style={styles.qtyButton} onPress={() => patchItem(index, { quantity: Math.max(0, (Number(item.quantity) || 0) - 1) })} scaleTo={0.9}>
              <Text style={styles.qtyText}>-</Text>
            </TapPressable>
            <Text style={styles.qtyValue}>{formatQty(item.quantity)}</Text>
            <TapPressable style={styles.qtyButton} onPress={() => patchItem(index, { quantity: (Number(item.quantity) || 0) + 1 })} scaleTo={0.9}>
              <Text style={styles.qtyText}>+</Text>
            </TapPressable>
            <TapPressable style={[styles.filterChip, item.skip && styles.filterChipActive]} onPress={() => patchItem(index, { skip: !item.skip })} scaleTo={0.96}>
              <Text style={[styles.filterChipText, item.skip && styles.filterChipTextActive]}>{item.skip ? "Omitida" : "Activa"}</Text>
            </TapPressable>
          </View>
          <View style={styles.priceRow}>
            <MoneyInput label="Ult compra USD" value={item.lastPurchaseUsd} onChange={(value) => patchItem(index, { lastPurchaseUsd: value })} />
            <TextInput value={item.condition} onChangeText={(condition) => patchItem(index, { condition })} placeholder="Cond" placeholderTextColor="#71717a" style={[styles.input, styles.shortInput]} />
            <TextInput value={item.language} onChangeText={(language) => patchItem(index, { language })} placeholder="Idioma" placeholderTextColor="#71717a" style={[styles.input, styles.shortInput]} />
          </View>
          <View style={styles.priceRow}>
            <TextInput
              value={item.pcUrl || ""}
              onChangeText={(pcUrl) => patchItem(index, { pcUrl, importError: "" })}
              placeholder="Link PriceCharting opcional"
              placeholderTextColor="#71717a"
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, styles.flexInput]}
            />
            <TextInput
              value={item.pcId || ""}
              onChangeText={(pcId) => patchItem(index, { pcId, importError: "" })}
              placeholder="PC ID"
              placeholderTextColor="#71717a"
              keyboardType="numeric"
              style={[styles.input, styles.pcIdInput]}
            />
          </View>
        </View>
      ))}

      {!items.length ? (
        <View style={styles.richEmpty}>
          <Text style={styles.emptyTitle}>Sin CSV revisado</Text>
          <Text style={styles.empty}>Pega el export de MonPrice y toca Revisar CSV antes de importar.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function SaleScreen(props) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  return (
    <>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color="#71717a" />
        <TextInput
          value={props.query}
          onChangeText={props.setQuery}
          onSubmitEditing={() => props.runSearch(props.query)}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Buscar carta, expansion, numero o SKU"
          style={styles.searchInputBare}
        />
        <TapPressable style={styles.goButton} onPress={() => props.runSearch(props.query)} scaleTo={0.93}>
          {props.loading ? <ActivityIndicator color="#fff" /> : <Ionicons name="arrow-forward" size={20} color="#ef233c" />}
        </TapPressable>
      </View>

      {!props.query && props.recentSearches && props.recentSearches.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recentSearchWrap} contentContainerStyle={styles.filterRow}>
          <Ionicons name="time-outline" size={17} color="#71717a" />
          {props.recentSearches.map((value) => <TapPressable key={value} style={styles.recentChip} onPress={() => props.setQuery(value)}><Text style={styles.recentChipText}>{value}</Text></TapPressable>)}
        </ScrollView>
      ) : null}

      <SaleFilterBar
        filters={props.filters}
        setFilters={props.setFilters}
        options={props.filterOptions}
        resultCount={props.results.length}
        rawResultCount={props.rawResultCount}
        open={filtersOpen}
        setOpen={setFiltersOpen}
      />

      <ScrollView style={styles.results} contentContainerStyle={styles.resultsGrid} keyboardShouldPersistTaps="handled">
        {props.results.map((item) => (
          <View key={item.sku} style={styles.saleGridCard}>
            <Pressable style={styles.saleGridTapArea} onPress={() => props.selectCard(item)}>
              <View style={styles.saleImageFrame}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.saleGridImage} resizeMode="contain" />
                ) : (
                  <View style={styles.saleGridFallback}>
                    <Text style={styles.resultThumbText}>{getInitials(item.nombre)}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.saleCardTitle} numberOfLines={2}>{item.nombre}</Text>
              <Text style={styles.saleCardSet} numberOfLines={2}>
                {item.expansion}{item.numero ? ` - ${item.numero}` : ""}
              </Text>
              <Text style={styles.saleCardMeta} numberOfLines={1}>
                {item.condicion || "Sin condicion"} - {item.idioma || "Sin idioma"}
              </Text>
              <View style={styles.saleCardFooter}>
                <View>
                  <Text style={styles.saleQty}>Qty: {formatQty(item.quantity)}</Text>
                  {item.pendingQuantity ? <Text style={styles.saleReserved}>Pend: {formatQty(item.pendingQuantity)}</Text> : null}
                  <Text style={styles.saleUsd}>{formatUsd(item.pcUsd)} PC</Text>
                </View>
                <Text style={styles.salePrice}>{formatArs(item.precioFinalArs)}</Text>
              </View>
            </Pressable>
            <AddToCartButton onPress={() => props.addToCart(item)} />
            <TapPressable style={styles.favoriteButton} onPress={() => props.toggleFavorite(item.sku)} scaleTo={0.9}>
              <Ionicons name={props.favorites.includes(item.sku) ? "star" : "star-outline"} size={18} color={props.favorites.includes(item.sku) ? "#facc15" : "#d4d4d8"} />
            </TapPressable>
            {props.lastAddedSku === item.sku ? (
              <View style={styles.addedPill}>
                <Text style={styles.addedPillText}>Agregada</Text>
              </View>
            ) : null}
          </View>
        ))}
        {!props.results.length ? (
          <View style={styles.richEmpty}>
            <Text style={styles.emptyTitle}>{props.loading ? "Buscando..." : props.rawResultCount ? "Sin resultados con estos filtros" : "Busca una carta"}</Text>
            <Text style={styles.empty}>Nombre, expansion, numero, SKU o link de PriceCharting.</Text>
          </View>
        ) : null}
      </ScrollView>

    </>
  );
}

function SaleFilterBar({ filters, setFilters, options, resultCount, rawResultCount, open, setOpen }) {
  function patch(next) {
    setFilters((current) => ({ ...current, ...next }));
  }
  const active = activeSaleFilters(filters);

  return (
    <View style={styles.filterCompactPanel}>
      <View style={styles.filterCompactTop}>
        <Text style={styles.filterCount}>{formatQty(resultCount)} de {formatQty(rawResultCount)} cartas</Text>
        <TapPressable style={[styles.filterToggle, open && styles.filterChipActive]} onPress={() => setOpen((value) => !value)} scaleTo={0.96}>
          <Text style={[styles.filterChipText, open && styles.filterChipTextActive]}>Filtros{active.length ? ` (${active.length})` : ""}</Text>
        </TapPressable>
      </View>

      {!open ? (
        <Text style={styles.filterSummary} numberOfLines={1}>{active.length ? active.join(" - ") : "Sin filtros extra"}</Text>
      ) : (
        <View style={styles.filterPanel}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <TapPressable style={[styles.filterChip, filters.stockOnly && styles.filterChipActive]} onPress={() => patch({ stockOnly: !filters.stockOnly })} scaleTo={0.96}>
              <Text style={[styles.filterChipText, filters.stockOnly && styles.filterChipTextActive]}>Stock</Text>
            </TapPressable>
            {SORT_OPTIONS.map((option) => (
              <TapPressable key={option.value} style={[styles.filterChip, filters.sort === option.value && styles.filterChipActive]} onPress={() => patch({ sort: option.value })} scaleTo={0.96}>
                <Text style={[styles.filterChipText, filters.sort === option.value && styles.filterChipTextActive]}>{option.label}</Text>
              </TapPressable>
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {["Todas"].concat(options.conditions).map((value) => (
              <TapPressable key={value} style={[styles.filterChip, filters.condition === value && styles.filterChipActive]} onPress={() => patch({ condition: value })} scaleTo={0.96}>
                <Text style={[styles.filterChipText, filters.condition === value && styles.filterChipTextActive]}>{value}</Text>
              </TapPressable>
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {["Todos"].concat(options.languages).map((value) => (
              <TapPressable key={value} style={[styles.filterChip, filters.language === value && styles.filterChipActive]} onPress={() => patch({ language: value })} scaleTo={0.96}>
                <Text style={[styles.filterChipText, filters.language === value && styles.filterChipTextActive]}>{value}</Text>
              </TapPressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function CartScreen(props) {
  return (
    <View style={styles.cartScreen}>
      <View style={styles.cartSummary}>
        <TapPressable style={styles.smallButton} onPress={props.onBack} scaleTo={0.95}>
          <Text style={styles.smallButtonText}>Volver</Text>
        </TapPressable>
        <View style={styles.cartSummaryText}>
          <Text style={styles.cartTitle}>Carrito ({props.totals.count})</Text>
          <Text style={styles.cartTotal}>
            {formatArs(props.totals.ars)}{props.totals.usd ? ` + ${formatUsd(props.totals.usd)}` : ""}
          </Text>
        </View>
        <TapPressable style={[styles.smallButton, !props.cart.length && styles.disabledButton]} onPress={props.clearCart} disabled={!props.cart.length} scaleTo={0.95}>
          <Text style={styles.smallButtonText}>Vaciar</Text>
        </TapPressable>
      </View>

      <ScrollView style={styles.cartLinesFull} contentContainerStyle={styles.cartLinesContent} keyboardShouldPersistTaps="handled">
        {props.cart.map((item, index) => (
          <View key={item.sku} style={styles.cartLine}>
            <View style={styles.cartInfo}>
              <Text style={styles.cartName}>{item.nombre}</Text>
              <Text style={styles.cartSub}>{item.expansion}{item.numero ? ` #${item.numero}` : ""}</Text>
              <View style={styles.priceRow}>
                <MoneyInput label="ARS unidad" value={item.priceArs} onChange={(priceArs) => props.updateCartItem(index, { priceArs })} />
                <MoneyInput label="USD unidad" value={item.priceUsd} onChange={(priceUsd) => props.updateCartItem(index, { priceUsd })} />
              </View>
            </View>
            <View style={styles.qtyControls}>
              <TapPressable style={styles.qtyButton} onPress={() => props.changeQty(index, 1)} scaleTo={0.9}>
                <Text style={styles.qtyText}>+</Text>
              </TapPressable>
              <Text style={styles.qtyValue}>{item.quantity}</Text>
              <TapPressable style={styles.qtyButton} onPress={() => props.changeQty(index, -1)} scaleTo={0.9}>
                <Text style={styles.qtyText}>-</Text>
              </TapPressable>
              <TapPressable style={styles.removeButton} onPress={() => props.removeItem(index)} scaleTo={0.9}>
                <Text style={styles.removeText}>x</Text>
              </TapPressable>
            </View>
          </View>
        ))}
        {!props.cart.length ? (
          <View style={styles.richEmpty}>
            <Text style={styles.emptyTitle}>Carrito vacio</Text>
            <Text style={styles.empty}>Agrega cartas desde Venta y volve aca para cerrar.</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.saleFields}>
        <TextInput
          value={props.buyer}
          onChangeText={props.setBuyer}
          placeholder="Comprador"
          placeholderTextColor="#71717a"
          style={[styles.input, styles.buyerInput]}
        />
        <View style={styles.originRow}>
          {ORIGINS.map((value) => (
            <Pressable key={value} style={[styles.originButton, props.origin === value && styles.originActive]} onPress={() => props.setOrigin(value)}>
              <Text style={[styles.originText, props.origin === value && styles.originActiveText]}>{value}</Text>
            </Pressable>
          ))}
        </View>
        <TapPressable style={styles.shareButton} onPress={() => shareSaleSummary(props)} disabled={!props.cart.length} scaleTo={0.96}>
          <Ionicons name="share-social-outline" size={19} color="#f8fafc" />
          <Text style={styles.orderButtonText}>Compartir resumen</Text>
        </TapPressable>
        <TapPressable
          style={[styles.primaryButton, (!props.cart.length || props.loading) && styles.disabledButton]}
          onPress={props.submitSale}
          disabled={!props.cart.length || props.loading}
          scaleTo={0.97}
        >
          <Text style={styles.primaryText}>Cerrar venta</Text>
        </TapPressable>
      </View>
    </View>
  );
}

function CardDetailScreen({ card, loading, onBack, onAdd, onAddAndBack, onAddAndCart }) {
  const [priceArs, setPriceArs] = useState(Number(card.precioFinalArs) || 0);
  const [priceUsd, setPriceUsd] = useState(0);
  const titleLine = [card.expansion, card.numero ? `#${card.numero}` : ""].filter(Boolean).join(" ");
  const hasExactPcUrl = isExactPriceChartingUrl(card.pcUrl);
  const hasExactTcgUrl = isExactTcgplayerUrl(card.tcgplayerUrl);
  const pcMargin = card.ultimaCompraUsd && card.pcUsd ? Number(card.pcUsd) - Number(card.ultimaCompraUsd) : 0;

  useEffect(() => {
    setPriceArs(Number(card.precioFinalArs) || 0);
    setPriceUsd(0);
  }, [card.sku, card.precioFinalArs]);

  const pricePatch = { priceArs, priceUsd };

  return (
    <View style={styles.detailShell}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.detailContent} keyboardShouldPersistTaps="handled">
        <View style={styles.detailTopActions}>
          <TapPressable style={styles.smallButton} onPress={onBack} scaleTo={0.95}>
            <Text style={styles.smallButtonText}>Volver</Text>
          </TapPressable>
          <Text style={styles.detailTopHint}>Detalle de carta</Text>
        </View>

        <View style={styles.imagePanel}>
          {loading ? (
            <View style={styles.detailLoading}>
              <ActivityIndicator color="#ef233c" />
              <Text style={styles.detailLoadingText}>Actualizando detalle...</Text>
            </View>
          ) : null}
          {card.imageUrl ? (
            <Image source={{ uri: card.imageUrl }} style={styles.cardImage} resizeMode="contain" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderTitle}>{card.nombre}</Text>
              <Text style={styles.imagePlaceholderSub}>{titleLine || "Sin imagen"}</Text>
            </View>
          )}
        </View>

        <View style={styles.detailInfo}>
          <Text style={styles.detailTitle}>{card.nombre}</Text>
          <Text style={styles.detailSub}>{titleLine || "Sin expansion"}</Text>
          <View style={styles.chips}>
            <Chip label={`Stock ${formatQty(card.quantity)}`} />
            <Chip label={card.condicion || "Sin condicion"} />
            <Chip label={card.idioma || "Sin idioma"} />
            <Chip label={card.ubicacion || "Sin ubicacion"} warn={!card.ubicacion} />
          </View>
        </View>

        <View style={styles.detailGrid}>
          <InfoTile label="Precio final" value={formatArs(card.precioFinalArs)} />
          <InfoTile label="PriceCharting" value={formatUsd(card.pcUsd)} />
          <InfoTile label="TCGplayer" value={card.tcgplayerMarketUsd ? formatUsd(card.tcgplayerMarketUsd) : "Sin dato"} />
          <InfoTile label="Ultima compra" value={card.ultimaCompraUsd ? formatUsd(card.ultimaCompraUsd) : "Sin dato"} />
          <InfoTile label="Margen PC" value={pcMargin ? formatUsd(pcMargin) : "Sin dato"} good={pcMargin > 0} warn={pcMargin < 0} />
          <InfoTile label="Sugerido ARS" value={formatArs(card.precioSugeridoArs)} />
          <InfoTile label="Manual ARS" value={card.precioManualArs ? formatArs(card.precioManualArs) : "Sin manual"} />
          <InfoTile label="SKU" value={card.sku || "Sin SKU"} small />
          <InfoTile label="TCG variante" value={card.tcgplayerSubtype || "Sin variante"} small />
        </View>

        <View style={styles.detailPriceEditor}>
          <Text style={styles.sectionTitle}>Precio para esta venta</Text>
          <View style={styles.priceRow}>
            <MoneyInput label="ARS unidad" value={priceArs} onChange={setPriceArs} />
            <MoneyInput label="USD unidad" value={priceUsd} onChange={setPriceUsd} />
          </View>
          <View style={styles.detailQuickActions}>
            <TapPressable style={styles.orderButton} onPress={() => onAddAndBack(card, pricePatch)} scaleTo={0.96}>
              <Text style={styles.orderButtonText}>Agregar y volver</Text>
            </TapPressable>
            <TapPressable style={styles.orderButtonPrimary} onPress={() => onAddAndCart(card, pricePatch)} scaleTo={0.96}>
              <Text style={styles.orderButtonPrimaryText}>Agregar y carrito</Text>
            </TapPressable>
          </View>
        </View>

        {hasExactPcUrl ? (
          <Pressable style={styles.linkButton} onPress={() => openPriceCharting(card.pcUrl)}>
            <Text style={styles.linkButtonText}>Abrir PriceCharting</Text>
          </Pressable>
        ) : (
          <View style={styles.linkUnavailable}>
            <Text style={styles.linkUnavailableText}>Link exacto de PriceCharting pendiente en Stock</Text>
          </View>
        )}

        {hasExactTcgUrl ? (
          <Pressable style={styles.linkButtonAlt} onPress={() => openTcgplayer(card.tcgplayerUrl)}>
            <Text style={styles.linkButtonText}>Abrir TCGplayer</Text>
          </Pressable>
        ) : (
          <View style={styles.linkUnavailable}>
            <Text style={styles.linkUnavailableText}>Link exacto de TCGplayer pendiente en Stock</Text>
          </View>
        )}
      </ScrollView>
      <View style={styles.detailBottomBar}>
        <View>
          <Text style={styles.detailBottomLabel}>Precio final</Text>
          <Text style={styles.detailBottomPrice}>{formatArs(priceArs)}{priceUsd ? ` + ${formatUsd(priceUsd)}` : ""}</Text>
        </View>
        <TapPressable style={styles.detailBottomButton} onPress={() => onAdd(card, pricePatch)} scaleTo={0.96}>
          <Text style={styles.detailBottomButtonText}>Agregar</Text>
        </TapPressable>
      </View>
    </View>
  );
}

function InfoTile({ label, value, small, good, warn }) {
  return (
    <View style={[styles.infoTile, good && styles.infoTileGood, warn && styles.infoTileWarn]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, small && styles.infoValueSmall]}>{value}</Text>
    </View>
  );
}

function OrderPaymentScreen({ order, loading, onBack, onSubmit }) {
  const [ars, setArs] = useState(0);
  const [usd, setUsd] = useState(0);
  const [notes, setNotes] = useState("");
  const [method, setMethod] = useState("Transferencia");
  const balanceArs = Number(order.balanceArs ?? order.totalArs) || 0;
  const balanceUsd = Number(order.balanceUsd ?? order.totalUsd) || 0;
  const valid = (Number(ars) || 0) > 0 || (Number(usd) || 0) > 0;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
      <View style={styles.detailTopActions}>
        <TapPressable style={styles.iconButton} onPress={onBack}><Ionicons name="arrow-back" size={21} color="#f8fafc" /></TapPressable>
        <Text style={styles.detailTopHint}>Registrar seña o pago</Text>
      </View>
      <View style={styles.paymentHero}>
        <Ionicons name="wallet-outline" size={30} color="#ef233c" />
        <Text style={styles.orderDetailBuyer}>{order.buyer}</Text>
        <Text style={styles.orderDetailMeta}>{order.orderId} - {order.reference}</Text>
        <Text style={styles.paymentBalance}>Falta {formatArs(balanceArs)}{balanceUsd ? ` + ${formatUsd(balanceUsd)}` : ""}</Text>
        {(order.paidArs || order.paidUsd) ? <Text style={styles.historyUpdated}>Ya abonado {formatArs(order.paidArs)}{order.paidUsd ? ` + ${formatUsd(order.paidUsd)}` : ""}</Text> : null}
      </View>
      <View style={styles.formPanel}>
        <Text style={styles.sectionTitle}>Importe recibido</Text>
        <View style={styles.priceRow}>
          <MoneyInput label="ARS" value={ars} onChange={setArs} />
          <MoneyInput label="USD" value={usd} onChange={setUsd} />
        </View>
        <View style={styles.inlineActions}>
          {balanceArs ? <TapPressable style={styles.filterChip} onPress={() => setArs(balanceArs)}><Text style={styles.filterChipText}>Saldo ARS</Text></TapPressable> : null}
          {balanceUsd ? <TapPressable style={styles.filterChip} onPress={() => setUsd(balanceUsd)}><Text style={styles.filterChipText}>Saldo USD</Text></TapPressable> : null}
        </View>
        <Text style={styles.moneyLabel}>Medio de pago</Text>
        <View style={styles.inlineActions}>
          {["Transferencia", "Efectivo", "Mixto", "Otro"].map((option) => (
            <TapPressable key={option} style={[styles.filterChip, method === option && styles.filterChipActive]} onPress={() => setMethod(option)}>
              <Text style={[styles.filterChipText, method === option && styles.filterChipTextActive]}>{option}</Text>
            </TapPressable>
          ))}
        </View>
        <TextInput value={notes} onChangeText={setNotes} placeholder="Nota opcional: transferencia, efectivo..." placeholderTextColor="#71717a" style={styles.input} />
        <TapPressable style={[styles.primaryButton, (!valid || loading) && styles.disabledButton]} onPress={() => onSubmit(order, { ars, usd, notes, method })} disabled={!valid || loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <><Ionicons name="checkmark-circle-outline" size={20} color="#fff" /><Text style={styles.primaryText}>Registrar pago</Text></>}
        </TapPressable>
      </View>
    </ScrollView>
  );
}

function StockManagementScreen({ items, query, setQuery, loading, onSearch, onOpen }) {
  return (
    <View style={styles.screen}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color="#71717a" />
        <TextInput value={query} onChangeText={setQuery} onSubmitEditing={() => onSearch(query)} placeholder="Carta, SKU, ubicacion o numero" placeholderTextColor="#71717a" style={styles.searchInputBare} />
        <TapPressable style={styles.iconPrimaryButton} onPress={() => onSearch(query)}>{loading ? <ActivityIndicator color="#fff" /> : <Ionicons name="arrow-forward" size={20} color="#fff" />}</TapPressable>
      </View>
      <ScrollView style={styles.results} contentContainerStyle={styles.stockListContent} keyboardShouldPersistTaps="handled">
        {items.map((item) => (
          <TapPressable key={item.sku} style={styles.stockManageRow} onPress={() => onOpen(item)} scaleTo={0.98}>
            <View style={styles.stockManageThumb}>{item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.stockManageImage} resizeMode="contain" /> : <Ionicons name="image-outline" size={24} color="#71717a" />}</View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.nombre}</Text>
              <Text style={styles.cardSub} numberOfLines={1}>{item.expansion}{item.numero ? ` #${item.numero}` : ""} - {item.ubicacion || "Sin ubicacion"}</Text>
              <View style={styles.chips}><Chip label={`Stock ${formatQty(item.quantity)}`} warn={item.quantity <= 0} /><Chip label={item.active ? "Activo" : "Inactivo"} warn={!item.active} /></View>
            </View>
            <View style={styles.stockManagePrice}><Text style={styles.orderTotal}>{formatArs(item.precioFinalArs)}</Text><Ionicons name="chevron-forward" size={18} color="#71717a" /></View>
          </TapPressable>
        ))}
        {!items.length ? <View style={styles.richEmpty}><Ionicons name="albums-outline" size={36} color="#3f3f46" /><Text style={styles.emptyTitle}>{loading ? "Cargando..." : "Sin resultados"}</Text></View> : null}
      </ScrollView>
    </View>
  );
}

function StockEditScreen({ item, loading, onBack, onSave }) {
  const [quantity, setQuantity] = useState(item.quantity || 0);
  const [priceFinalArs, setPriceFinalArs] = useState(item.precioFinalArs || 0);
  const [priceManualArs, setPriceManualArs] = useState(item.precioManualArs || 0);
  const [lastPurchaseUsd, setLastPurchaseUsd] = useState(item.ultimaCompraUsd || 0);
  const [location, setLocation] = useState(item.ubicacion || "");
  const [condition, setCondition] = useState(item.condicion || "NM");
  const [language, setLanguage] = useState(item.idioma || "EN");
  const [active, setActive] = useState(item.active !== false);
  const [reason, setReason] = useState("");
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
      <View style={styles.detailTopActions}><TapPressable style={styles.iconButton} onPress={onBack}><Ionicons name="arrow-back" size={21} color="#fff" /></TapPressable><Text style={styles.detailTopHint}>Editar inventario</Text></View>
      <View style={styles.stockEditHero}>
        {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.stockEditImage} resizeMode="contain" /> : <View style={styles.stockManageThumb}><Ionicons name="image-outline" size={30} color="#71717a" /></View>}
        <View style={styles.cardBody}><Text style={styles.detailTitle}>{item.nombre}</Text><Text style={styles.detailSub}>{item.expansion}{item.numero ? ` #${item.numero}` : ""}</Text><Text style={styles.historyUpdated}>{item.sku}</Text></View>
      </View>
      <View style={styles.formPanel}>
        <Text style={styles.sectionTitle}>Cantidad</Text>
        <View style={styles.quantityEditor}>
          <TapPressable style={styles.qtyButtonLarge} onPress={() => setQuantity(Math.max(0, Number(quantity) - 1))}><Ionicons name="remove" size={24} color="#fff" /></TapPressable>
          <TextInput value={String(quantity)} onChangeText={setQuantity} keyboardType="numeric" style={styles.quantityInput} />
          <TapPressable style={styles.qtyButtonLarge} onPress={() => setQuantity(Number(quantity) + 1)}><Ionicons name="add" size={24} color="#fff" /></TapPressable>
        </View>
        <View style={styles.priceRow}><MoneyInput label="Precio final ARS" value={priceFinalArs} onChange={setPriceFinalArs} /><MoneyInput label="Manual ARS" value={priceManualArs} onChange={setPriceManualArs} /></View>
        <MoneyInput label="Ultima compra USD" value={lastPurchaseUsd} onChange={setLastPurchaseUsd} />
        <TextInput value={location} onChangeText={setLocation} placeholder="Ubicacion" placeholderTextColor="#71717a" style={styles.input} />
        <View style={styles.priceRow}><TextInput value={condition} onChangeText={setCondition} placeholder="Condicion" placeholderTextColor="#71717a" style={[styles.input, styles.flexInput]} /><TextInput value={language} onChangeText={setLanguage} placeholder="Idioma" placeholderTextColor="#71717a" style={[styles.input, styles.flexInput]} /></View>
        <TapPressable style={[styles.toggleRow, active && styles.toggleRowActive]} onPress={() => setActive((value) => !value)}><Ionicons name={active ? "checkmark-circle" : "close-circle-outline"} size={22} color={active ? "#22c55e" : "#a1a1aa"} /><Text style={styles.cardTitle}>{active ? "Carta activa" : "Carta inactiva"}</Text></TapPressable>
        <TextInput value={reason} onChangeText={setReason} placeholder="Motivo del ajuste" placeholderTextColor="#71717a" style={styles.input} />
        <TapPressable style={[styles.primaryButton, loading && styles.disabledButton]} disabled={loading} onPress={() => onSave(item, { quantity, priceFinalArs, priceManualArs, lastPurchaseUsd, location, condition, language, active, reason })}>
          {loading ? <ActivityIndicator color="#fff" /> : <><Ionicons name="save-outline" size={20} color="#fff" /><Text style={styles.primaryText}>Guardar cambios</Text></>}
        </TapPressable>
      </View>
    </ScrollView>
  );
}

function OrdersScreen({ orders, visibleOrders, loading, updatingOrders, orderQuery, setOrderQuery, orderStatus, setOrderStatus, loadOrders, openPacking, openPayment, completeOrder, onMessage, generatePendingLabels, labelsLoading }) {
  return (
    <View style={styles.ordersWrap}>
      <View style={styles.searchBox}>
        <TextInput
          value={orderQuery}
          onChangeText={setOrderQuery}
          onSubmitEditing={() => loadOrders(orderQuery)}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Buscar comprador u orden"
          style={styles.searchInput}
        />
        <TapPressable style={styles.goButton} onPress={() => loadOrders(orderQuery)} scaleTo={0.93}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.goText}>Go</Text>}
        </TapPressable>
      </View>

      <View style={styles.orderBulkActions}>
        <TapPressable style={[styles.orderButtonPrimary, (loading || labelsLoading) && styles.disabledButton]} onPress={generatePendingLabels} disabled={loading || labelsLoading} scaleTo={0.96}>
          {labelsLoading ? <ActivityIndicator color="#fff" /> : <Ionicons name="pricetags-outline" size={18} color="#fff" />}
          <Text style={styles.orderButtonPrimaryText}>{labelsLoading ? "Generando..." : "Etiquetas pendientes"}</Text>
        </TapPressable>
      </View>

      <View style={styles.orderFiltersWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRowWide}>
          {ORDER_STATUS_OPTIONS.map((option) => (
            <TapPressable key={option.value} style={[styles.filterChip, orderStatus === option.value && styles.filterChipActive]} onPress={() => setOrderStatus(option.value)} scaleTo={0.96}>
              <Text style={[styles.filterChipText, orderStatus === option.value && styles.filterChipTextActive]}>{option.label}</Text>
            </TapPressable>
          ))}
          <Text style={styles.filterCountInline}>{formatQty(visibleOrders.length)} de {formatQty(orders.length)}</Text>
        </ScrollView>
      </View>

      <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
        {visibleOrders.map((order) => {
          const isUpdating = !!updatingOrders[order.orderId];
          return (
          <OrderCard key={order.orderId} order={order}>
            <View style={styles.orderActions}>
              <TapPressable style={[styles.orderButton, (isUpdating || loading) && styles.disabledButton]} onPress={() => onMessage(order)} disabled={isUpdating || loading} scaleTo={0.96}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color="#f8fafc" />
                <Text style={styles.orderButtonText}>Mensaje</Text>
              </TapPressable>
              <TapPressable style={styles.orderButton} onPress={() => openPacking(order)} scaleTo={0.96}>
                <Ionicons name="cube-outline" size={18} color="#f8fafc" />
                <Text style={styles.orderButtonText}>Embalaje</Text>
              </TapPressable>
              {isUpdating ? (
                <View style={styles.orderUpdating}>
                  <ActivityIndicator color="#ef233c" />
                  <Text style={styles.orderUpdatingText}>En cola...</Text>
                </View>
              ) : null}
              <TapPressable style={[styles.orderButton, (isUpdating || loading || order.paid) && styles.disabledButton]} onPress={() => openPayment(order)} disabled={isUpdating || loading || order.paid} scaleTo={0.96}>
                <Ionicons name="cash-outline" size={18} color="#f8fafc" />
                <Text style={styles.orderButtonText}>{order.paid ? "Pagado" : "Pago"}</Text>
              </TapPressable>
              {(!order.paid || !order.delivered) ? (
                <TapPressable
                  style={[styles.orderButtonPrimary, (isUpdating || loading) && styles.disabledButton]}
                  onPress={() => completeOrder(order)}
                  disabled={isUpdating || loading}
                  scaleTo={0.96}
                >
                  <Ionicons name="checkmark-done" size={18} color="#fff" />
                  <Text style={styles.orderButtonPrimaryText}>Completar</Text>
                </TapPressable>
              ) : null}
            </View>
          </OrderCard>
          );
        })}
        {!visibleOrders.length ? (
          <View style={styles.richEmpty}>
            <Text style={styles.emptyTitle}>{orders.length ? "Sin ordenes con este filtro" : "No hay ordenes pendientes"}</Text>
            <Text style={styles.empty}>Busca comprador, fecha u orden para revisar retiros.</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function BuyerMessagePanel({ data, onClose, onCopy, onShare }) {
  return (
    <View style={styles.messagePanelOverlay}>
      <View style={styles.messagePanel}>
        <View style={styles.messagePanelHeader}>
          <View style={styles.cardBody}>
            <Text style={styles.messagePanelTitle}>Mensaje para {data.buyer || data.orderId}</Text>
            <Text style={styles.messagePanelSub}>Copialo para enviar al comprador.</Text>
          </View>
          <TapPressable style={styles.iconButton} onPress={onClose} scaleTo={0.94}>
            <Ionicons name="close" size={22} color="#f8fafc" />
          </TapPressable>
        </View>
        <TextInput
          value={data.message}
          multiline
          onChangeText={() => {}}
          selectTextOnFocus
          style={styles.messageTextArea}
        />
        <View style={styles.orderActions}>
          <TapPressable style={styles.orderButton} onPress={onShare} scaleTo={0.96}>
            <Ionicons name="share-social-outline" size={18} color="#f8fafc" />
            <Text style={styles.orderButtonText}>Compartir</Text>
          </TapPressable>
          <TapPressable style={styles.orderButtonPrimary} onPress={onCopy} scaleTo={0.96}>
            <Ionicons name="copy-outline" size={18} color="#fff" />
            <Text style={styles.orderButtonPrimaryText}>Copiar</Text>
          </TapPressable>
        </View>
      </View>
    </View>
  );
}

function OrderCard({ order, children, compact }) {
  return (
    <View style={styles.orderCard}>
      <View style={styles.orderTop}>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{order.buyer || "Sin comprador"}</Text>
          <Text style={styles.cardSub}>{order.reference || order.orderId} {order.date ? `- ${order.date}` : ""}</Text>
        </View>
        <Text style={styles.orderTotal}>{formatArs(order.totalArs)}{order.totalUsd ? ` + ${formatUsd(order.totalUsd)}` : ""}</Text>
      </View>
      <Text style={styles.orderItems} numberOfLines={compact ? 2 : 4}>{order.itemsText}</Text>
      <View style={styles.chips}>
        <Chip label={`${formatQty(order.cards)} cartas`} />
        <Chip label={order.paid ? "Pagado" : order.hasDeposit ? "Con seña" : "Debe"} warn={!order.paid} />
        <Chip label={order.delivered ? "Entregado" : "Pendiente"} warn={!order.delivered} />
      </View>
      {order.hasDeposit ? (
        <View style={styles.depositSummary}>
          <Text style={styles.depositLabel}>Seña registrada</Text>
          <Text style={styles.depositValue}>Falta {formatArs(order.balanceArs)}{order.balanceUsd ? ` + ${formatUsd(order.balanceUsd)}` : ""}</Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}

function OrderDetailScreen({ order, updatingOrders, loading, onBack, markOrder, onToggleLine, onPayment, onComplete, onMessage }) {
  const items = order.items || [];
  const frees = order.frees || [];
  const allLines = [
    ...items.map((item, index) => ({ ...item, type: "venta", lineKey: item.lineId || orderLineKey(item, index, "venta") })),
    ...frees.map((item, index) => ({ ...item, type: "free", lineKey: item.lineId || orderLineKey(item, index, "free") }))
  ];
  const [checkedLines, setCheckedLines] = useState(() => Object.fromEntries(allLines.map((line) => [line.lineKey, !!line.packedChecked])));
  const packedCount = allLines.filter((line) => checkedLines[line.lineKey]).length;
  const isUpdating = !!updatingOrders[order.orderId];

  useEffect(() => {
    setCheckedLines(Object.fromEntries(allLines.map((line) => [line.lineKey, !!line.packedChecked])));
  }, [order.orderId]);

  function toggleLine(line) {
    const next = !checkedLines[line.lineKey];
    setCheckedLines((current) => ({ ...current, [line.lineKey]: next }));
    onToggleLine(order, line, next);
  }

  return (
    <View style={styles.orderDetailShell}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.orderDetailContent} keyboardShouldPersistTaps="handled">
        <View style={styles.detailTopActions}>
          <TapPressable style={styles.smallButton} onPress={onBack} scaleTo={0.95}>
            <Text style={styles.smallButtonText}>Volver</Text>
          </TapPressable>
          <Text style={styles.detailTopHint}>{packedCount}/{allLines.length} revisadas</Text>
        </View>

        <View style={styles.orderDetailHero}>
          <Text style={styles.orderDetailBuyer}>{order.buyer || "Sin comprador"}</Text>
          <Text style={styles.orderDetailMeta}>{order.reference || order.orderId} {order.date ? `- ${order.date}` : ""}</Text>
          <Text style={styles.orderDetailTotals}>
            {formatArs(order.totalArs)}{order.totalUsd ? ` + ${formatUsd(order.totalUsd)}` : ""}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: allLines.length ? `${Math.round((packedCount / allLines.length) * 100)}%` : "0%" }]} />
          </View>
          <View style={styles.chips}>
            <Chip label={`${formatQty(order.cards)} cartas`} />
            <Chip label={order.paid ? "Pagado" : order.hasDeposit ? "Con seña" : "Debe"} warn={!order.paid} />
            <Chip label={order.packed ? "Embalado" : "Sin embalar"} warn={!order.packed} />
            <Chip label={order.delivered ? "Entregado" : "Pendiente"} warn={!order.delivered} />
          </View>
        </View>

        <Text style={styles.orderDetailSectionTitle}>Cartas vendidas</Text>
        {items.map((item, index) => (
          <OrderLineCard
            key={item.lineId || orderLineKey(item, index, "venta")}
            line={{ ...item, type: "venta", lineKey: item.lineId || orderLineKey(item, index, "venta") }}
            checked={!!checkedLines[item.lineId || orderLineKey(item, index, "venta")]}
            onToggle={toggleLine}
          />
        ))}
        {!items.length ? <Text style={styles.empty}>No hay cartas vendidas en esta orden.</Text> : null}

        {frees.length ? <Text style={styles.orderDetailSectionTitle}>Frees</Text> : null}
        {frees.map((item, index) => (
          <OrderLineCard
            key={item.lineId || orderLineKey(item, index, "free")}
            line={{ ...item, type: "free", lineKey: item.lineId || orderLineKey(item, index, "free") }}
            free
            checked={!!checkedLines[item.lineId || orderLineKey(item, index, "free")]}
            onToggle={toggleLine}
          />
        ))}
      </ScrollView>

      <View style={styles.orderDetailBottomBar}>
        {isUpdating ? (
          <View style={styles.orderUpdating}>
            <ActivityIndicator color="#ef233c" />
            <Text style={styles.orderUpdatingText}>En cola...</Text>
          </View>
        ) : null}
        {!order.packed && (!allLines.length || packedCount === allLines.length) ? (
          <TapPressable
            style={[styles.orderButton, (isUpdating || loading) && styles.disabledButton]}
            onPress={() => markOrder(order, { packed: true })}
            disabled={isUpdating || loading}
            scaleTo={0.96}
          >
            <Text style={styles.orderButtonText}>Finalizar embalaje</Text>
          </TapPressable>
        ) : null}
        <TapPressable style={[styles.orderButton, (isUpdating || loading) && styles.disabledButton]} onPress={() => onMessage(order)} disabled={isUpdating || loading} scaleTo={0.96}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color="#f8fafc" />
          <Text style={styles.orderButtonText}>Mensaje</Text>
        </TapPressable>
        <TapPressable style={[styles.orderButton, (isUpdating || loading || order.paid) && styles.disabledButton]} onPress={() => onPayment(order)} disabled={isUpdating || loading || order.paid} scaleTo={0.96}>
          <Ionicons name="cash-outline" size={18} color="#f8fafc" /><Text style={styles.orderButtonText}>{order.paid ? "Pagado" : "Pago"}</Text>
        </TapPressable>
        {(!order.paid || !order.delivered) ? (
          <TapPressable
            style={[styles.orderButtonPrimary, (isUpdating || loading) && styles.disabledButton]}
            onPress={() => onComplete(order)}
            disabled={isUpdating || loading}
            scaleTo={0.96}
          >
            <Text style={styles.orderButtonPrimaryText}>Completar</Text>
          </TapPressable>
        ) : null}
      </View>
    </View>
  );
}

function OrderLineCard({ line, checked, onToggle, free }) {
  const subtitle = [line.expansion, line.number ? `#${line.number}` : "", line.sku].filter(Boolean).join(" - ");
  return (
    <Pressable style={[styles.orderLineCard, checked && styles.orderLineChecked]} onPress={() => onToggle(line)}>
      <View style={styles.orderLineThumb}>
        {line.imageUrl ? (
          <Image source={{ uri: line.imageUrl }} style={styles.orderLineImage} resizeMode="contain" />
        ) : (
          <View style={styles.orderLineFallback}>
            <Text style={styles.resultThumbText}>{getInitials(line.name)}</Text>
          </View>
        )}
      </View>
      <View style={styles.orderLineBody}>
        <Text style={styles.orderLineName} numberOfLines={2}>{line.name || line.baseName || "Carta sin nombre"}</Text>
        <Text style={styles.orderLineSub} numberOfLines={2}>{subtitle || "Sin detalle"}</Text>
        <View style={styles.orderLineBottom}>
          <Text style={styles.orderLineQty}>Qty: {formatQty(line.quantity || 1)}</Text>
          <Text style={styles.orderLinePrice}>
            {free ? "Free" : `${formatArs(line.ars)}${line.usd ? ` + ${formatUsd(line.usd)}` : ""}`}
          </Text>
        </View>
      </View>
      <View style={[styles.orderCheck, checked && styles.orderCheckDone]}>
        {checked ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
      </View>
    </Pressable>
  );
}

function CartGlyph({ active }) {
  return <Ionicons name={active ? "cart" : "cart-outline"} size={22} color={active ? "#ef233c" : "#f8fafc"} />;
}

function TapPressable({ children, style, disabled, onPress, scaleTo, onPressIn, onPressOut, ...rest }) {
  const scale = useRef(new Animated.Value(1)).current;

  function animate(toValue) {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 42,
      bounciness: 4
    }).start();
  }

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPress={onPress}
      onPressIn={(event) => {
        if (!disabled) animate(scaleTo || 0.96);
        if (onPressIn) onPressIn(event);
      }}
      onPressOut={(event) => {
        if (!disabled) animate(1);
        if (onPressOut) onPressOut(event);
      }}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}

function AddToCartButton({ onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  function pressDown() {
    Animated.spring(scale, {
      toValue: 0.86,
      useNativeDriver: true,
      speed: 55,
      bounciness: 3
    }).start();
  }

  function release() {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.12, useNativeDriver: true, speed: 55, bounciness: 8 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 42, bounciness: 5 })
    ]).start();
  }

  return (
    <AnimatedPressable
      style={[styles.saleAddMini, { transform: [{ scale }] }]}
      onPressIn={pressDown}
      onPressOut={release}
      onPress={onPress}
    >
      <Text style={styles.addText}>+</Text>
    </AnimatedPressable>
  );
}

function SyncStatusBanner({ apiOnline, pendingOrders, pendingSales, pendingActions, cartCount }) {
  const pending = (Number(pendingOrders) || 0) + (Number(pendingSales) || 0) + (Number(pendingActions) || 0);
  if (apiOnline && !pending) return null;
  const parts = [];
  if (pendingSales) parts.push(`${formatQty(pendingSales)} venta${pendingSales === 1 ? "" : "s"} pendiente${pendingSales === 1 ? "" : "s"}`);
  if (pendingActions) parts.push(`${formatQty(pendingActions)} accion${pendingActions === 1 ? "" : "es"} pendiente${pendingActions === 1 ? "" : "s"}`);
  if (pendingOrders) parts.push(`${formatQty(pendingOrders)} orden${pendingOrders === 1 ? "" : "es"} en cola`);
  const message = parts.length
    ? parts.join(" - ")
    : cartCount
      ? "Sin conexion/API. El carrito queda guardado en este celular."
      : "Sin conexion/API. Algunas acciones pueden fallar.";
  return (
    <View style={[styles.syncBanner, !apiOnline && styles.syncBannerOffline]}>
      <Text style={styles.syncBannerText}>{message}</Text>
    </View>
  );
}

function NavButton({ label, active, onPress }) {
  return (
    <TapPressable style={[styles.navButton, active && styles.navActive]} onPress={onPress} scaleTo={0.97}>
      <Text style={[styles.navText, active && styles.navActiveText]}>{label}</Text>
    </TapPressable>
  );
}

function Metric({ title, value, sub }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {sub ? <Text style={styles.metricSub}>{sub}</Text> : null}
    </View>
  );
}

function UserAvatar({ user, size }) {
  const profile = findUserProfile(user && user.id) || user || USERS[0];
  return (
    <View
      style={[
        styles.userAvatar,
        {
          width: size,
          height: size,
          borderRadius: Math.max(8, size / 4),
          backgroundColor: profile.bg,
          borderColor: profile.color
        }
      ]}
    >
      {profile.image ? (
        <Image source={profile.image} style={styles.userAvatarImage} resizeMode="cover" />
      ) : (
        <Text style={[styles.userAvatarText, { color: profile.color, fontSize: Math.max(17, size * 0.32) }]}>
          {profile.initials || getInitials(profile.name)}
        </Text>
      )}
    </View>
  );
}

function Chip({ label, warn }) {
  return (
    <View style={[styles.chip, warn && styles.chipWarn]}>
      <Text style={[styles.chipText, warn && styles.chipWarnText]}>{label}</Text>
    </View>
  );
}

function MoneyInput({ label, value, onChange }) {
  return (
    <View style={styles.moneyField}>
      <Text style={styles.moneyLabel}>{label}</Text>
      <TextInput
        value={String(value || "")}
        onChangeText={(text) => onChange(Number(text.replace(",", ".")) || 0)}
        keyboardType="numeric"
        style={styles.moneyInput}
      />
    </View>
  );
}

function buildSaleFilterOptions(items) {
  return {
    conditions: uniqueValues(items.map((item) => item.condicion)).slice(0, 8),
    languages: uniqueValues(items.map((item) => item.idioma)).slice(0, 8)
  };
}

function searchLocalStockCatalog(items, query, limit) {
  const q = normalizeOfflineSearch(query);
  const tokens = q.split(" ").filter(Boolean);
  return (items || [])
    .filter((item) => (Number(item.quantity) || 0) > 0 && item.active !== false)
    .map((item) => {
      const haystack = normalizeOfflineSearch([
        item.sku, item.nombre, item.expansion, item.numero, item.condicion, item.idioma, item.ubicacion
      ].join(" "));
      if (tokens.length && !tokens.every((token) => haystack.includes(token))) return null;
      const name = normalizeOfflineSearch(item.nombre);
      const expansion = normalizeOfflineSearch(item.expansion);
      let score = 0;
      if (q && name === q) score += 1000;
      else if (q && name.startsWith(q)) score += 700;
      else if (q && name.includes(q)) score += 450;
      if (q && expansion.includes(q)) score += 180;
      score += Math.min(80, Number(item.quantity) || 0);
      return { ...item, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || String(a.nombre || "").localeCompare(String(b.nombre || "")))
    .slice(0, limit || 30);
}

function normalizeOfflineSearch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function filterAndSortSaleResults(items, filters) {
  const next = (items || []).filter((item) => {
    if (filters.stockOnly && (Number(item.quantity) || 0) <= 0) return false;
    if (filters.condition !== "Todas" && String(item.condicion || "") !== filters.condition) return false;
    if (filters.language !== "Todos" && String(item.idioma || "") !== filters.language) return false;
    return true;
  });
  return next.sort((a, b) => {
    if (filters.sort === "priceDesc") return (Number(b.precioFinalArs) || 0) - (Number(a.precioFinalArs) || 0);
    if (filters.sort === "priceAsc") return (Number(a.precioFinalArs) || 0) - (Number(b.precioFinalArs) || 0);
    if (filters.sort === "name") return String(a.nombre || "").localeCompare(String(b.nombre || ""));
    if (filters.sort === "qty") return (Number(b.quantity) || 0) - (Number(a.quantity) || 0);
    return (Number(b.score) || 0) - (Number(a.score) || 0);
  });
}

function adjustStockForPendingSales(items, pendingSales) {
  const pendingBySku = {};
  (pendingSales || []).forEach((sale) => {
    ((sale.payload && sale.payload.items) || []).forEach((item) => {
      const sku = String(item.sku || "");
      if (!sku) return;
      pendingBySku[sku] = (pendingBySku[sku] || 0) + (Number(item.quantity) || 0);
    });
  });
  if (!Object.keys(pendingBySku).length) return items || [];
  return (items || []).map((item) => {
    const pendingQuantity = pendingBySku[item.sku] || 0;
    if (!pendingQuantity) return item;
    return {
      ...item,
      pendingQuantity,
      quantity: Math.max(0, (Number(item.quantity) || 0) - pendingQuantity)
    };
  });
}

function filterOrdersByStatus(orders, status) {
  return (orders || []).filter((order) => {
    if (status === "unpaid") return !order.paid;
    if (status === "deposit") return !!order.hasDeposit && !order.paid;
    if (status === "paid") return !!order.paid;
    if (status === "undelivered") return !order.delivered;
    return true;
  });
}

function activeSaleFilters(filters) {
  const out = [];
  if (filters.stockOnly) out.push("Stock");
  const sort = SORT_OPTIONS.find((item) => item.value === filters.sort);
  if (sort && filters.sort !== DEFAULT_SALE_FILTERS.sort) out.push(sort.label);
  if (filters.condition && filters.condition !== DEFAULT_SALE_FILTERS.condition) out.push(filters.condition);
  if (filters.language && filters.language !== DEFAULT_SALE_FILTERS.language) out.push(filters.language);
  return out;
}

function buildLocalSalePayload({ buyer, origin, seller, cart }) {
  return {
    localSaleId: makeLocalSaleId(),
    buyer,
    origin,
    seller,
    items: (cart || []).map((item) => ({
      sku: item.sku,
      quantity: item.quantity,
      priceArs: Number(item.priceArs) || 0,
      priceUsd: Number(item.priceUsd) || 0
    }))
  };
}

function parseMonPriceCsv(text) {
  const rows = parseDelimitedText(text);
  const cleanRows = rows.filter((row) => row.some((cell) => String(cell || "").trim()));
  if (cleanRows.length < 2) throw new Error("No encontre filas.");

  const headerIndex = cleanRows.findIndex((row) => {
    const headers = row.map(normalizeCsvHeader);
    return headers.includes("name") && headers.includes("number") && headers.includes("set") && headers.includes("count");
  });
  if (headerIndex < 0) throw new Error("Necesito headers ID, Name, Number, Set y Count.");

  const headers = cleanRows[headerIndex].map(normalizeCsvHeader);
  const idx = {};
  headers.forEach((header, index) => {
    idx[header] = index;
  });

  return cleanRows.slice(headerIndex + 1)
    .map((row, index) => {
      const name = getCsvValue(row, idx, "name");
      const expansion = getCsvValue(row, idx, "set");
      const number = getCsvValue(row, idx, "number");
      if (!name && !expansion && !number) return null;
      const quantity = parseLooseNumber(getCsvValue(row, idx, "count")) || 1;
      const language = normalizeScannerLanguage(getCsvValue(row, idx, "language"), name);
      const jpDetected = language === "JP" || containsJapaneseText(name);
      return {
        localKey: `${index}-${getCsvValue(row, idx, "id") || "sin-id"}-${name}-${expansion}-${number}`,
        scanner: "MonPrice",
        scannerId: getCsvValue(row, idx, "id"),
        name,
        expansion,
        number,
        series: getCsvValue(row, idx, "series"),
        rarity: getCsvValue(row, idx, "rarity"),
        finish: getCsvValue(row, idx, "finish-type"),
        reverse: getCsvValue(row, idx, "reverse-holo"),
        language,
        jpDetected,
        condition: "NM",
        quantity,
        averagePrice: parseLooseNumber(getCsvValue(row, idx, "average-price")),
        lastPurchaseUsd: 0,
        pcUrl: "",
        pcId: "",
        importError: "",
        skip: false
      };
    })
    .filter(Boolean);
}

async function readPickedTextFile(asset) {
  if (asset && asset.file && typeof asset.file.text === "function") {
    return asset.file.text();
  }
  if (asset && asset.base64) return base64ToUtf8(asset.base64);
  if (!asset || !asset.uri) throw new Error("El archivo no tiene URI.");
  const response = await fetch(asset.uri);
  if (!response.ok && response.status) throw new Error("No pude abrir el archivo seleccionado.");
  return response.text();
}

function parseDelimitedText(text) {
  const source = String(text || "").replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(source);
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === "\"") {
      if (quoted && next === "\"") {
        cell += "\"";
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function detectDelimiter(text) {
  const firstLine = String(text || "").split(/\r?\n/)[0] || "";
  const semicolons = (firstLine.match(/;/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  if (semicolons >= tabs && semicolons >= commas) return ";";
  if (tabs >= commas) return "\t";
  return ",";
}

function normalizeCsvHeader(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/_/g, "-");
}

function normalizeScannerLanguage(value, name) {
  const raw = String(value || "").trim();
  const normalized = raw.toLowerCase();
  if (["jp", "jpn", "ja", "japanese"].includes(normalized) || /japon|japan|日本/.test(normalized)) return "JP";
  if (["en", "eng", "english"].includes(normalized) || /ingles|english/.test(normalized)) return "EN";
  if (["es", "spa", "spanish"].includes(normalized) || /espanol|español|spanish/.test(normalized)) return "ES";
  if (["kr", "kor", "korean"].includes(normalized) || /coreano|korean/.test(normalized)) return "KR";
  if (["cn", "chs", "cht", "chinese"].includes(normalized) || /chino|chinese/.test(normalized)) return "CN";
  if (containsJapaneseText(name)) return "JP";
  return raw || "EN";
}

function containsJapaneseText(value) {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(String(value || ""));
}

function getCsvValue(row, idx, key) {
  const index = idx[key];
  return index === undefined ? "" : String(row[index] || "").trim();
}

function parseLooseNumber(value) {
  const text = String(value || "").trim().replace(/\./g, "").replace(",", ".");
  return Number(text) || 0;
}

function base64ToUtf8(base64) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = String(base64 || "").replace(/^data:[^,]+,/, "").replace(/\s/g, "");
  const bytes = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === "=") break;
    const value = chars.indexOf(ch);
    if (value < 0) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return arrayBufferToUtf8(new Uint8Array(bytes).buffer);
}

function arrayBufferToUtf8(buffer) {
  const bytes = new Uint8Array(buffer);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const b0 = bytes[i];
    if (b0 < 0x80) {
      out += String.fromCharCode(b0);
    } else if (b0 >= 0xc0 && b0 < 0xe0) {
      const b1 = bytes[++i] || 0;
      out += String.fromCharCode(((b0 & 0x1f) << 6) | (b1 & 0x3f));
    } else if (b0 >= 0xe0 && b0 < 0xf0) {
      const b1 = bytes[++i] || 0;
      const b2 = bytes[++i] || 0;
      out += String.fromCharCode(((b0 & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f));
    }
  }
  return out;
}

function makeLocalSaleId() {
  return `APP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
}

function summarizeSalePayload(payload) {
  return (payload.items || []).reduce(
    (acc, item) => {
      acc.cards += Number(item.quantity) || 0;
      acc.ars += (Number(item.priceArs) || 0) * (Number(item.quantity) || 0);
      acc.usd += (Number(item.priceUsd) || 0) * (Number(item.quantity) || 0);
      return acc;
    },
    {
      buyer: payload.buyer || "Mesa",
      origin: payload.origin || "Mesa",
      seller: payload.seller || "",
      cards: 0,
      ars: 0,
      usd: 0
    }
  );
}

function summarizePendingSales(sales) {
  return (sales || []).reduce(
    (acc, sale) => {
      const summary = sale.summary || summarizeSalePayload(sale.payload || {});
      acc.cards += Number(summary.cards) || 0;
      acc.ars += Number(summary.ars) || 0;
      acc.usd += Number(summary.usd) || 0;
      return acc;
    },
    { cards: 0, ars: 0, usd: 0 }
  );
}

function isRetryableSaleError(err) {
  const text = errorText(err).toLowerCase();
  if (
    text.includes("stock insuficiente") ||
    text.includes("token invalido") ||
    text.includes("falta token") ||
    text.includes("falta url") ||
    text.includes("no encontre sku")
  ) {
    return false;
  }
  return (
    text.includes("network request failed") ||
    text.includes("failed to fetch") ||
    text.includes("timeout") ||
    text.includes("aborted") ||
    text.includes("no devolvio json") ||
    text.includes("ocupada") ||
    text.includes("procesandose") ||
    text.includes("429") ||
    text.includes("503")
  );
}

function getUserPermissions(user) {
  const base = {
    canDashboard: true,
    canSale: true,
    canOrders: false,
    canHistory: false,
    canPurchases: false,
    canImportStock: false,
    canClaims: false,
    canManageStock: false,
    canCancelSales: false,
    canConfig: false,
    canResetPasswords: false
  };
  if (!user) return base;
  if (user.role === "admin") {
    return {
      ...base,
      canOrders: true,
      canHistory: true,
      canPurchases: true,
      canImportStock: true,
      canClaims: true,
      canManageStock: true,
      canCancelSales: true,
      canConfig: true,
      canResetPasswords: !PASSWORDS_PAUSED
    };
  }
  if (user.role === "staff") {
    return {
      ...base,
      canOrders: true,
      canHistory: true,
      canPurchases: true,
      canImportStock: true,
      canClaims: true,
      canManageStock: true,
      canCancelSales: true
    };
  }
  return base;
}

function roleLabel(role) {
  if (role === "admin") return "Admin";
  if (role === "staff") return "Mesa y ordenes";
  return "Solo ventas";
}

function findUserProfile(id) {
  return USERS.find((user) => user.id === id) || null;
}

async function authenticateBiometric(promptMessage) {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: promptMessage || "Verificar identidad",
      cancelLabel: "Cancelar",
      fallbackLabel: "Usar contrasena",
      disableDeviceFallback: false
    });
    return !!result.success;
  } catch (err) {
    return false;
  }
}

function getBiometricLabel(types) {
  const values = types || [];
  if (values.indexOf(LocalAuthentication.AuthenticationType.FINGERPRINT) >= 0) return "huella";
  if (values.indexOf(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) >= 0) return "rostro";
  if (values.indexOf(LocalAuthentication.AuthenticationType.IRIS) >= 0) return "iris";
  return "biometria";
}

function uniqueValues(values) {
  const seen = {};
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
}

async function copyTextToClipboard(text) {
  const value = String(text || "");
  if (!value) return false;
  if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (err) {
      // Some browsers block async clipboard when the page is opened by LAN IP.
    }
  }
  if (Platform.OS === "web" && typeof document !== "undefined") {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      return !!copied;
    } catch (err) {
      return false;
    }
  }
  try {
    await Clipboard.setStringAsync(value);
    return true;
  } catch (err) {
    return false;
  }
}

function formatArs(value) {
  const n = Number(value) || 0;
  return `$${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

function formatUsd(value) {
  const n = Number(value) || 0;
  return `USD ${n.toLocaleString("es-AR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

function formatQty(value) {
  return (Number(value) || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function orderLineKey(line, index, type) {
  return [
    type || "item",
    line && (line.sku || line.pcId || line.pcUrl || line.name || line.baseName) || "line",
    index
  ].join("-");
}

function getInitials(value) {
  return String(value || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function findOrderInDashboardOrList_(orders, orderId) {
  return (orders || []).find((item) => item.orderId === orderId);
}

function openPriceCharting(url) {
  const cleanUrl = String(url || "").split("#")[0].trim();
  if (!isExactPriceChartingUrl(cleanUrl)) {
    Alert.alert("Link no exacto", "Esta carta no tiene un link de producto PriceCharting correcto en Stock.");
    return;
  }
  Linking.openURL(cleanUrl).catch((err) => {
    Alert.alert("No pude abrir PriceCharting", errorText(err));
  });
}

function openTcgplayer(url) {
  const cleanUrl = String(url || "").split("#")[0].trim();
  if (!isExactTcgplayerUrl(cleanUrl)) {
    Alert.alert("Link no exacto", "Esta carta no tiene un link de producto TCGplayer correcto en Stock.");
    return;
  }
  Linking.openURL(cleanUrl).catch((err) => {
    Alert.alert("No pude abrir TCGplayer", errorText(err));
  });
}

function isExactPriceChartingUrl(url) {
  const withoutQuery = String(url || "").split("#")[0].split("?")[0].replace(/\/+$/g, "");
  return /^https?:\/\/www\.pricecharting\.com\/game\/[^/]+\/[^/]+$/i.test(withoutQuery);
}

function isExactTcgplayerUrl(url) {
  const withoutQuery = String(url || "").split("#")[0].split("?")[0].replace(/\/+$/g, "");
  return /^https?:\/\/www\.tcgplayer\.com\/product\/\d+\/[^/]+\/[^/]+$/i.test(withoutQuery);
}

function errorText(err) {
  return err && err.message ? err.message : String(err || "Error");
}

function makeLocalActionId(prefix = "accion") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function withActionMeta(payload, prefix, user) {
  return {
    ...(payload || {}),
    localActionId: payload && payload.localActionId ? payload.localActionId : makeLocalActionId(prefix),
    actor: user ? user.name : "App",
    actorId: user ? user.id : "",
    actorRole: user ? user.role : ""
  };
}

function getHistoryDateRange(range) {
  if (range === "all") return {};
  const end = new Date();
  const start = new Date(end);
  if (range === "week") start.setDate(start.getDate() - 6);
  else if (range === "month") start.setDate(start.getDate() - 29);
  return { dateFrom: formatDateKey(start), dateTo: formatDateKey(end) };
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function groupPurchases(purchases) {
  const groups = {};
  (purchases || []).forEach((purchase) => {
    const key = purchase.purchaseId || `FILA-${purchase.row}`;
    if (!groups[key]) groups[key] = { purchaseId: key, provider: purchase.provider, date: purchase.date, items: [] };
    groups[key].items.push(purchase);
  });
  return Object.values(groups);
}

function impactLight() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => null);
}

function impactSuccess() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => null);
}

function selectionFeedback() {
  Haptics.selectionAsync().catch(() => null);
}

function notificationSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => null);
}

async function shareSaleSummary({ cart, totals, buyer, origin }) {
  if (!cart || !cart.length) return;
  const lines = cart.map((item) => {
    const money = [item.priceArs ? formatArs(item.priceArs * item.quantity) : "", item.priceUsd ? formatUsd(item.priceUsd * item.quantity) : ""].filter(Boolean).join(" + ");
    return `${item.quantity}x ${item.nombre} - ${item.expansion}${money ? ` - ${money}` : ""}`;
  });
  const total = `${formatArs(totals.ars)}${totals.usd ? ` + ${formatUsd(totals.usd)}` : ""}`;
  await Share.share({ message: [`UltimoTurno`, buyer ? `Comprador: ${buyer}` : "", `Origen: ${origin}`, "", ...lines, "", `Total: ${total}`].filter(Boolean).join("\n") });
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0b0b0c"
  },
  statusSpacer: {
    height: Platform.OS === "android" ? NativeStatusBar.currentHeight || 0 : 0
  },
  bootScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0b0b0c"
  },
  loginContent: {
    flexGrow: 1,
    padding: 18,
    justifyContent: "center",
    gap: 18
  },
  loginBrand: {
    alignItems: "center",
    gap: 8,
    marginBottom: 8
  },
  loginLogo: {
    width: 148,
    height: 116
  },
  loginTitle: {
    color: "#f8fafc",
    fontSize: 32,
    fontWeight: "900"
  },
  loginSub: {
    color: "#a1a1aa",
    fontSize: 14,
    fontWeight: "800"
  },
  loginUsers: {
    gap: 10
  },
  loginForm: {
    gap: 10
  },
  loginError: {
    color: "#fecaca",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  },
  biometricButton: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#26c6b8",
    backgroundColor: "#071717",
    alignItems: "center",
    justifyContent: "center"
  },
  biometricButtonText: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "900"
  },
  loginUserCard: {
    minHeight: 112,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#111113",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  loginUserText: {
    flex: 1
  },
  loginUserName: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "900"
  },
  loginUserSub: {
    marginTop: 4,
    color: "#a1a1aa",
    fontSize: 13,
    fontWeight: "800"
  },
  userAvatar: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  userAvatarText: {
    fontWeight: "900"
  },
  userAvatarImage: {
    width: "100%",
    height: "100%"
  },
  header: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#27272a",
    backgroundColor: "#0b0b0c"
  },
  brandHeader: {
    flex: 1,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingRight: 10
  },
  headerLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#050506"
  },
  headerText: {
    flex: 1,
    minWidth: 0
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  title: {
    fontSize: 21,
    fontWeight: "800",
    color: "#f8fafc"
  },
  betaBadge: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#ef233c",
    backgroundColor: "#241013",
    paddingHorizontal: 5,
    paddingVertical: 2
  },
  betaBadgeText: {
    color: "#ff6377",
    fontSize: 9,
    fontWeight: "900"
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: "#a1a1aa"
  },
  cartHeaderButton: {
    width: 82,
    height: 46,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#3f3f46",
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#141416"
  },
  headerAvatarButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  cartHeaderActive: {
    borderColor: "#ef233c",
    backgroundColor: "#241013"
  },
  cartBadge: {
    position: "absolute",
    right: -2,
    top: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ef233c"
  },
  cartBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900"
  },
  cartHeaderText: {
    color: "#f8fafc",
    fontSize: 11,
    fontWeight: "900"
  },
  cartHeaderTextActive: {
    color: "#ef233c"
  },
  cartGlyph: {
    width: 22,
    height: 20
  },
  cartGlyphBasket: {
    position: "absolute",
    left: 4,
    top: 7,
    width: 16,
    height: 9,
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: "#f8fafc",
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3
  },
  cartGlyphHandle: {
    position: "absolute",
    left: 2,
    top: 3,
    width: 8,
    height: 7,
    borderLeftWidth: 2,
    borderTopWidth: 2,
    borderColor: "#f8fafc",
    transform: [{ rotate: "-18deg" }]
  },
  cartGlyphActive: {
    borderColor: "#ef233c"
  },
  cartGlyphWheels: {
    position: "absolute",
    left: 7,
    right: 3,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  cartGlyphWheel: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#f8fafc"
  },
  cartGlyphWheelActive: {
    backgroundColor: "#ef233c"
  },
  nav: {
    height: 54,
    maxHeight: 54,
    backgroundColor: "#101012",
    borderBottomWidth: 1,
    borderBottomColor: "#27272a"
  },
  navContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  navButton: {
    minWidth: 104,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3f3f46",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#18181b"
  },
  navActive: {
    backgroundColor: "#ef233c",
    borderColor: "#ef233c"
  },
  navText: {
    color: "#d4d4d8",
    fontSize: 12,
    fontWeight: "800"
  },
  navActiveText: {
    color: "#fff"
  },
  settingsButton: {
    minWidth: 48,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3f3f46",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#18181b"
  },
  settingsText: {
    color: "#ef233c",
    fontWeight: "800"
  },
  syncBanner: {
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#3a2608",
    backgroundColor: "#22180d",
    alignItems: "center",
    justifyContent: "center"
  },
  syncBannerOffline: {
    borderBottomColor: "#7f1d1d",
    backgroundColor: "#251112"
  },
  syncBannerText: {
    color: "#facc15",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center"
  },
  settings: {
    gap: 8,
    padding: 12,
    backgroundColor: "#151518",
    borderBottomWidth: 1,
    borderBottomColor: "#27272a"
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    color: "#a1a1aa",
    textTransform: "uppercase"
  },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#3f3f46",
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: "#111113",
    color: "#f8fafc"
  },
  lockedConfigValue: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "#0f0f11",
    color: "#d4d4d8",
    fontSize: 12,
    lineHeight: 18
  },
  screen: {
    flex: 1
  },
  screenContent: {
    padding: 12,
    paddingBottom: 24,
    gap: 12
  },
  formPanel: {
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#111113"
  },
  inlineActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center"
  },
  flexButton: {
    flex: 1,
    minWidth: 132
  },
  searchBoxSlim: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 2,
    backgroundColor: "#0b0b0c"
  },
  purchaseCard: {
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#151518"
  },
  csvInput: {
    minHeight: 150,
    paddingTop: 12,
    lineHeight: 18
  },
  csvHiddenNotice: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#0b0b0c",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  csvHiddenText: {
    color: "#a1a1aa",
    fontSize: 12,
    fontWeight: "900"
  },
  importResult: {
    color: "#26c6b8",
    fontSize: 12,
    fontWeight: "900"
  },
  filePickedText: {
    flex: 1,
    minWidth: 120,
    color: "#a1a1aa",
    fontSize: 12,
    fontWeight: "800"
  },
  importCard: {
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#151518"
  },
  importCardSkipped: {
    opacity: 0.54,
    borderColor: "#3f3f46"
  },
  importControls: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center"
  },
  shortInput: {
    flex: 1,
    minWidth: 74
  },
  flexInput: {
    flex: 1,
    minWidth: 190
  },
  pcIdInput: {
    width: 88
  },
  importWarning: {
    marginTop: 4,
    color: "#facc15",
    fontSize: 11,
    fontWeight: "800"
  },
  detailContent: {
    padding: 12,
    gap: 12,
    paddingBottom: 96
  },
  detailShell: {
    flex: 1,
    backgroundColor: "#0b0b0c"
  },
  detailTopActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center"
  },
  detailTopHint: {
    flex: 1,
    color: "#a1a1aa",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right"
  },
  imagePanel: {
    minHeight: 360,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#111113",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  detailLoading: {
    position: "absolute",
    top: 10,
    left: 10,
    zIndex: 2,
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: "#241013"
  },
  detailLoadingText: {
    color: "#fecaca",
    fontSize: 12,
    fontWeight: "800"
  },
  cardImage: {
    width: "100%",
    height: 360
  },
  imagePlaceholder: {
    minHeight: 220,
    padding: 20,
    alignItems: "center",
    justifyContent: "center"
  },
  imagePlaceholderTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center"
  },
  imagePlaceholderSub: {
    marginTop: 8,
    color: "#a1a1aa",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center"
  },
  detailInfo: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#151518"
  },
  detailTitle: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "900"
  },
  detailSub: {
    marginTop: 4,
    color: "#a1a1aa",
    fontSize: 13,
    fontWeight: "700"
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  infoTile: {
    width: "48.7%",
    minHeight: 74,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#151518",
    padding: 10,
    justifyContent: "space-between"
  },
  infoLabel: {
    color: "#a1a1aa",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  infoValue: {
    marginTop: 8,
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "900"
  },
  infoValueSmall: {
    fontSize: 12
  },
  infoTileGood: {
    borderColor: "#166534",
    backgroundColor: "#102016"
  },
  infoTileWarn: {
    borderColor: "#7f1d1d",
    backgroundColor: "#251112"
  },
  linkButton: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ef233c",
    backgroundColor: "#151518",
    alignItems: "center",
    justifyContent: "center"
  },
  linkButtonAlt: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#7f1d1d",
    backgroundColor: "#241013",
    alignItems: "center",
    justifyContent: "center"
  },
  linkButtonText: {
    color: "#f8fafc",
    fontWeight: "900"
  },
  linkUnavailable: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#a16207",
    backgroundColor: "#22180d",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  linkUnavailableText: {
    color: "#facc15",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  },
  detailBottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 76,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: "#27272a",
    backgroundColor: "#101012",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  detailBottomLabel: {
    color: "#a1a1aa",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  detailBottomPrice: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "900"
  },
  detailBottomButton: {
    minWidth: 150,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#ef233c",
    alignItems: "center",
    justifyContent: "center"
  },
  detailBottomButtonText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 15
  },
  dashboardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  businessHero: {
    minHeight: 320,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#151518",
    padding: 12,
    gap: 12
  },
  businessHeroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  businessHeroLogo: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#0b0b0c"
  },
  businessHeroCopy: {
    flex: 1
  },
  businessHeroEyebrow: {
    color: "#a1a1aa",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  businessHeroTitle: {
    marginTop: 2,
    color: "#f8fafc",
    fontSize: 21,
    fontWeight: "900"
  },
  businessHeroStats: {
    flexDirection: "row",
    gap: 8
  },
  businessHeroStat: {
    flex: 1,
    minHeight: 82,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#0f0f11",
    padding: 10,
    justifyContent: "space-between"
  },
  businessHeroLabel: {
    color: "#a1a1aa",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  businessHeroValue: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "900"
  },
  businessHeroSub: {
    color: "#ef233c",
    fontSize: 11,
    fontWeight: "800"
  },
  trendWrap: {
    minHeight: 76,
    borderRadius: 8,
    backgroundColor: "#0b0b0c",
    paddingHorizontal: 8,
    paddingTop: 8
  },
  trendBars: {
    height: 66,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 6
  },
  trendColumn: {
    flex: 1,
    height: 66,
    alignItems: "center",
    justifyContent: "flex-end"
  },
  trendBar: {
    width: "72%",
    borderRadius: 999,
    backgroundColor: "#ef233c"
  },
  trendLabel: {
    marginTop: 4,
    color: "#71717a",
    fontSize: 9,
    fontWeight: "900"
  },
  userPanel: {
    minHeight: 74,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#111113",
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  userPanelText: {
    flex: 1
  },
  userPanelName: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "900"
  },
  userPanelSub: {
    marginTop: 2,
    color: "#a1a1aa",
    fontSize: 12,
    fontWeight: "800"
  },
  brandPanel: {
    height: 126,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#1c1c1d",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  brandLogo: {
    width: "86%",
    height: "92%"
  },
  metric: {
    width: "48.7%",
    minHeight: 86,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#151518",
    padding: 10,
    justifyContent: "space-between"
  },
  metricTitle: {
    fontSize: 11,
    color: "#a1a1aa",
    fontWeight: "800",
    textTransform: "uppercase"
  },
  metricValue: {
    fontSize: 24,
    fontWeight: "900",
    color: "#f8fafc"
  },
  metricSub: {
    fontSize: 12,
    color: "#ef233c",
    fontWeight: "800"
  },
  actionRow: {
    flexDirection: "row",
    gap: 8
  },
  bigAction: {
    flex: 1,
    minHeight: 76,
    borderRadius: 8,
    backgroundColor: "#ef233c",
    padding: 12,
    justifyContent: "center"
  },
  bigActionAlt: {
    flex: 1,
    minHeight: 76,
    borderRadius: 8,
    backgroundColor: "#27272a",
    padding: 12,
    justifyContent: "center"
  },
  bigActionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900"
  },
  bigActionSub: {
    marginTop: 4,
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "700"
  },
  configAction: {
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#111113",
    paddingHorizontal: 12,
    justifyContent: "center"
  },
  configActionTitle: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "900"
  },
  configActionSub: {
    marginTop: 3,
    color: "#a1a1aa",
    fontSize: 12,
    fontWeight: "700"
  },
  configActionHalf: {
    flex: 1,
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#111113",
    paddingHorizontal: 12,
    justifyContent: "center"
  },
  adminPanel: {
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#111113"
  },
  adminPanelSub: {
    color: "#a1a1aa",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  adminUserRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#27272a",
    paddingTop: 8
  },
  adminUserText: {
    flex: 1
  },
  adminUserName: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "900"
  },
  adminUserRole: {
    marginTop: 2,
    color: "#a1a1aa",
    fontSize: 12,
    fontWeight: "800"
  },
  historyUpdated: {
    marginTop: 3,
    color: "#71717a",
    fontSize: 11,
    fontWeight: "800"
  },
  historyCard: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#151518"
  },
  pendingSalesPanel: {
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#7f1d1d",
    backgroundColor: "#1f1113"
  },
  pendingSalesSub: {
    marginTop: 3,
    color: "#fecaca",
    fontSize: 12,
    fontWeight: "800"
  },
  pendingSaleRow: {
    minHeight: 62,
    borderTopWidth: 1,
    borderTopColor: "#3f2024",
    paddingTop: 8,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start"
  },
  pendingSaleBuyer: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "900"
  },
  pendingSaleMeta: {
    marginTop: 3,
    color: "#d4d4d8",
    fontSize: 12,
    fontWeight: "800"
  },
  pendingSaleError: {
    marginTop: 3,
    color: "#facc15",
    fontSize: 11,
    fontWeight: "800"
  },
  pendingSaleTotal: {
    maxWidth: 132,
    color: "#ef233c",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "right"
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#f8fafc"
  },
  smallButton: {
    minHeight: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3f3f46",
    paddingHorizontal: 10,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#18181b"
  },
  smallButtonText: {
    fontSize: 12,
    color: "#ef233c",
    fontWeight: "800"
  },
  versionText: {
    color: "#52525b",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
    paddingVertical: 8
  },
  searchBox: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: "#0b0b0c",
    alignItems: "center"
  },
  searchInput: {
    flex: 1,
    minHeight: 52,
    borderWidth: 1,
    borderColor: "#2b2b30",
    borderRadius: 999,
    paddingHorizontal: 18,
    backgroundColor: "#050506",
    color: "#f8fafc",
    fontSize: 16
  },
  goButton: {
    width: 52,
    minHeight: 52,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2b2b30",
    backgroundColor: "#141416",
    alignItems: "center",
    justifyContent: "center"
  },
  goText: {
    color: "#ef233c",
    fontWeight: "900"
  },
  results: {
    flex: 1,
    backgroundColor: "#0b0b0c"
  },
  filterCompactPanel: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: "#0b0b0c",
    borderBottomWidth: 1,
    borderBottomColor: "#18181b"
  },
  filterCompactTop: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  filterPanel: {
    gap: 8,
    paddingTop: 8
  },
  filterCount: {
    flex: 1,
    color: "#a1a1aa",
    fontSize: 12,
    fontWeight: "800"
  },
  filterSummary: {
    color: "#71717a",
    fontSize: 11,
    fontWeight: "800"
  },
  filterCountInline: {
    alignSelf: "center",
    color: "#a1a1aa",
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 8
  },
  filterRow: {
    gap: 8,
    paddingRight: 12
  },
  orderFiltersWrap: {
    height: 46,
    backgroundColor: "#0b0b0c",
    borderBottomWidth: 1,
    borderBottomColor: "#18181b"
  },
  filterRowWide: {
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
    alignItems: "center",
    backgroundColor: "#0b0b0c"
  },
  filterToggle: {
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#3f3f46",
    backgroundColor: "#141416",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  filterChip: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#3f3f46",
    backgroundColor: "#141416",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  filterChipActive: {
    borderColor: "#ef233c",
    backgroundColor: "#241013"
  },
  filterChipText: {
    color: "#d4d4d8",
    fontSize: 12,
    fontWeight: "800"
  },
  filterChipTextActive: {
    color: "#fff"
  },
  resultsGrid: {
    paddingHorizontal: 12,
    paddingBottom: 24,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  ordersWrap: {
    flex: 1
  },
  saleGridCard: {
    width: "48.5%",
    minHeight: 318,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2a2a2f",
    backgroundColor: "#050506",
    padding: 10,
    overflow: "hidden"
  },
  saleGridTapArea: {
    flex: 1
  },
  saleImageFrame: {
    height: 172,
    borderRadius: 6,
    backgroundColor: "#0e0e10",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  saleGridImage: {
    width: "100%",
    height: "100%"
  },
  saleGridFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#18181b"
  },
  saleCardTitle: {
    marginTop: 10,
    minHeight: 42,
    color: "#f8fafc",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900"
  },
  saleCardSet: {
    minHeight: 36,
    color: "#d4d4d8",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700"
  },
  saleCardMeta: {
    color: "#26c6b8",
    fontSize: 12,
    fontWeight: "700"
  },
  saleCardFooter: {
    marginTop: "auto",
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8
  },
  saleQty: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "800"
  },
  saleReserved: {
    marginTop: 3,
    color: "#facc15",
    fontSize: 10,
    fontWeight: "900"
  },
  saleUsd: {
    marginTop: 3,
    color: "#a1a1aa",
    fontSize: 11,
    fontWeight: "700"
  },
  salePrice: {
    flexShrink: 1,
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "right"
  },
  saleAddMini: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#3f3f46",
    backgroundColor: "#18181b",
    alignItems: "center",
    justifyContent: "center"
  },
  addedPill: {
    position: "absolute",
    left: 10,
    right: 10,
    top: 144,
    minHeight: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ef233c"
  },
  addedPillText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900"
  },
  card: {
    marginBottom: 8,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#151518",
    flexDirection: "row",
    gap: 10,
    alignItems: "center"
  },
  resultThumb: {
    width: 58,
    height: 78,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#27272a",
    overflow: "hidden",
    backgroundColor: "#0b0b0c"
  },
  resultThumbImage: {
    width: "100%",
    height: "100%"
  },
  resultThumbFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#222225"
  },
  resultThumbText: {
    color: "#ef233c",
    fontWeight: "900",
    fontSize: 16
  },
  cardBody: {
    flex: 1
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#f8fafc"
  },
  cardSub: {
    marginTop: 2,
    fontSize: 12,
    color: "#a1a1aa"
  },
  chips: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  chip: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#27272a"
  },
  chipWarn: {
    backgroundColor: "#3a2608"
  },
  chipText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#e4e4e7"
  },
  chipWarnText: {
    color: "#facc15"
  },
  addButton: {
    width: 54,
    height: 54,
    borderRadius: 8,
    backgroundColor: "#ef233c",
    alignItems: "center",
    justifyContent: "center"
  },
  addText: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 24
  },
  orderCard: {
    marginBottom: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#151518"
  },
  orderTop: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start"
  },
  orderTotal: {
    maxWidth: 140,
    color: "#ef233c",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "right"
  },
  orderItems: {
    marginTop: 8,
    color: "#d4d4d8",
    fontSize: 12,
    lineHeight: 17
  },
  orderActions: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  orderBulkActions: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8
  },
  orderUpdating: {
    minWidth: 112,
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#241013"
  },
  orderUpdatingText: {
    color: "#fecaca",
    fontSize: 12,
    fontWeight: "800"
  },
  orderButton: {
    flex: 1,
    minWidth: 92,
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3f3f46",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#18181b",
    flexDirection: "row",
    gap: 6
  },
  orderButtonText: {
    color: "#f8fafc",
    fontWeight: "900"
  },
  orderButtonPrimary: {
    flex: 1,
    minWidth: 104,
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: "#ef233c",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6
  },
  orderButtonPrimaryText: {
    color: "#fff",
    fontWeight: "900"
  },
  messagePanelOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.78)"
  },
  messagePanel: {
    width: "100%",
    maxWidth: 720,
    maxHeight: "86%",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3f3f46",
    padding: 12,
    backgroundColor: "#111113",
    gap: 10
  },
  messagePanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  messagePanelTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900"
  },
  messagePanelSub: {
    marginTop: 2,
    color: "#a1a1aa",
    fontSize: 12,
    fontWeight: "700"
  },
  messageTextArea: {
    minHeight: 300,
    maxHeight: 460,
    borderWidth: 1,
    borderColor: "#3f3f46",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#050506",
    color: "#f8fafc",
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: "top"
  },
  orderDetailShell: {
    flex: 1,
    backgroundColor: "#0b0b0c"
  },
  orderDetailContent: {
    padding: 12,
    gap: 10,
    paddingBottom: 108
  },
  orderDetailHero: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2a2a2f",
    backgroundColor: "#050506"
  },
  orderDetailBuyer: {
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "900"
  },
  orderDetailMeta: {
    marginTop: 4,
    color: "#a1a1aa",
    fontSize: 12,
    fontWeight: "800"
  },
  orderDetailTotals: {
    marginTop: 12,
    color: "#ef233c",
    fontSize: 20,
    fontWeight: "900"
  },
  progressTrack: {
    marginTop: 12,
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#27272a"
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#26c6b8"
  },
  orderDetailSectionTitle: {
    marginTop: 4,
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "900"
  },
  orderLineCard: {
    minHeight: 128,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#111113",
    padding: 8,
    flexDirection: "row",
    gap: 10,
    alignItems: "center"
  },
  orderLineChecked: {
    borderColor: "#26c6b8",
    backgroundColor: "#071717"
  },
  orderLineThumb: {
    width: 76,
    height: 106,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#2a2a2f",
    backgroundColor: "#050506",
    overflow: "hidden"
  },
  orderLineImage: {
    width: "100%",
    height: "100%"
  },
  orderLineFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#18181b"
  },
  orderLineBody: {
    flex: 1,
    minHeight: 106,
    justifyContent: "space-between"
  },
  orderLineName: {
    color: "#f8fafc",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900"
  },
  orderLineSub: {
    marginTop: 4,
    color: "#a1a1aa",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  },
  orderLineBottom: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8
  },
  orderLineQty: {
    color: "#d4d4d8",
    fontSize: 12,
    fontWeight: "800"
  },
  orderLinePrice: {
    flexShrink: 1,
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "right"
  },
  orderCheck: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#3f3f46",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0b0b0c"
  },
  orderCheckDone: {
    borderColor: "#26c6b8",
    backgroundColor: "#0d3b36"
  },
  orderCheckText: {
    color: "#f8fafc",
    fontSize: 10,
    fontWeight: "900"
  },
  orderDetailBottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 78,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: "#27272a",
    backgroundColor: "#101012",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  emptyState: {
    padding: 20
  },
  richEmpty: {
    width: "100%",
    paddingHorizontal: 18,
    paddingVertical: 34,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center"
  },
  empty: {
    paddingVertical: 24,
    color: "#a1a1aa",
    textAlign: "center"
  },
  cartScreen: {
    flex: 1,
    backgroundColor: "#0b0b0c"
  },
  cartSummary: {
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#27272a",
    backgroundColor: "#101012",
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  cartSummaryText: {
    flex: 1,
    alignItems: "flex-end"
  },
  cart: {
    maxHeight: "48%",
    borderTopWidth: 1,
    borderTopColor: "#27272a",
    backgroundColor: "#101012"
  },
  cartTop: {
    minHeight: 42,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#27272a"
  },
  cartTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#f8fafc"
  },
  cartTotal: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ef233c"
  },
  cartLines: {
    maxHeight: 190,
    paddingHorizontal: 12
  },
  cartLinesFull: {
    flex: 1,
    paddingHorizontal: 12
  },
  cartLinesContent: {
    paddingBottom: 12
  },
  cartLine: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#27272a",
    flexDirection: "row",
    gap: 8
  },
  cartInfo: {
    flex: 1
  },
  cartName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#f8fafc"
  },
  cartSub: {
    marginTop: 2,
    color: "#a1a1aa",
    fontSize: 12
  },
  priceRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8
  },
  moneyField: {
    flex: 1
  },
  moneyLabel: {
    marginBottom: 4,
    fontSize: 10,
    color: "#a1a1aa",
    fontWeight: "800",
    textTransform: "uppercase"
  },
  moneyInput: {
    height: 36,
    borderWidth: 1,
    borderColor: "#3f3f46",
    borderRadius: 8,
    paddingHorizontal: 8,
    color: "#f8fafc",
    backgroundColor: "#111113"
  },
  qtyControls: {
    width: 38,
    alignItems: "center",
    gap: 4
  },
  qtyButton: {
    width: 34,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3f3f46",
    alignItems: "center",
    justifyContent: "center"
  },
  qtyText: {
    fontWeight: "900",
    color: "#f8fafc"
  },
  qtyValue: {
    fontWeight: "800",
    color: "#f8fafc"
  },
  removeButton: {
    width: 34,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  removeText: {
    color: "#ef233c",
    fontWeight: "900"
  },
  emptyCart: {
    paddingVertical: 16,
    color: "#a1a1aa",
    textAlign: "center"
  },
  saleFields: {
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#27272a"
  },
  detailPriceEditor: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#151518",
    gap: 10
  },
  detailQuickActions: {
    flexDirection: "row",
    gap: 8
  },
  buyerInput: {
    minHeight: 40
  },
  originRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  originButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#3f3f46",
    backgroundColor: "#18181b"
  },
  originActive: {
    backgroundColor: "#3a1015",
    borderColor: "#ef233c"
  },
  originText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#d4d4d8"
  },
  originActiveText: {
    color: "#ffffff"
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: "#ef233c",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8
  },
  bottomNav: {
    minHeight: 66,
    paddingTop: 7,
    paddingBottom: 8,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: "#27272a",
    backgroundColor: "#101012",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around"
  },
  bottomNavButton: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 3
  },
  bottomNavLabel: {
    color: "#a1a1aa",
    fontSize: 10,
    fontWeight: "800"
  },
  bottomNavLabelActive: {
    color: "#f8fafc"
  },
  bottomBadge: {
    position: "absolute",
    right: -10,
    top: -6,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ef233c"
  },
  bottomBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "900"
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3f3f46",
    backgroundColor: "#18181b",
    alignItems: "center",
    justifyContent: "center"
  },
  iconPrimaryButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#ef233c",
    alignItems: "center",
    justifyContent: "center"
  },
  goButtonSmall: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#ef233c",
    alignItems: "center",
    justifyContent: "center"
  },
  searchInputBare: {
    flex: 1,
    minHeight: 44,
    color: "#f8fafc",
    fontSize: 16
  },
  actionWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  moreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  moreAction: {
    width: "48.7%",
    minHeight: 112,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#151518",
    justifyContent: "space-between"
  },
  healthPanel: {
    minHeight: 78,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#14532d",
    backgroundColor: "#0d1d13",
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  healthPanelWarn: {
    borderColor: "#713f12",
    backgroundColor: "#201707"
  },
  healthIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#0b0b0c",
    alignItems: "center",
    justifyContent: "center"
  },
  paymentHero: {
    minHeight: 170,
    padding: 16,
    borderRadius: 8,
    backgroundColor: "#151518",
    alignItems: "center",
    justifyContent: "center",
    gap: 7
  },
  paymentBalance: {
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center"
  },
  depositSummary: {
    marginTop: 8,
    minHeight: 42,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#22180d",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  depositLabel: {
    color: "#facc15",
    fontSize: 11,
    fontWeight: "900"
  },
  depositValue: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "right"
  },
  addLineButton: {
    width: 42,
    height: 42,
    marginTop: 14,
    borderRadius: 8,
    backgroundColor: "#ef233c",
    alignItems: "center",
    justifyContent: "center"
  },
  draftPurchaseLine: {
    minHeight: 58,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#0b0b0c",
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  purchaseLine: {
    minHeight: 64,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#27272a",
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  partialReceiveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  partialInput: {
    width: 46,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3f3f46",
    color: "#f8fafc",
    textAlign: "center",
    fontWeight: "900"
  },
  stockListContent: {
    padding: 12,
    paddingBottom: 24,
    gap: 8
  },
  stockManageRow: {
    minHeight: 92,
    padding: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#151518",
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  stockManageThumb: {
    width: 58,
    height: 76,
    borderRadius: 6,
    backgroundColor: "#0b0b0c",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  stockManageImage: {
    width: "100%",
    height: "100%"
  },
  stockManagePrice: {
    maxWidth: 100,
    alignItems: "flex-end",
    gap: 10
  },
  stockEditHero: {
    minHeight: 160,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#151518",
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  stockEditImage: {
    width: 104,
    height: 142
  },
  quantityEditor: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12
  },
  qtyButtonLarge: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3f3f46",
    backgroundColor: "#18181b",
    alignItems: "center",
    justifyContent: "center"
  },
  quantityInput: {
    width: 100,
    height: 54,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ef233c",
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
    backgroundColor: "#0b0b0c"
  },
  toggleRow: {
    minHeight: 48,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3f3f46",
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  toggleRowActive: {
    borderColor: "#166534",
    backgroundColor: "#102016"
  },
  recentSearchWrap: {
    maxHeight: 42,
    paddingHorizontal: 12,
    backgroundColor: "#0b0b0c"
  },
  recentChip: {
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: "#18181b",
    justifyContent: "center"
  },
  recentChipText: {
    color: "#d4d4d8",
    fontSize: 11,
    fontWeight: "800"
  },
  favoriteButton: {
    position: "absolute",
    left: 8,
    top: 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(10,10,11,0.88)",
    alignItems: "center",
    justifyContent: "center"
  },
  shareButton: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3f3f46",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  dangerOutlineButton: {
    marginTop: 10,
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#7f1d1d",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7
  },
  dangerOutlineText: {
    color: "#f87171",
    fontSize: 12,
    fontWeight: "900"
  },
  dangerPanel: {
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#7f1d1d",
    backgroundColor: "#251112"
  },
  dangerButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: "#b91c1c",
    alignItems: "center",
    justifyContent: "center"
  },
  lineTrendWrap: {
    minHeight: 108,
    borderRadius: 8,
    backgroundColor: "#0b0b0c",
    padding: 10
  },
  lineTrendEmpty: {
    minHeight: 62,
    borderRadius: 8,
    backgroundColor: "#0b0b0c",
    alignItems: "center",
    justifyContent: "center",
    padding: 10
  },
  trendEmptyText: {
    color: "#71717a",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center"
  },
  lineTrendValue: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "900"
  },
  disabledButton: {
    opacity: 0.5
  },
  primaryText: {
    color: "#fff",
    fontWeight: "900"
  }
});
