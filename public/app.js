// Warehouse Management Dashboard Application


// ===== Global State & Session Tracking =====
let appState = {
  products: [],
  invoices: [],
  tasks: [],
  warehouseConfig: { capacity: 1000 },
  alerts: [],
  kpis: null,
  space: null,
  errorMessage: ''
};

let isEditMode = false;
let deleteHandlersInitialized = false;
let editModeButton = null;
let editModeButtonDefaultLabel = 'Editar';
const editSession = {
  snapshot: null,
  invoices: new Map(),
  tasks: new Map(),
  products: new Map()
};
const confirmModalElements = {
  root: null,
  summary: null,
  invoicesSection: null,
  invoicesList: null,
  tasksSection: null,
  tasksList: null,
  productsSection: null,
  productsList: null,
  cancelBtn: null,
  confirmBtn: null
};
const productEditorState = {
  modal: null,
  form: null,
  errors: null,
  deleteBtn: null,
  cancelBtn: null,
  saveBtn: null,
  productId: null,
  originalProduct: null,
  initialized: false
};
let productEditHandlersInitialized = false;
let isApplyingPendingChanges = false;
let offlineBannerMessage = '';
const STORAGE_KEYS = {
  cache: 'easy_stock_cache_v1',
  queue: 'easy_stock_queue_v1'
};
let pendingSyncQueue = loadPendingQueueFromStorage();
let isOfflineMode = !navigator.onLine;

const OCR_IMPORT_ENDPOINT = '/api/import/ocr-products';
let pendingOcrReview = null;
const ocrReviewSelection = new Set();
const ocrReviewUi = {
  root: null,
  summary: null,
  fileName: null,
  supplier: null,
  destination: null,
  albaranNumber: null,
  albaranDate: null,
  confidence: null,
  products: null,
  hint: null,
  errors: null,
  approveBtn: null,
  cancelBtn: null
};
let isOcrReviewSubmitting = false;

function getProductById(productId) {
  if (!productId) return null;
  const targetId = String(productId);
  return appState.products.find(product => String(product.id) === targetId) || null;
}

function loadPendingQueueFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.queue);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('No se pudo cargar la cola offline:', error);
    return [];
  }
}

function persistPendingQueue() {
  try {
    localStorage.setItem(STORAGE_KEYS.queue, JSON.stringify(pendingSyncQueue));
  } catch (error) {
    console.warn('No se pudo guardar la cola offline:', error);
  }
}

function persistAppStateSnapshot() {
  try {
    const snapshot = {
      products: appState.products,
      invoices: appState.invoices,
      tasks: appState.tasks,
      alerts: appState.alerts,
      kpis: appState.kpis,
      warehouseConfig: appState.warehouseConfig,
      space: appState.space
    };
    localStorage.setItem(STORAGE_KEYS.cache, JSON.stringify(snapshot));
  } catch (error) {
    console.warn('No se pudo guardar la caché local:', error);
  }
}

function loadAppStateFromCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.cache);
    if (!raw) return false;
    const snapshot = JSON.parse(raw);
    if (!snapshot || typeof snapshot !== 'object') return false;
    appState.products = Array.isArray(snapshot.products) ? snapshot.products : [];
    appState.invoices = Array.isArray(snapshot.invoices) ? snapshot.invoices : [];
    appState.tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];
    appState.alerts = Array.isArray(snapshot.alerts) ? snapshot.alerts : [];
    appState.kpis = snapshot.kpis || null;
    appState.warehouseConfig = snapshot.warehouseConfig || appState.warehouseConfig;
    appState.space = snapshot.space || null;
    return true;
  } catch (error) {
    console.warn('No se pudo restaurar la caché local:', error);
    return false;
  }
}

// Normalizers to adapt API responses to the UI data model
function normalizeProduct(product) {
  return {
    id: product.id,
    nombre: product.nombre || product.name || 'Producto sin nombre',
    sku: product.sku || 'N/D',
    stock_actual: product.stock_actual ?? product.currentStock ?? 0,
    precio_unitario: toNumber(product.precio_unitario ?? product.unitPrice ?? 0),
    categoria: product.categoria || product.category || 'Sin categoría',
    caducidad: formatDate(product.caducidad || product.expirationDate),
    ubicacion: product.ubicacion || product.location || 'Sin ubicación',
    stockMin: product.stockMin ?? product.minStock ?? 0,
    stockMax: product.stockMax ?? product.maxStock ?? 0,
    zona: product.zona || product.zone || '',
    proveedor: product.proveedor || product.supplier || '',
    codigo: product.codigo || product.barcode || ''
  };
}

function normalizeAlert(alert) {
  const priorityMap = {
    critica: 'critical',
    atencion: 'warning',
    leve: 'info',
    informativa: 'info'
  };

  return {
    id: alert.id,
    title: alert.title || alert.message || 'Alerta del sistema',
    description: formatAlertDescription(alert),
    priority: alert.priority || priorityMap[alert.alertType] || 'info',
    type: alert.alertType || 'info'
  };
}

function normalizeInvoice(invoice) {
  const status = (invoice.status || 'PENDING').toString().toUpperCase();
  return {
    id: invoice.id || invoice.invoiceNumber || 'N/A',
    vendor: invoice.vendor || invoice.supplierName || 'Proveedor desconocido',
    amount: toNumber(invoice.amount ?? invoice.totalAmount ?? 0),
    dueDate: invoice.dueDate || invoice.limitDate,
    status
  };
}

function mapInvoicesForState(invoicesResponse = []) {
  const now = Date.now();
  const list = Array.isArray(invoicesResponse) ? invoicesResponse : [];
  return list.map((invoice, index) => {
    const normalized = normalizeInvoice(invoice);
    const uiId = normalized._uiId || String(normalized.id ?? `invoice-${now}-${index}`);
    return { ...normalized, _uiId: uiId };
  });
}

function mapTasksForState(tasksResponse = []) {
  const now = Date.now();
  const list = Array.isArray(tasksResponse) ? tasksResponse : [];
  return list.map((task, index) => {
    const uiId = task._uiId || String(task.id ?? `task-${now}-${index}`);
    return { ...task, _uiId: uiId };
  });
}

function formatAlertDescription(alert) {
  const parts = [];
  if (alert.message) parts.push(alert.message);
  if (alert.product?.name || alert.product?.nombre) {
    parts.push(`Producto: ${alert.product.nombre || alert.product.name}`);
  }
  return parts.join(' - ');
}

function toNumber(value) {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatDate(dateValue) {
  if (!dateValue) return null;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split('T')[0];
}

function initThemeToggle() {
  const themeToggle = document.getElementById('theme-toggle');
  const html = document.documentElement;
  if (!themeToggle || !html) {
    return;
  }

  const savedTheme = localStorage.getItem('theme');
  const initialTheme = savedTheme || 'light';
  html.setAttribute('data-color-scheme', initialTheme);

  const animatedSelectors = '.card, .kpi-card, .header, .btn, .alert-item, .invoice-item, .task-item';

  function addTransition() {
    html.style.transition = 'background-color 0.4s cubic-bezier(0.4, 0, 0.2, 1), color 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    document.querySelectorAll(animatedSelectors).forEach((el) => {
      el.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    });
  }

  function removeTransition() {
    setTimeout(() => {
      html.style.transition = '';
      document.querySelectorAll(animatedSelectors).forEach((el) => {
        el.style.transition = '';
      });
    }, 400);
  }

  function toggleTheme() {
    const currentTheme = html.getAttribute('data-color-scheme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    addTransition();
    html.setAttribute('data-color-scheme', newTheme);
    localStorage.setItem('theme', newTheme);

    themeToggle.style.transform = 'scale(0.9)';
    setTimeout(() => {
      themeToggle.style.transform = '';
    }, 200);

    removeTransition();
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: newTheme } }));
  }

  themeToggle.addEventListener('click', toggleTheme);
  themeToggle.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleTheme();
    }
  });

  window.toggleTheme = toggleTheme;
}

// Initialize Application
async function init() {
  console.log('Initializing Warehouse Management Dashboard...');
  
  // Load data
  try {
    await loadData();
  } catch (error) {
    console.warn('Loading dashboard with fallback data', error);
  }
  
  // Update UI
  updateCurrentDate();
  updateKPIs();
  renderErrorBanner();
  renderAlerts();
  renderProductsTable();
  updateWarehouseGauge();
  updateSpaceOccupancy();
  renderInvoices();
  renderTasks();
  
  // Initialize voice control
  initThemeToggle();
  initVoiceControl();
  initEditModeToggle();
  initDeletionHandlers();
  initProductRowEditing();
  initProductEditor();
  initConfirmModal();
  initConnectivityListeners();
  initOCRUpload();
  initOcrReviewModal();
  initOcrReviewActionHandlers();
  
  console.log('Dashboard initialized successfully!');
}

// ===== Initial Data Fetch & Bootstrapping =====
async function loadData() {
  try {
    const [productsRes, alertsRes, invoicesRes, kpisRes, tasksRes, spaceRes] = await Promise.all([
      fetch('/api/products'),
      fetch('/api/alerts'),
      fetch('/api/invoices'),
      fetch('/api/kpis'),
      fetch('/api/tasks'),
      fetch('/api/space')
    ]);

    if (!productsRes.ok) throw new Error('No se pudieron obtener los productos');
    if (!alertsRes.ok) throw new Error('No se pudieron obtener las alertas');
    if (!invoicesRes.ok) throw new Error('No se pudieron obtener las facturas');
    if (!kpisRes.ok) throw new Error('No se pudieron obtener los KPIs');
    if (!tasksRes.ok) throw new Error('No se pudieron obtener las tareas');
    if (!spaceRes.ok) throw new Error('No se pudo obtener la ocupación de espacio');

    const [products, alerts, invoices, kpis, tasks, space] = await Promise.all([
      productsRes.json(),
      alertsRes.json(),
      invoicesRes.json(),
      kpisRes.json(),
      tasksRes.json(),
      spaceRes.json()
    ]);

    appState.products = Array.isArray(products)
      ? products.map(normalizeProduct)
      : [];

    const normalizedAlerts = Array.isArray(alerts)
      ? alerts.map(normalizeAlert)
      : [];
    const autoAlerts = generateAlerts(appState.products);
    const priorityOrder = { critical: 0, warning: 1, info: 2 };
    appState.alerts = [...normalizedAlerts, ...autoAlerts]
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    appState.invoices = mapInvoicesForState(invoices);

    appState.tasks = mapTasksForState(tasks);

    appState.kpis = kpis || null;
    const capacityFromKpis = kpis?.warehouseConfig?.totalCapacity || kpis?.totalCapacity || kpis?.capacity;
    const occupancyFromKpis = kpis?.warehouseConfig?.occupiedPercentage || kpis?.occupied_percentage || kpis?.occupiedPercentage;
    appState.warehouseConfig = {
      capacity: capacityFromKpis || appState.warehouseConfig.capacity || 1000,
      occupied_percentage: occupancyFromKpis || null
    };

    // Space occupancy (volumetric)
    appState.space = space && typeof space === 'object' ? space : null;

    console.log('✅ Datos cargados desde base de datos');
    appState.errorMessage = '';
    persistAppStateSnapshot();
  } catch (error) {
    console.error('❌ Error cargando datos:', error);
    const loadedFromCache = loadAppStateFromCache();
    if (loadedFromCache) {
      isOfflineMode = true;
      appState.errorMessage = '';
      setOfflineBanner('Modo offline: mostrando datos almacenados.');
      return;
    }
    appState.errorMessage = 'No se pudo cargar la información del servidor. Intenta más tarde.';
    // Fallback a datos de muestra si falla la API
    if (typeof sampleData !== 'undefined') {
      appState.products = sampleData.products || [];
      appState.invoices = mapInvoicesForState(sampleData.invoices || []);
      appState.tasks = mapTasksForState(sampleData.tasks || []);
      appState.alerts = generateAlerts(appState.products);
    } else {
      appState.products = [];
      appState.invoices = [];
      appState.tasks = [];
      appState.alerts = [];
    }
    throw error;
  }
}

function initConnectivityListeners() {
  window.addEventListener('online', handleConnectionRestored);
  window.addEventListener('offline', handleConnectionLost);
  if (isOfflineMode) {
    setOfflineBanner('Modo offline: tus cambios se guardarán localmente.');
  }
  if (pendingSyncQueue.length && navigator.onLine) {
    flushPendingQueue();
  }
}

function handleConnectionLost() {
  isOfflineMode = true;
  setOfflineBanner('Sin conexión. Puedes seguir trabajando y sincronizaremos al volver.');
}

function handleConnectionRestored() {
  isOfflineMode = false;
  flushPendingQueue();
}

function setOfflineBanner(message = '') {
  offlineBannerMessage = message;
  renderErrorBanner();
}

async function flushPendingQueue() {
  if (!pendingSyncQueue.length || !navigator.onLine) {
    if (!pendingSyncQueue.length) {
      setOfflineBanner('');
    }
    return;
  }

  setOfflineBanner('Sincronizando cambios pendientes...');

  while (pendingSyncQueue.length && navigator.onLine) {
    const entry = pendingSyncQueue[0];
    try {
      await processQueuedEntry(entry);
      pendingSyncQueue.shift();
      persistPendingQueue();
    } catch (error) {
      console.error('No se pudo sincronizar la cola offline:', error);
      setOfflineBanner('No se pudo sincronizar. Reintentaremos cuando haya conexión estable.');
      return;
    }
  }

  try {
    await loadData();
    refreshInventoryWidgets({ includeLists: true });
    setOfflineBanner('');
  } catch (error) {
    console.error('Error refrescando datos tras sincronizar:', error);
    setOfflineBanner('Datos sincronizados, pero no pudimos refrescar el tablero. Actualiza manualmente.');
  }
}

async function processQueuedEntry(entry) {
  const invoiceRequests = (entry.invoices || []).map(invoiceId => deleteInvoiceById(invoiceId));
  const taskRequests = (entry.tasks || []).map(taskId => deleteTaskById(taskId));
  const productResults = { updated: [], deleted: [] };
  const productRequests = [];

  (entry.products || []).forEach(({ productId, change }) => {
    if (!productId || !change) return;
    if (change.action === 'delete') {
      productRequests.push(
        deleteProductById(productId).then(() => {
          productResults.deleted.push(productId);
        })
      );
    } else if (change.action === 'update') {
      productRequests.push(
        applyProductUpdate(productId, change).then((product) => {
          if (product) {
            productResults.updated.push(product);
          }
        })
      );
    }
  });

  await Promise.all([...invoiceRequests, ...taskRequests, ...productRequests]);
}

function enqueuePendingChangesFromSession() {
  const entry = {
    id: `queue-${Date.now()}`,
    timestamp: Date.now(),
    invoices: Array.from(editSession.invoices.values())
      .map(invoice => invoice.id)
      .filter(Boolean),
    tasks: Array.from(editSession.tasks.values())
      .map(task => task.id)
      .filter(Boolean),
    products: Array.from(editSession.products.entries()).map(([productId, change]) => ({
      productId,
      change: deepClone(change)
    }))
  };

  const hasChanges = entry.invoices.length || entry.tasks.length || entry.products.length;
  if (!hasChanges) {
    return;
  }

  pendingSyncQueue.push(entry);
  persistPendingQueue();
  setOfflineBanner('Cambios guardados offline. Se sincronizarán automáticamente.');
}

function buildLocalProductResultsFromEdits() {
  const productResults = { updated: [], deleted: [] };
  editSession.products.forEach((change, productId) => {
    if (change.action === 'delete') {
      productResults.deleted.push(productId);
    }
  });
  return productResults;
}

function shouldEnqueueOffline(error) {
  if (!error) return false;
  if (!navigator.onLine) return true;
  const message = error.message || '';
  return message.includes('Failed to fetch') || message.includes('NetworkError');
}


// Helper function to calculate days until expiration
function getDaysUntilExpiration(expirationDate) {
  if (!expirationDate) return Infinity;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDate = new Date(expirationDate);
  if (Number.isNaN(expDate.getTime())) return Infinity;
  expDate.setHours(0, 0, 0, 0);
  const diffTime = expDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Generate Alerts
function generateAlerts(products = appState.products) {
  const alerts = [];
  
  products.forEach(product => {
    const daysUntilExpiration = getDaysUntilExpiration(product.caducidad);
    
    if (Number.isFinite(daysUntilExpiration)) {
      if (daysUntilExpiration < 2) {
        alerts.push({
          type: 'critical',
          title: `Caducidad crítica: ${product.nombre}`,
          description: `Caduca en ${daysUntilExpiration} día(s) - ${product.caducidad}. Ubicación: ${product.ubicacion}`,
          priority: 'critical'
        });
      } else if (daysUntilExpiration >= 2 && daysUntilExpiration <= 7) {
        alerts.push({
          type: 'warning',
          title: `Próximo a caducar: ${product.nombre}`,
          description: `Caduca en ${daysUntilExpiration} días - ${product.caducidad}. Ubicación: ${product.ubicacion}`,
          priority: 'warning'
        });
      }
    }
    
    if (product.stock_actual <= product.stockMin * 0.5) {
      alerts.push({
        type: 'critical',
        title: `Stock crítico: ${product.nombre}`,
        description: `Solo quedan ${product.stock_actual} unidades. Ubicación: ${product.ubicacion}`,
        priority: 'critical'
      });
    } else if (product.stock_actual <= product.stockMin) {
      alerts.push({
        type: 'warning',
        title: `Stock bajo: ${product.nombre}`,
        description: `${product.stock_actual} unidades disponibles. Ubicación: ${product.ubicacion}`,
        priority: 'warning'
      });
    } else if (product.stock_actual >= product.stockMax) {
      alerts.push({
        type: 'info',
        title: `Exceso de stock: ${product.nombre}`,
        description: `${product.stock_actual} unidades (máx: ${product.stockMax}). Ubicación: ${product.ubicacion}`,
        priority: 'info'
      });
    }
  });
  
  const priorityOrder = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

// Update Current Date
function updateCurrentDate() {
  const dateElement = document.getElementById('current-date');
  if (dateElement) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const currentDate = new Date().toLocaleDateString('es-ES', options);
    dateElement.textContent = currentDate;
  }
}

// Update KPIs
function updateKPIs() {
  const totalProducts = appState.products.reduce((sum, p) => sum + (Number(p.stock_actual) || 0), 0);
  const totalProductsElement = document.getElementById('kpi-total-products');
  if (totalProductsElement) {
    totalProductsElement.textContent = totalProducts.toLocaleString('es-ES');
  }
  
  // Total Value
  const totalValue = appState.products.reduce((sum, p) => {
    const stock = Number(p.stock_actual) || 0;
    const price = Number(p.precio_unitario) || 0;
    return sum + (stock * price);
  }, 0);
  const totalValueElement = document.getElementById('kpi-total-value');
  if (totalValueElement) {
    totalValueElement.textContent = `€${totalValue.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  
  // Active Alerts
  const alertsCount = appState.alerts.filter(a => a.priority === 'critical' || a.priority === 'warning').length;
  const alertsElement = document.getElementById('kpi-alerts');
  if (alertsElement) {
    alertsElement.textContent = alertsCount;
  }
}

// Render Alerts
function renderAlerts() {
  const alertsList = document.getElementById('alerts-list');
  if (!alertsList) return;
  
  if (appState.alerts.length === 0) {
    alertsList.innerHTML = '<p style="color: var(--color-text-secondary); text-align: center; padding: 20px;">No hay alertas activas</p>';
    return;
  }
  
  alertsList.innerHTML = appState.alerts.map(alert => `
    <div class="alert-item ${alert.priority}">
      <div class="alert-content">
        <div class="alert-title">${alert.title}</div>
        <div class="alert-description">${alert.description || 'Sin detalles adicionales'}</div>
      </div>
      <div class="alert-badge ${alert.priority}">
        ${alert.priority === 'critical' ? 'CRÍTICO' : alert.priority === 'warning' ? 'AVISO' : 'INFO'}
      </div>
    </div>
  `).join('');
}

// Render Products Table
function renderProductsTable() {
  const tbody = document.getElementById('products-tbody');
  if (!tbody) return;
  
  tbody.innerHTML = appState.products.map(product => {
    const pendingProduct = editSession.products.get(product.id);
    const rowClasses = ['product-row'];
    if (pendingProduct) {
      rowClasses.push(pendingProduct.action === 'delete' ? 'pending-delete' : 'pending-edit');
    }
    // Check stock status
    let stockClass = '';
    
    if (product.stock_actual <= product.stockMin * 0.5) {
      stockClass = 'stock-critical';
    } else if (product.stock_actual <= product.stockMin) {
      stockClass = 'stock-warning';
    }
    
    // Check expiration status
    const daysUntilExpiration = getDaysUntilExpiration(product.caducidad);
    let expirationClass = '';
    
    if (daysUntilExpiration < 2) {
      expirationClass = 'expiration-critical';
    } else if (daysUntilExpiration >= 2 && daysUntilExpiration <= 7) {
      expirationClass = 'expiration-warning';
    }
    const expirationLabel = product.caducidad || 'Sin fecha';
    const expirationSuffix = Number.isFinite(daysUntilExpiration) && daysUntilExpiration < 8
      ? ` (${daysUntilExpiration}d)`
      : '';
    const actionButton = isEditMode
      ? `<button type="button" class="product-edit-btn" data-product-id="${product.id}">Editar</button>`
      : '';
    
    return `
      <tr class="${rowClasses.join(' ')}" data-product-id="${product.id}">
        <td>
          <strong>${product.sku}</strong>
          ${actionButton}
        </td>
        <td>${product.nombre}</td>
        <td><span class="${stockClass}"><strong>${product.stock_actual}</strong> uds</span></td>
        <td>${product.zona || product.ubicacion || 'Sin zona'}</td>
        <td><span class="${expirationClass}">${expirationLabel}${expirationSuffix}</span></td>
        <td>€${product.precio_unitario.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  updateProductsPriceTotal();
}

function updateProductsPriceTotal() {
  const totalElement = document.getElementById('products-price-total');
  if (!totalElement) return;
  const total = appState.products.reduce((sum, product) => {
    const price = Number(product.precio_unitario);
    return sum + (Number.isFinite(price) ? price : 0);
  }, 0);
  totalElement.textContent = `SUM(precio): €${total.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

// ===== Shared Re-render Helpers =====
function refreshInventoryWidgets({ includeLists = false } = {}) {
  renderProductsTable();
  renderAlerts();
  updateKPIs();
  updateWarehouseGauge();
  updateSpaceOccupancy();
  if (includeLists) {
    renderInvoices();
    renderTasks();
  }
}

// Calculate Warehouse Health Score
function calculateWarehouseHealth() {
  let healthScore = 100;
  
  // Factor 1: Alertas críticas y de advertencia (peso: 50%)
  const criticalAlerts = appState.alerts.filter(a => a.priority === 'critical').length;
  const warningAlerts = appState.alerts.filter(a => a.priority === 'warning').length;
  const totalProducts = appState.products.length;
  
  if (totalProducts > 0) {
    // Penalización por alertas críticas (hasta -30 puntos)
    const criticalPenalty = Math.min((criticalAlerts / totalProducts) * 100, 30);
    // Penalización por alertas de advertencia (hasta -20 puntos)
    const warningPenalty = Math.min((warningAlerts / totalProducts) * 50, 20);
    healthScore -= (criticalPenalty + warningPenalty);
  }
  
  // Factor 2: Eficiencia de ocupación (peso: 30%)
  const totalStock = appState.products.reduce((sum, p) => sum + p.stock_actual, 0);
  const capacity = toNumber(appState.warehouseConfig.capacity) || 1000;
  const occupancyRate = (totalStock / capacity) * 100;
  
  // Ocupación óptima entre 60-85%
  if (occupancyRate < 40) {
    healthScore -= 15; // Subutilización
  } else if (occupancyRate > 90) {
    healthScore -= 20; // Sobreocupación
  } else if (occupancyRate >= 60 && occupancyRate <= 85) {
    healthScore += 5; // Bonus por ocupación óptima
  }
  
  // Factor 3: Excesos de stock (peso: 20%)
  const excessProducts = appState.products.filter(p => p.stock_actual >= p.stockMax).length;
  if (totalProducts > 0) {
    const excessPenalty = Math.min((excessProducts / totalProducts) * 30, 15);
    healthScore -= excessPenalty;
  }
  
  // Asegurar que el score esté entre 0-100
  return Math.max(0, Math.min(100, Math.round(healthScore)));
}

// Update Warehouse Gauge
function updateWarehouseGauge() {
  const healthScore = calculateWarehouseHealth();
  const gaugePercentageElement = document.getElementById('gauge-percentage');
  const gaugeFill = document.getElementById('gauge-fill');
  const warehouseCard = document.getElementById('warehouse-status-card');
  
  if (gaugePercentageElement) {
    gaugePercentageElement.textContent = `${healthScore}%`;
  }
  
  if (gaugeFill) {
    // Calculate stroke-dashoffset for semi-circle (251.2 is circumference of half circle)
    const circumference = 251.2;
    const offset = circumference - (circumference * healthScore / 100);
    gaugeFill.style.strokeDashoffset = offset;
    
    // Determine color based on health score
    // 0-50%: Rojo (crítico)
    // 50-80%: Amarillo (advertencia)
    // 80-100%: Verde (saludable)
    let color, bgColor, shadowColor;
    
    if (healthScore < 50) {
      color = '#ef4444'; // Rojo
      bgColor = 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.08) 100%)';
      shadowColor = 'rgba(239, 68, 68, 0.25)';
    } else if (healthScore < 80) {
      color = '#f59e0b'; // Amarillo
      bgColor = 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.08) 100%)';
      shadowColor = 'rgba(245, 158, 11, 0.25)';
    } else {
      color = '#22c55e'; // Verde
      bgColor = 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.08) 100%)';
      shadowColor = 'rgba(34, 197, 94, 0.25)';
    }
    
    // Aplicar colores al gauge y al texto
    gaugeFill.style.stroke = color;
    gaugePercentageElement.style.fill = color; // Texto del mismo color que la barra
    
    // Cambiar color de fondo de la card completa para resaltar
    if (warehouseCard) {
      warehouseCard.style.background = bgColor;
      warehouseCard.style.borderColor = color;
      warehouseCard.style.borderWidth = '2px';
      warehouseCard.style.borderStyle = 'solid';
      warehouseCard.style.boxShadow = `0 4px 16px ${shadowColor}, 0 0 0 1px ${color}33`;
    }
  }
}

// Update Space Occupancy
function updateSpaceOccupancy() {
  // Prefer server-calculated volumetric occupancy if available
  const totals = appState.space?.totals || null;
  let capacity, occupied, available, percentage;
  if (totals) {
    capacity = Number(totals.capacity_m3) || 0;
    occupied = Number(totals.occupied_m3) || 0;
    available = Number(totals.available_m3) || Math.max(capacity - occupied, 0);
    percentage = Number(totals.pct_occupied) || (capacity > 0 ? (occupied / capacity) * 100 : 0);
  } else {
    // Fallback: old approximation by counting items vs capacity
    const totalStock = appState.products.reduce((sum, p) => sum + (Number(p.stock_actual) || 0), 0);
    capacity = toNumber(appState.warehouseConfig.capacity) || 1000;
    occupied = totalStock;
    available = Math.max(capacity - occupied, 0);
    percentage = capacity > 0 ? Math.min((occupied / capacity) * 100, 100) : 0;
  }
  
  const spaceBarFill = document.getElementById('space-bar-fill');
  const spaceBarLabel = document.getElementById('space-bar-label');
  const capacityTotal = document.getElementById('capacity-total');
  const capacityAvailable = document.getElementById('capacity-available');
  
  if (spaceBarFill) {
    spaceBarFill.style.width = `${Math.min(percentage, 100)}%`;
  }
  
  if (spaceBarLabel) {
    spaceBarLabel.textContent = `${occupied.toLocaleString('es-ES')} / ${capacity.toLocaleString('es-ES')} m³`;
  }
  
  if (capacityTotal) {
    capacityTotal.textContent = `${capacity.toLocaleString('es-ES')} m³`;
  }
  
  if (capacityAvailable) {
    capacityAvailable.textContent = `${available.toLocaleString('es-ES')} m³`;
  }
}

// Render Invoices
function renderInvoices() {
  const invoicesList = document.getElementById('invoices-list');
  if (!invoicesList) return;
  const statusLabels = {
    PENDING: 'Pendiente',
    OVERDUE: 'Vencida',
    PAID: 'Pagada'
  };
  
  if (!appState.invoices || appState.invoices.length === 0) {
    invoicesList.innerHTML = '<p style="color: var(--color-text-secondary); text-align: center; padding: 20px;">No hay facturas próximas</p>';
    return;
  }

  invoicesList.innerHTML = appState.invoices.map(invoice => {
    const today = new Date();
    const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
    const isValidDate = dueDate && !Number.isNaN(dueDate.getTime());
    const isOverdue = isValidDate ? dueDate < today : false;
    const dueDateFormatted = isValidDate
      ? dueDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Sin fecha definida';
    const invoiceId = invoice._uiId || String(invoice.id);
    const statusLabel = statusLabels[invoice.status] || invoice.status || 'Pendiente';
    const statusClass = (invoice.status || 'PENDING').toLowerCase();
    const isPending = editSession.invoices.has(invoiceId);
    const containerClasses = ['invoice-item'];
    if (isOverdue) containerClasses.push('overdue');
    if (isPending) containerClasses.push('pending-delete');
    
    return `
      <div class="${containerClasses.join(' ')}">
        <button type="button" class="item-delete-btn" data-type="invoice" data-id="${invoiceId}" aria-label="Eliminar factura" ${isPending ? 'disabled aria-hidden="true"' : ''}>X</button>
        <div class="invoice-header">
          <div class="invoice-id">${invoice.id}</div>
          <div class="invoice-amount">€${invoice.amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div class="invoice-status-badge ${statusClass}">${statusLabel}</div>
        <div class="invoice-vendor">${invoice.vendor}</div>
        <div class="invoice-due ${isOverdue ? 'overdue' : ''}">
          ${isOverdue ? '⚠️ Vencida: ' : 'Vencimiento: '} ${dueDateFormatted}
        </div>
      </div>
    `;
  }).join('');
}

// Render Tasks
function renderTasks() {
  const tasksList = document.getElementById('tasks-list');
  if (!tasksList) return;
  
  if (!appState.tasks || appState.tasks.length === 0) {
    tasksList.innerHTML = '<p style="color: var(--color-text-secondary); text-align: center; padding: 20px;">No hay tareas pendientes</p>';
    return;
  }

  tasksList.innerHTML = appState.tasks.map(task => {
    const taskId = task._uiId || String(task.id);
    const isPending = editSession.tasks.has(taskId);
    const classes = ['task-item', task.priority];
    if (isPending) classes.push('pending-delete');
    return `
      <div class="${classes.join(' ')}">
        <button type="button" class="item-delete-btn" data-type="task" data-id="${taskId}" aria-label="Eliminar tarea" ${isPending ? 'disabled aria-hidden="true"' : ''}>X</button>
        <div class="task-title">${task.title}</div>
        <div class="task-assignee">👤 Asignado: <strong>${task.assignedTo}</strong></div>
        <div class="task-contact">📞 Supervisor: ${task.supervisor} - <a href="tel:${task.phone}">${task.phone}</a></div>
      </div>
    `;
  }).join('');
}

// Initialize Voice Control
function initVoiceControl() {
  const voiceBtn = document.getElementById('voice-btn');
  
  if (!voiceBtn) return;
  // ===== Edit Mode Lifecycle =====
  // Check if speech recognition is supported
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    console.warn('Speech recognition not supported in this browser');
    voiceBtn.style.display = 'none';
    return;
  }
  
  const recognition = new SpeechRecognition();
  recognition.lang = 'es-ES';
  recognition.continuous = false;
  recognition.interimResults = false;
  
  let isListening = false;
  
  voiceBtn.addEventListener('click', () => {
    if (isListening) {
      recognition.stop();
      isListening = false;
      voiceBtn.classList.remove('listening');
    } else {
      recognition.start();
      isListening = true;
      voiceBtn.classList.add('listening');
    }
  });
  
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.toLowerCase();
    console.log('Voice command:', transcript);
    
    // Simple voice commands
    if (transcript.includes('stock') || transcript.includes('inventario')) {
      document.querySelector('.products-table')?.scrollIntoView({ behavior: 'smooth' });
    } else if (transcript.includes('alerta') || transcript.includes('avisos')) {
      document.querySelector('.alerts-panel')?.scrollIntoView({ behavior: 'smooth' });
    } else if (transcript.includes('factura') || transcript.includes('pagos')) {
      document.querySelector('.invoices')?.scrollIntoView({ behavior: 'smooth' });
    } else if (transcript.includes('tarea') || transcript.includes('tareas')) {
      document.querySelector('.tasks')?.scrollIntoView({ behavior: 'smooth' });
    }
    
    isListening = false;
    voiceBtn.classList.remove('listening');
  };
  
  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    isListening = false;
    voiceBtn.classList.remove('listening');
  };
  
  recognition.onend = () => {
    isListening = false;
    voiceBtn.classList.remove('listening');
  };
}

// ===== OCR Upload Integration =====
const OCR_API_BASE = (document.querySelector('meta[name="ocr-api-base"]')?.content || 'http://localhost:8000').replace(/\/$/, '');

function initOCRUpload() {
  const btn = document.getElementById('ocr-upload-btn');
  const input = document.getElementById('ocr-file-input');
  if (!btn || !input) return;

  btn.addEventListener('click', () => {
    input.click();
  });

  input.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      setOCRButtonLoading(true);
      await processOCRFile(file);
    } catch (err) {
      console.error('OCR error:', err);
      appState.errorMessage = (err && err.message) || 'No se pudo procesar el albarán.';
      renderErrorBanner();
    } finally {
      setOCRButtonLoading(false);
      input.value = '';
    }
  });
}

function setOCRButtonLoading(isLoading) {
  const btn = document.getElementById('ocr-upload-btn');
  if (!btn) return;
  btn.disabled = isLoading;
  btn.textContent = isLoading ? 'Procesando…' : 'OCR Albarán';
}

async function processOCRFile(file) {
  const baseOrigin = window.location.origin.replace(/\/$/, '');
  const normalizedOcrBase = OCR_API_BASE.replace(/\/$/, '');

  const endpointsToTry = [
    '/api/invoices/process',
    `${baseOrigin}/api/invoices/process`,
    `${normalizedOcrBase}/api/extract-albaran`,
    `${normalizedOcrBase.replace('localhost', '127.0.0.1')}/api/extract-albaran`,
    `${normalizedOcrBase.replace('127.0.0.1', 'localhost')}/api/extract-albaran`,
  ].filter(Boolean).filter((value, index, self) => self.indexOf(value) === index);

  let lastError = null;
  for (const url of endpointsToTry) {
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(url, { method: 'POST', body: form });
      let data;
      try {
        data = await res.json();
      } catch (parseError) {
        if (!res.ok) {
          throw new Error(`Error procesando archivo (${res.status})`);
        }
        throw new Error('Respuesta no válida del servicio OCR');
      }
      if (!res.ok) {
        if (data && data.savedJson) {
          handleOCRSuccess(data);
          return;
        }
        const detail = data?.detail || data?.error || data?.message || 'Error procesando albarán';
        throw new Error(detail);
      }
      handleOCRSuccess(data);
      return;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error('No se pudo conectar con el servicio OCR');
}

function handleOCRSuccess(response) {
  if (response?.invoice || response?.savedJson) {
    handleInvoiceExtractionResult(response);
    return;
  }

  const productos = Array.isArray(response?.data?.productos) ? response.data.productos : [];
  const count = productos.length;
  const msg = response?.message || `Albarán procesado. ${count} producto(s) extraído(s).`;
  pendingOcrReview = {
    snapshot: response?.snapshot || null,
    productos,
    albaran: {
      numero_albaran: response?.data?.numero_albaran || null,
      fecha: response?.data?.fecha || null,
      proveedor: response?.data?.proveedor || null,
      destinatario: response?.data?.destinatario || null
    },
    confidence: response?.ocr_confidence || 0
  };
  openOcrReviewModal(pendingOcrReview);
  const reviewCta = pendingOcrReview?.snapshot
    ? '<button type="button" class="alert-inline-btn" data-action="open-ocr-review">Revisar importación</button>'
    : '';
  appState.alerts = [
    {
      id: `ocr-${Date.now()}`,
      title: '🧾 Resultado OCR',
      description: `${msg} Confianza OCR: ${Math.round((response?.ocr_confidence || 0)*100)}% ${reviewCta}`,
      priority: 'info',
      type: 'info'
    },
    ...appState.alerts
  ];
  renderAlerts();
  console.log('OCR structured data:', response);
}

function handleInvoiceExtractionResult(result) {
  pendingOcrReview = null;
  const invoice = result?.invoice || {};
  const savedPath = result?.savedJson ? result.savedJson.replace(/^\.\//, '') : null;
  const infoPieces = [
    invoice.numero_factura ? `Factura ${invoice.numero_factura}` : null,
    invoice.fecha ? `Fecha ${invoice.fecha}` : null,
    invoice.proveedor ? `Proveedor ${invoice.proveedor}` : null,
    invoice.total ? `Total ${invoice.total}` : null
  ].filter(Boolean);
  const description = [
    infoPieces.join(' • ') || 'Datos extraídos correctamente.',
    savedPath ? `JSON guardado en ${savedPath}` : null
  ].filter(Boolean).join(' | ');

  const severity = result.success ? 'info' : 'warning';

  appState.alerts = [
    {
      id: `invoice-${Date.now()}`,
      title: '🧾 Factura procesada',
      description,
      priority: severity,
      type: severity
    },
    ...appState.alerts
  ];
  renderAlerts();

  if (!result.success) {
    appState.errorMessage = result.error || 'No se pudo interpretar la factura.';
  } else {
    appState.errorMessage = '';
  }
  renderErrorBanner();

  console.log('Invoice extraction result:', result);
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function renderErrorBanner() {
  const banner = document.getElementById('app-error-banner');
  if (!banner) return;
  const message = appState.errorMessage || offlineBannerMessage;
  if (message) {
    banner.textContent = message;
    banner.style.display = 'block';
  } else {
    banner.textContent = '';
    banner.style.display = 'none';
  }
}

function initEditModeToggle() {
  const toggleButton = document.getElementById('edit-mode-toggle');
  if (!toggleButton) return;

  editModeButton = toggleButton;
  editModeButtonDefaultLabel = toggleButton.textContent.trim() || 'Editar';
  toggleButton.dataset.defaultLabel = editModeButtonDefaultLabel;

  toggleButton.addEventListener('click', () => {
    if (isEditMode) {
      requestExitEditMode();
    } else {
      enterEditMode();
    }
  });

  updateEditModeButtonState();
  document.body.classList.toggle('is-edit-mode', isEditMode);
}

function initDeletionHandlers() {
  if (deleteHandlersInitialized) return;
  document.addEventListener('click', handleDeleteButtonClick);
  deleteHandlersInitialized = true;
}

function initProductRowEditing() {
  if (productEditHandlersInitialized) return;
  document.addEventListener('click', (event) => {
    const editBtn = event.target.closest('.product-edit-btn');
    if (!editBtn) return;
    if (!isEditMode) return;
    const productId = editBtn.dataset.productId;
    if (!productId) return;
    openProductEditor(productId);
  });
  productEditHandlersInitialized = true;
}

function handleDeleteButtonClick(event) {
  const deleteButton = event.target.closest('.item-delete-btn');
  if (!deleteButton || !isEditMode) return;

  const targetType = deleteButton.dataset.type;
  const targetId = deleteButton.dataset.id;
  if (!targetType || !targetId) return;

  if (isItemPendingDeletion(targetType, targetId)) {
    return;
  }

  stageItemForDeletion(targetType, targetId);

  deleteButton.blur();
}

function stageItemForDeletion(type, targetId) {
  const collection = type === 'invoice' ? appState.invoices : appState.tasks;
  const pendingMap = type === 'invoice' ? editSession.invoices : editSession.tasks;
  if (!Array.isArray(collection)) return;
  const target = collection.find(item => (item._uiId || String(item.id)) === targetId);
  if (!target) return;
  pendingMap.set(targetId, { ...target });
  if (type === 'invoice') {
    renderInvoices();
  } else {
    renderTasks();
  }
}

function isItemPendingDeletion(type, targetId) {
  const pendingMap = type === 'invoice' ? editSession.invoices : editSession.tasks;
  return pendingMap.has(targetId);
}

function hasPendingChanges() {
  return editSession.invoices.size > 0 || editSession.tasks.size > 0 || editSession.products.size > 0;
}

function createEditSnapshot() {
  editSession.snapshot = {
    products: deepClone(appState.products),
    invoices: deepClone(appState.invoices),
    tasks: deepClone(appState.tasks)
  };
  editSession.invoices.clear();
  editSession.tasks.clear();
  editSession.products.clear();
}

function restoreSnapshotFromEditSession() {
  if (!editSession.snapshot) return;
  appState.products = deepClone(editSession.snapshot.products || []);
  appState.invoices = deepClone(editSession.snapshot.invoices || []);
  appState.tasks = deepClone(editSession.snapshot.tasks || []);
}

function clearEditSession() {
  editSession.snapshot = null;
  editSession.invoices.clear();
  editSession.tasks.clear();
  editSession.products.clear();
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function enterEditMode() {
  if (isEditMode) return;
  createEditSnapshot();
  isEditMode = true;
  document.body.classList.add('is-edit-mode');
  updateEditModeButtonState();
  renderProductsTable();
}

function requestExitEditMode() {
  if (!isEditMode) return;
  if (hasPendingChanges()) {
    openConfirmModal();
    return;
  }
  finalizeExitEditMode();
}

function finalizeExitEditMode({ restoreSnapshot = false } = {}) {
  if (!isEditMode) return;
  if (restoreSnapshot) {
    restoreSnapshotFromEditSession();
  }
  clearEditSession();
  isEditMode = false;
  document.body.classList.remove('is-edit-mode');
  updateEditModeButtonState();
  refreshInventoryWidgets({ includeLists: true });
}

function updateEditModeButtonState() {
  if (!editModeButton) return;
  const label = isEditMode ? 'Listo' : (editModeButtonDefaultLabel || 'Editar');
  editModeButton.textContent = label;
  editModeButton.setAttribute('aria-pressed', String(isEditMode));
  editModeButton.setAttribute('aria-label', isEditMode ? 'Desactivar modo edición' : 'Activar modo edición');
  editModeButton.title = isEditMode ? 'Salir del modo edición' : 'Activar modo edición';
  editModeButton.classList.toggle('active', isEditMode);
}

// ===== Confirm Modal Handling =====
function initConfirmModal() {
  const root = document.getElementById('edit-confirm-modal');
  if (!root) return;
  confirmModalElements.root = root;
  confirmModalElements.summary = document.getElementById('edit-confirm-summary');
  confirmModalElements.invoicesSection = document.getElementById('modal-invoices-section');
  confirmModalElements.invoicesList = document.getElementById('modal-invoices-list');
  confirmModalElements.tasksSection = document.getElementById('modal-tasks-section');
  confirmModalElements.tasksList = document.getElementById('modal-tasks-list');
  confirmModalElements.productsSection = document.getElementById('modal-products-section');
  confirmModalElements.productsList = document.getElementById('modal-products-list');
  confirmModalElements.cancelBtn = document.getElementById('modal-cancel-btn');
  confirmModalElements.confirmBtn = document.getElementById('modal-confirm-btn');

  confirmModalElements.cancelBtn?.addEventListener('click', handleModalCancel);
  confirmModalElements.confirmBtn?.addEventListener('click', handleModalConfirm);
  root.addEventListener('click', (event) => {
    if (event.target.dataset.modalClose === 'true' && !isApplyingPendingChanges) {
      handleModalCancel();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && confirmModalElements.root?.classList.contains('is-open') && !isApplyingPendingChanges) {
      handleModalCancel();
    }
  });
}

function openConfirmModal() {
  if (!confirmModalElements.root) return;
  populateModalLists();
  confirmModalElements.root.classList.add('is-open');
  confirmModalElements.root.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  setModalLoadingState(false);
  confirmModalElements.confirmBtn?.focus();
}

function closeConfirmModal() {
  if (!confirmModalElements.root) return;
  confirmModalElements.root.classList.remove('is-open');
  confirmModalElements.root.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

function populateModalLists() {
  if (!confirmModalElements.summary) return;
  const pendingInvoices = Array.from(editSession.invoices.values());
  const pendingTasks = Array.from(editSession.tasks.values());
  const pendingProducts = Array.from(editSession.products.entries());
  const total = pendingInvoices.length + pendingTasks.length + pendingProducts.length;
  confirmModalElements.summary.textContent = total === 1
    ? 'Se detectó 1 cambio pendiente.'
    : `Se detectaron ${total} cambios pendientes.`;

  if (confirmModalElements.invoicesSection) {
    confirmModalElements.invoicesSection.hidden = pendingInvoices.length === 0;
  }
  if (confirmModalElements.tasksSection) {
    confirmModalElements.tasksSection.hidden = pendingTasks.length === 0;
  }
  if (confirmModalElements.productsSection) {
    confirmModalElements.productsSection.hidden = pendingProducts.length === 0;
  }

  if (confirmModalElements.invoicesList) {
    confirmModalElements.invoicesList.innerHTML = pendingInvoices.map(invoice => `
      <li>
        <span>${invoice.id || invoice.invoiceNumber || 'Factura'}</span>
        <small>${invoice.vendor || invoice.supplierName || ''}</small>
      </li>
    `).join('');
  }

  if (confirmModalElements.tasksList) {
    confirmModalElements.tasksList.innerHTML = pendingTasks.map(task => `
      <li>
        <span>${task.title}</span>
        <small>${task.assignedTo || 'Sin asignar'}</small>
      </li>
    `).join('');
  }

  if (confirmModalElements.productsList) {
    confirmModalElements.productsList.innerHTML = pendingProducts.map(([productId, change]) => {
      const label = change.action === 'delete' ? 'Eliminar' : 'Editar';
      return `
        <li data-product-id="${productId}">
          <span>[${label}] ${change.sku || ''}</span>
          <small>${change.nombre || 'Producto'}</small>
        </li>
      `;
    }).join('');
  }
}

function handleModalCancel() {
  closeConfirmModal();
  finalizeExitEditMode({ restoreSnapshot: true });
}

async function handleModalConfirm() {
  if (isApplyingPendingChanges) return;
  try {
    isApplyingPendingChanges = true;
    setModalLoadingState(true);
    const productResults = await applyPendingChangesToServer();
    removePendingItemsFromState(productResults);
    closeConfirmModal();
    finalizeExitEditMode();
    appState.errorMessage = '';
    renderErrorBanner();
  } catch (error) {
    console.error('Error applying pending changes:', error);
    appState.errorMessage = 'No se pudieron aplicar los cambios. Intenta nuevamente.';
    renderErrorBanner();
  } finally {
    isApplyingPendingChanges = false;
    setModalLoadingState(false);
  }
}

// ===== Pending Change Application =====
async function applyPendingChangesToServer() {
  if (!navigator.onLine) {
    const productResults = buildLocalProductResultsFromEdits();
    enqueuePendingChangesFromSession();
    return productResults;
  }

  try {
    const invoiceRequests = Array.from(editSession.invoices.values())
      .filter(invoice => invoice.id && invoice.id !== 'N/A')
      .map(invoice => deleteInvoiceById(invoice.id));
    const taskRequests = Array.from(editSession.tasks.values())
      .filter(task => task.id)
      .map(task => deleteTaskById(task.id));
    const productResults = { updated: [], deleted: [] };
    const productRequests = [];
    editSession.products.forEach((change, productId) => {
      if (change.action === 'delete') {
        productRequests.push(
          deleteProductById(productId).then(() => {
            productResults.deleted.push(productId);
          })
        );
        return;
      }

      if (change.action === 'update') {
        productRequests.push(
          applyProductUpdate(productId, change).then((product) => {
            if (product) {
              productResults.updated.push(product);
            }
          })
        );
      }
    });

    await Promise.all([...invoiceRequests, ...taskRequests, ...productRequests]);
    return productResults;
  } catch (error) {
    if (shouldEnqueueOffline(error)) {
      const productResults = buildLocalProductResultsFromEdits();
      enqueuePendingChangesFromSession();
      return productResults;
    }
    throw error;
  }
}

// ===== API Helper Requests =====
async function deleteInvoiceById(invoiceId) {
  const response = await fetch(`/api/invoices/${invoiceId}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error('Error al eliminar la factura');
  }
}

async function deleteTaskById(taskId) {
  const response = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error('Error al eliminar la tarea');
  }
}

async function updateProductDetails(productId, payload) {
  const response = await fetch(`/api/products/${productId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    let message = 'Error al actualizar el producto';
    try {
      const error = await response.json();
      if (error?.error) {
        message = error.error;
      }
    } catch (err) {
      // ignore
    }
    throw new Error(message);
  }
  return response.json();
}

async function updateProductStock(productId, targetStock, baseStock = 0) {
  const startingStock = Number.isFinite(Number(baseStock)) ? Number(baseStock) : 0;
  const difference = Number(targetStock) - startingStock;
  if (!Number.isFinite(difference) || difference === 0) {
    return null;
  }

  const payload = {
    cantidad: Math.abs(difference),
    tipo: difference > 0 ? 'entrada' : 'salida',
    motivo: 'Ajuste manual desde el panel'
  };

  const response = await fetch(`/api/products/${productId}/stock`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let message = 'Error al actualizar el stock del producto';
    try {
      const error = await response.json();
      if (error?.error) {
        message = error.error;
      }
    } catch (err) {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
}

async function applyProductUpdate(productId, change) {
  let latestProduct = null;

  if (change.payload) {
    latestProduct = await updateProductDetails(productId, change.payload);
  }

  if (typeof change.stockTarget === 'number') {
    const stockResult = await updateProductStock(productId, change.stockTarget, change.baseStock);
    if (stockResult) {
      latestProduct = stockResult;
    }
  }

  return latestProduct;
}

async function deleteProductById(productId) {
  const response = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
  if (!response.ok) {
    let message = 'Error al eliminar el producto';
    try {
      const error = await response.json();
      if (error?.error) {
        message = error.error;
      }
    } catch (err) {
      // ignore
    }
    throw new Error(message);
  }
}

function removePendingItemsFromState(productResults = { updated: [], deleted: [] }) {
  if (editSession.invoices.size) {
    const invoiceIds = new Set(editSession.invoices.keys());
    appState.invoices = appState.invoices.filter(invoice => !invoiceIds.has(invoice._uiId || String(invoice.id)));
  }
  if (editSession.tasks.size) {
    const taskIds = new Set(editSession.tasks.keys());
    appState.tasks = appState.tasks.filter(task => !taskIds.has(task._uiId || String(task.id)));
  }
  if (productResults?.deleted?.length) {
    const deletedSet = new Set(productResults.deleted);
    appState.products = appState.products.filter(product => !deletedSet.has(product.id));
  }
  if (productResults?.updated?.length) {
    const updatedMap = new Map(productResults.updated.map(product => [product.id, normalizeProduct(product)]));
    appState.products = appState.products.map(product => updatedMap.get(product.id) || product);
  }
  refreshInventoryWidgets({ includeLists: true });
  persistAppStateSnapshot();
}

function setModalLoadingState(isLoading) {
  if (!confirmModalElements.confirmBtn || !confirmModalElements.cancelBtn) return;
  confirmModalElements.confirmBtn.disabled = isLoading;
  confirmModalElements.cancelBtn.disabled = isLoading;
  confirmModalElements.confirmBtn.textContent = isLoading ? 'Aplicando...' : 'Aplicar cambios';
}

// ===== Product Editor Modal =====
function initProductEditor() {
  if (productEditorState.initialized) return;
  const modal = document.getElementById('product-editor-modal');
  if (!modal) return;
  productEditorState.modal = modal;
  productEditorState.form = document.getElementById('product-editor-form');
  productEditorState.errors = document.getElementById('product-editor-errors');
  productEditorState.deleteBtn = document.getElementById('product-editor-delete-btn');
  productEditorState.cancelBtn = document.getElementById('product-editor-cancel-btn');
  productEditorState.saveBtn = document.getElementById('product-editor-save-btn');

  productEditorState.form?.addEventListener('submit', handleProductFormSubmit);
  productEditorState.cancelBtn?.addEventListener('click', closeProductEditor);
  productEditorState.deleteBtn?.addEventListener('click', handleProductDeleteClick);
  modal.addEventListener('click', (event) => {
    if (event.target.dataset.productEditorClose === 'true') {
      closeProductEditor();
    }
  });
  productEditorState.initialized = true;
}

function openProductEditor(productId) {
  if (!productEditorState.modal) return;
  if (!isEditMode) return;
  const product = getProductById(productId);
  if (!product) return;
  productEditorState.productId = productId;
  productEditorState.originalProduct = { ...product };
  populateProductEditorForm(product);
  setProductEditorErrors();
  productEditorState.modal.classList.add('is-open');
  productEditorState.modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  productEditorState.form?.elements?.nombre?.focus();
}

function closeProductEditor() {
  if (!productEditorState.modal) return;
  productEditorState.modal.classList.remove('is-open');
  productEditorState.modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  productEditorState.productId = null;
  productEditorState.originalProduct = null;
  productEditorState.form?.reset();
  setProductEditorErrors();
}

function populateProductEditorForm(product) {
  if (!productEditorState.form) return;
  const form = productEditorState.form;
  if (form.nombre) {
    form.nombre.value = product.nombre || '';
  }
  if (form.sku) {
    form.sku.value = product.sku || '';
  }
  if (form.stock_actual) {
    const stockValue = Number.isFinite(product.stock_actual) ? product.stock_actual : 0;
    form.stock_actual.value = String(stockValue);
  }
  if (form.zona) {
    form.zona.value = product.zona || '';
  }
  if (form.caducidad) {
    form.caducidad.value = product.caducidad || '';
  }
  if (form.precio_unitario) {
    form.precio_unitario.value = Number.isFinite(product.precio_unitario)
      ? product.precio_unitario
      : '';
  }
}

function setProductEditorErrors(messages = []) {
  if (!productEditorState.errors) return;
  if (!messages.length) {
    productEditorState.errors.innerHTML = '';
    productEditorState.errors.hidden = true;
    return;
  }
  productEditorState.errors.hidden = false;
  productEditorState.errors.innerHTML = `
    <ul>
      ${messages.map(message => `<li>${message}</li>`).join('')}
    </ul>
  `;
}

function handleProductFormSubmit(event) {
  event.preventDefault();
  if (!productEditorState.form || !productEditorState.productId) return;
  const product = getProductById(productEditorState.productId);
  if (!product) return;
  const values = collectProductFormValues(productEditorState.form);
  const validation = validateProductForm(values, product);
  if (validation.errors?.length) {
    setProductEditorErrors(validation.errors);
    return;
  }
  setProductEditorErrors();
  stageProductUpdate(
    productEditorState.productId,
    validation.payload,
    validation.preview,
    validation.stockTarget
  );
  closeProductEditor();
}

function handleProductDeleteClick(event) {
  event.preventDefault();
  if (!productEditorState.productId) return;
  const product = getProductById(productEditorState.productId);
  if (!product) return;

  editSession.products.set(productEditorState.productId, {
    action: 'delete',
    sku: product.sku,
    nombre: product.nombre
  });

  setProductEditorErrors();
  closeProductEditor();
  renderProductsTable();
}

function collectProductFormValues(form) {
  const data = new FormData(form);
  return {
    nombre: data.get('nombre')?.toString().trim() || '',
    sku: data.get('sku')?.toString().trim() || '',
    stock_actual: data.get('stock_actual')?.toString().trim() || '',
    zona: data.get('zona')?.toString().trim() || '',
    caducidad: data.get('caducidad')?.toString().trim() || '',
    precio_unitario: data.get('precio_unitario')?.toString().trim() || ''
  };
}

function validateProductForm(values, product) {
  const errors = [];
  const payload = {};
  const preview = {};
  let stockTarget = null;

  const requiredStrings = [
    ['nombre', 'name', 'Nombre'],
    ['sku', 'sku', 'SKU']
  ];

  requiredStrings.forEach(([field, apiField, label]) => {
    const value = values[field];
    if (!value) {
      errors.push(`${label} es obligatorio.`);
      return;
    }
    if (value !== product[field]) {
      payload[apiField] = value;
      preview[field] = value;
    }
  });

  const optionalStrings = [
    ['zona', 'zone', 'zona']
  ];

  optionalStrings.forEach(([field, apiField, stateField]) => {
    const value = values[field];
    const baseValue = product[stateField] || '';
    if (!value && !baseValue) {
      return;
    }
    if (!value && baseValue) {
      payload[apiField] = null;
      preview[stateField] = '';
      return;
    }
    if (value !== baseValue) {
      payload[apiField] = value;
      preview[stateField] = value;
    }
  });

  const stockRaw = values.stock_actual;
  if (stockRaw === '') {
    errors.push('El stock actual es obligatorio.');
  } else {
    const parsedStock = Number(stockRaw);
    if (!Number.isFinite(parsedStock) || parsedStock < 0) {
      errors.push('El stock actual debe ser un número positivo.');
    } else {
      const normalizedStock = Math.floor(parsedStock);
      if (normalizedStock !== product.stock_actual) {
        preview.stock_actual = normalizedStock;
        stockTarget = normalizedStock;
      }
    }
  }

  const expirationRaw = values.caducidad;
  const productExpiration = product.caducidad || '';
  if (!expirationRaw && productExpiration) {
    payload.expirationDate = null;
    preview.caducidad = '';
  } else if (expirationRaw && expirationRaw !== productExpiration) {
    const parsedExpiration = new Date(expirationRaw);
    if (Number.isNaN(parsedExpiration.getTime())) {
      errors.push('La fecha de caducidad no es válida.');
    } else {
      payload.expirationDate = expirationRaw;
      preview.caducidad = expirationRaw;
    }
  }

  const priceRaw = values.precio_unitario;
  if (priceRaw === '') {
    errors.push('El precio unitario es obligatorio.');
  } else {
    const parsedPrice = Number(priceRaw);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      errors.push('El precio unitario debe ser un número positivo.');
    } else {
      const normalizedPrice = Number(parsedPrice.toFixed(2));
      if (normalizedPrice !== Number(product.precio_unitario)) {
        payload.unitPrice = normalizedPrice;
        preview.precio_unitario = normalizedPrice;
      }
    }
  }

  const hasPayloadChanges = Object.keys(payload).length > 0;
  const hasStockChange = typeof stockTarget === 'number';

  if (!hasPayloadChanges && !hasStockChange) {
    errors.push('No se detectaron cambios en el producto.');
  }

  if (errors.length) {
    return { errors };
  }

  return { payload, preview, stockTarget };
}

function stageProductUpdate(productId, payload = {}, preview = {}, stockTarget = null) {
  const productIndex = appState.products.findIndex(product => String(product.id) === String(productId));
  if (productIndex === -1) {
    return;
  }

  const currentProduct = appState.products[productIndex];
  const existingChange = editSession.products.get(productId) || {};
  const snapshotProduct = editSession.snapshot?.products?.find(product => String(product.id) === String(productId));
  const baseStock = existingChange.baseStock ?? snapshotProduct?.stock_actual ?? currentProduct.stock_actual ?? 0;

  const mergedPayload = { ...(existingChange.payload || {}) };
  Object.entries(payload || {}).forEach(([field, value]) => {
    if (value === undefined) {
      return;
    }
    mergedPayload[field] = value;
  });

  const mergedPreview = { ...(existingChange.preview || {}) };
  Object.entries(preview || {}).forEach(([field, value]) => {
    mergedPreview[field] = value;
  });

  const nextProductState = { ...currentProduct };
  Object.entries(mergedPreview).forEach(([field, value]) => {
    nextProductState[field] = value;
  });

  const nextStockTarget = typeof stockTarget === 'number'
    ? stockTarget
    : (typeof existingChange.stockTarget === 'number' ? existingChange.stockTarget : null);

  appState.products[productIndex] = nextProductState;
  editSession.products.set(productId, {
    action: 'update',
    payload: Object.keys(mergedPayload).length ? mergedPayload : null,
    preview: mergedPreview,
    stockTarget: nextStockTarget,
    baseStock,
    sku: nextProductState.sku,
    nombre: nextProductState.nombre
  });
  refreshInventoryWidgets();
}

// ===== OCR Review Modal =====
function initOcrReviewModal() {
  if (ocrReviewUi.root) return;
  const root = document.getElementById('ocr-review-modal');
  if (!root) return;
  ocrReviewUi.root = root;
  ocrReviewUi.summary = document.getElementById('ocr-review-summary');
  ocrReviewUi.fileName = document.getElementById('ocr-review-file');
  ocrReviewUi.supplier = document.getElementById('ocr-review-supplier');
  ocrReviewUi.destination = document.getElementById('ocr-review-destination');
  ocrReviewUi.albaranNumber = document.getElementById('ocr-review-number');
  ocrReviewUi.albaranDate = document.getElementById('ocr-review-date');
  ocrReviewUi.confidence = document.getElementById('ocr-review-confidence');
  ocrReviewUi.products = document.getElementById('ocr-review-products');
  ocrReviewUi.hint = document.getElementById('ocr-review-hint');
  ocrReviewUi.errors = document.getElementById('ocr-review-errors');
  ocrReviewUi.approveBtn = document.getElementById('ocr-review-approve-btn');
  ocrReviewUi.cancelBtn = document.getElementById('ocr-review-cancel-btn');

  ocrReviewUi.cancelBtn?.addEventListener('click', handleOcrReviewCancel);
  ocrReviewUi.approveBtn?.addEventListener('click', handleOcrReviewApprove);

  root.addEventListener('click', (event) => {
    if (event.target.dataset.ocrModalClose === 'true' && !isOcrReviewSubmitting) {
      handleOcrReviewCancel();
    }
  });

  root.addEventListener('change', (event) => {
    const checkbox = event.target.closest('input[data-ocr-product-index]');
    if (!checkbox || checkbox.disabled) return;
    const index = Number(checkbox.dataset.ocrProductIndex);
    if (Number.isNaN(index)) return;
    if (checkbox.checked) {
      ocrReviewSelection.add(index);
    } else {
      ocrReviewSelection.delete(index);
    }
    updateOcrReviewHint();
    updateOcrReviewActionState();
  });
}

function initOcrReviewActionHandlers() {
  document.addEventListener('click', (event) => {
    const reviewBtn = event.target.closest('[data-action="open-ocr-review"]');
    if (!reviewBtn) return;
    event.preventDefault();
    if (pendingOcrReview) {
      openOcrReviewModal(pendingOcrReview);
    }
  });
}

function openOcrReviewModal(reviewData = pendingOcrReview) {
  if (!ocrReviewUi.root) {
    initOcrReviewModal();
  }
  if (!ocrReviewUi.root || !reviewData) return;
  pendingOcrReview = reviewData;
  ocrReviewSelection.clear();
  reviewData.productos.slice(0, 2).forEach((_, index) => {
    ocrReviewSelection.add(index);
  });
  populateOcrReviewModal();
  setOcrReviewError('');
  isOcrReviewSubmitting = false;
  updateOcrReviewActionState();
  ocrReviewUi.root.classList.add('is-open');
  ocrReviewUi.root.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

function closeOcrReviewModal({ clearPending = false } = {}) {
  if (!ocrReviewUi.root) return;
  ocrReviewUi.root.classList.remove('is-open');
  ocrReviewUi.root.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  if (clearPending) {
    pendingOcrReview = null;
  }
}

function populateOcrReviewModal() {
  if (!pendingOcrReview) return;
  const { snapshot, albaran, productos, confidence = 0 } = pendingOcrReview;
  if (ocrReviewUi.summary) {
    const createdAt = snapshot?.created_at ? new Date(snapshot.created_at) : null;
    const formatted = createdAt && !Number.isNaN(createdAt.getTime())
      ? createdAt.toLocaleString('es-ES')
      : 'Fecha no disponible';
    ocrReviewUi.summary.textContent = `${productos.length} producto(s) detectados · ${formatted}`;
  }
  if (ocrReviewUi.fileName) {
    ocrReviewUi.fileName.textContent = snapshot?.source_file || 'Archivo no especificado';
  }
  if (ocrReviewUi.supplier) {
    ocrReviewUi.supplier.textContent = albaran?.proveedor || 'Proveedor no indicado';
  }
  if (ocrReviewUi.destination) {
    ocrReviewUi.destination.textContent = albaran?.destinatario || 'Destinatario no indicado';
  }
  if (ocrReviewUi.albaranNumber) {
    ocrReviewUi.albaranNumber.textContent = albaran?.numero_albaran || '—';
  }
  if (ocrReviewUi.albaranDate) {
    ocrReviewUi.albaranDate.textContent = albaran?.fecha || '—';
  }
  if (ocrReviewUi.confidence) {
    const pct = Math.round((confidence || 0) * 100);
    ocrReviewUi.confidence.textContent = `${pct}%`;
  }
  renderOcrReviewProducts(productos);
  updateOcrReviewHint();
}

function renderOcrReviewProducts(products = []) {
  if (!ocrReviewUi.products) return;
  if (!Array.isArray(products) || products.length === 0) {
    ocrReviewUi.products.innerHTML = '<p class="ocr-review-empty">No se detectaron productos para revisar.</p>';
    return;
  }
  ocrReviewUi.products.innerHTML = products.map((product, index) => {
    const isChecked = ocrReviewSelection.has(index);
    const descripcion = product.descripcion || `Producto ${index + 1}`;
    const cantidad = product.cantidad ?? 'N/D';
    const unidad = product.unidad || '';
    const codigo = product.codigo || 'Sin código';
    const lote = product.lote || 'Sin lote';
    const caducidad = product.caducidad || 'Sin caducidad';
    return `
      <label class="ocr-review-product">
        <input type="checkbox" data-ocr-product-index="${index}" ${isChecked ? 'checked' : ''}>
        <div class="ocr-review-product__body">
          <div class="ocr-review-product__title">
            <strong>${descripcion}</strong>
            <span>SKU: ${codigo}</span>
          </div>
          <div class="ocr-review-product__meta">
            <span>Cantidad: ${cantidad} ${unidad}</span>
            <span>Lote: ${lote}</span>
            <span>Caducidad: ${caducidad}</span>
          </div>
        </div>
      </label>
    `;
  }).join('');
}

function updateOcrReviewHint() {
  if (!ocrReviewUi.hint) return;
  const selected = ocrReviewSelection.size;
  if (selected >= 2) {
    ocrReviewUi.hint.textContent = `${selected} producto(s) confirmados. Se importarán todos los detectados después de tu aprobación.`;
    ocrReviewUi.hint.classList.remove('is-error');
  } else {
    const remaining = 2 - selected;
    ocrReviewUi.hint.textContent = `Selecciona ${remaining} producto(s) más para confirmar la importación.`;
    ocrReviewUi.hint.classList.add('is-error');
  }
}

function setOcrReviewError(message) {
  if (!ocrReviewUi.errors) return;
  if (message) {
    ocrReviewUi.errors.textContent = message;
    ocrReviewUi.errors.hidden = false;
  } else {
    ocrReviewUi.errors.textContent = '';
    ocrReviewUi.errors.hidden = true;
  }
}

function updateOcrReviewActionState() {
  if (!ocrReviewUi.approveBtn) return;
  const disable = isOcrReviewSubmitting || ocrReviewSelection.size < 2;
  ocrReviewUi.approveBtn.disabled = disable;
  ocrReviewUi.approveBtn.textContent = isOcrReviewSubmitting ? 'Importando…' : 'Importar productos';
}

function handleOcrReviewCancel() {
  if (isOcrReviewSubmitting) return;
  closeOcrReviewModal();
}

async function handleOcrReviewApprove() {
  if (!pendingOcrReview) return;
  if (ocrReviewSelection.size < 2) {
    setOcrReviewError('Selecciona al menos 2 productos para continuar.');
    return;
  }
  if (!navigator.onLine) {
    setOcrReviewError('Sin conexión. Reintenta cuando vuelvas a estar en línea.');
    return;
  }
  setOcrReviewError('');
  isOcrReviewSubmitting = true;
  updateOcrReviewActionState();

  try {
    const totalProductos = pendingOcrReview.productos?.length || 0;
    const payload = {
      snapshotId: pendingOcrReview.snapshot?.id || null,
      productos: pendingOcrReview.productos,
      metadata: pendingOcrReview.albaran,
      confirmedIndices: Array.from(ocrReviewSelection)
    };
    const response = await fetch(OCR_IMPORT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      let detail = 'No se pudo importar los productos.';
      try {
        const errorBody = await response.json();
        detail = errorBody?.error || errorBody?.message || detail;
      } catch (_) {}
      throw new Error(detail);
    }
    const result = await response.json();
    closeOcrReviewModal({ clearPending: true });
    await loadData();
    refreshInventoryWidgets({ includeLists: true });
    appState.alerts = [
      {
        id: `ocr-import-${Date.now()}`,
        title: '✅ Importación OCR aplicada',
        description: `Se importaron ${result?.inserted ?? totalProductos} productos desde el albarán.`,
        priority: 'info',
        type: 'success'
      },
      ...appState.alerts
    ];
    renderAlerts();
  } catch (error) {
    setOcrReviewError(error.message || 'No se pudo completar la importación.');
  } finally {
    isOcrReviewSubmitting = false;
    updateOcrReviewActionState();
  }
}