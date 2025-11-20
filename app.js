// Warehouse Management Dashboard Application

// Sample Data
/* const sampleData = {
  products: [
    {
      id: 1,
      nombre: "Leche Entera 1L",
      sku: "LAC-LEC-001",
      stock_actual: 24,
      precio_unitario: 1.20,
      categoria: "Lácteos",
      caducidad: "2025-11-18",
      ubicacion: "A-01",
      stockMin: 10,
      stockMax: 50
    },
    {
      id: 6,
      nombre: "Leche Entera 1L",
      sku: "LAC-LEC-001",
      stock_actual: 24,
      precio_unitario: 1.20,
      categoria: "Lácteos",
      caducidad: "2025-11-25",
      ubicacion: "A-03",
      stockMin: 10,
      stockMax: 50
    },
    {
      id: 2,
      nombre: "Pan Integral 500g",
      sku: "PAN-INT-002",
      stock_actual: 5,
      precio_unitario: 2.50,
      categoria: "Panadería",
      caducidad: "2025-11-20",
      ubicacion: "A-02",
      stockMin: 15,
      stockMax: 40
    },
    {
      id: 3,
      nombre: "Aceite de Oliva 1L",
      sku: "ACE-OLI-003",
      stock_actual: 65,
      precio_unitario: 8.90,
      categoria: "Aceites",
      caducidad: "2025-12-01",
      ubicacion: "B-01",
      stockMin: 20,
      stockMax: 60
    },
    {
      id: 4,
      nombre: "Arroz Blanco 1kg",
      sku: "CER-ARR-004",
      stock_actual: 35,
      precio_unitario: 1.80,
      categoria: "Cereales",
      caducidad: "2025-12-01",
      ubicacion: "B-02",
      stockMin: 25,
      stockMax: 80
    },
    {
      id: 5,
      nombre: "Tomate Frito 400g",
      sku: "CON-TOM-005",
      stock_actual: 2,
      precio_unitario: 1.50,
      categoria: "Conservas",
      caducidad: "2025-12-01",
      ubicacion: "C-01",
      stockMin: 10,
      stockMax: 50
    }
  ],
  invoices: [
    {
      id: "INV-001",
      vendor: "Proveedor A",
      amount: 1250.50,
      dueDate: "2025-11-19",
      status: "pending"
    },
    {
      id: "INV-002",
      vendor: "Proveedor B",
      amount: 890.25,
      dueDate: "2025-11-22",
      status: "pending"
    },
    {
      id: "INV-003",
      vendor: "Proveedor C",
      amount: 2100.00,
      dueDate: "2025-11-15",
      status: "overdue"
    }
  ],
  tasks: [
    {
      id: 1,
      title: "Revisar stock crítico",
      priority: "high",
      assignedTo: "Juan Pérez",
      supervisor: "María García",
      phone: "+34 600 123 456"
    },
    {
      id: 2,
      title: "Reorganizar almacén zona B",
      priority: "medium",
      assignedTo: "Ana López",
      supervisor: "Carlos Ruiz",
      phone: "+34 600 789 012"
    },
    {
      id: 3,
      title: "Actualizar inventario mensual",
      priority: "high",
      assignedTo: "Pedro Sánchez",
      supervisor: "Laura Martín",
      phone: "+34 600 345 678"
    }
  ],
  warehouseConfig: {
    capacity: 1000,
    occupied_percentage: 68
  }
}; */

// Application State
let appState = {
  products: [],
  invoices: [],
  tasks: [],
  warehouseConfig: { capacity: 1000 },
  alerts: [],
  kpis: null,
  errorMessage: ''
};

let isEditMode = false;
let deleteHandlersInitialized = false;
let editModeButton = null;
let editModeButtonDefaultLabel = 'Editar';
const editSession = {
  snapshot: null,
  invoices: new Map(),
  tasks: new Map()
};
const confirmModalElements = {
  root: null,
  summary: null,
  invoicesSection: null,
  invoicesList: null,
  tasksSection: null,
  tasksList: null,
  cancelBtn: null,
  confirmBtn: null
};
let isApplyingPendingChanges = false;

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
    stockMax: product.stockMax ?? product.maxStock ?? 0
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
  return {
    id: invoice.id || invoice.invoiceNumber || 'N/A',
    vendor: invoice.vendor || invoice.supplierName || 'Proveedor desconocido',
    amount: toNumber(invoice.amount ?? invoice.totalAmount ?? 0),
    dueDate: invoice.dueDate || invoice.limitDate,
    status: invoice.status || 'pending'
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
  initVoiceControl();
  initEditModeToggle();
  initDeletionHandlers();
  initConfirmModal();
  
  console.log('Dashboard initialized successfully!');
}

// app.js - Reemplazar función loadData()

async function loadData() {
  try {
    const [productsRes, alertsRes, invoicesRes, kpisRes, tasksRes] = await Promise.all([
      fetch('/api/products'),
      fetch('/api/alerts'),
      fetch('/api/invoices'),
      fetch('/api/kpis'),
      fetch('/api/tasks')
    ]);

    if (!productsRes.ok) throw new Error('No se pudieron obtener los productos');
    if (!alertsRes.ok) throw new Error('No se pudieron obtener las alertas');
    if (!invoicesRes.ok) throw new Error('No se pudieron obtener las facturas');
    if (!kpisRes.ok) throw new Error('No se pudieron obtener los KPIs');
    if (!tasksRes.ok) throw new Error('No se pudieron obtener las tareas');

    const [products, alerts, invoices, kpis, tasks] = await Promise.all([
      productsRes.json(),
      alertsRes.json(),
      invoicesRes.json(),
      kpisRes.json(),
      tasksRes.json()
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

    console.log('✅ Datos cargados desde base de datos');
    appState.errorMessage = '';
  } catch (error) {
    console.error('❌ Error cargando datos:', error);
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
  const kpis = appState.kpis;
  // Total Products
  const totalProducts = kpis?.totalProducts ?? appState.products.reduce((sum, p) => sum + p.stock_actual, 0);
  const totalProductsElement = document.getElementById('kpi-total-products');
  if (totalProductsElement) {
    totalProductsElement.textContent = totalProducts.toLocaleString('es-ES');
  }
  
  // Total Value
  const totalValue = kpis?.totalValue ?? appState.products.reduce((sum, p) => sum + (p.stock_actual * p.precio_unitario), 0);
  const totalValueElement = document.getElementById('kpi-total-value');
  if (totalValueElement) {
    totalValueElement.textContent = `€${totalValue.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  
  // Active Alerts
  const alertsCount = kpis?.alertsCount ?? appState.alerts.filter(a => a.priority === 'critical' || a.priority === 'warning').length;
  const alertsElement = document.getElementById('kpi-alerts');
  if (alertsElement) {
    alertsElement.textContent = alertsCount;
  }
  
  // Excess Stock
  const excessCount = appState.products.filter(p => p.stock_actual >= p.stockMax).length;
  const excessElement = document.getElementById('kpi-excess');
  if (excessElement) {
    excessElement.textContent = excessCount;
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
    
    return `
      <tr>
        <td><strong>${product.sku}</strong></td>
        <td>${product.nombre}</td>
        <td><span class="${stockClass}"><strong>${product.stock_actual}</strong> uds</span></td>
        <td>${product.ubicacion}</td>
        <td><span class="${expirationClass}">${expirationLabel}${expirationSuffix}</span></td>
        <td>€${product.precio_unitario.toFixed(2)}</td>
      </tr>
    `;
  }).join('');
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
  const totalStock = appState.products.reduce((sum, p) => sum + p.stock_actual, 0);
  const capacity = toNumber(appState.warehouseConfig.capacity) || 1000;
  const percentage = capacity > 0 ? Math.min((totalStock / capacity) * 100, 100) : 0;
  
  const spaceBarFill = document.getElementById('space-bar-fill');
  const spaceBarLabel = document.getElementById('space-bar-label');
  const capacityTotal = document.getElementById('capacity-total');
  const capacityAvailable = document.getElementById('capacity-available');
  
  if (spaceBarFill) {
    spaceBarFill.style.width = `${percentage}%`;
  }
  
  if (spaceBarLabel) {
    spaceBarLabel.textContent = `${totalStock} / ${capacity} unidades`;
  }
  
  if (capacityTotal) {
    capacityTotal.textContent = capacity.toLocaleString('es-ES');
  }
  
  if (capacityAvailable) {
    capacityAvailable.textContent = (capacity - totalStock).toLocaleString('es-ES');
  }
}

// Render Invoices
function renderInvoices() {
  const invoicesList = document.getElementById('invoices-list');
  if (!invoicesList) return;
  
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

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function renderErrorBanner() {
  const banner = document.getElementById('app-error-banner');
  if (!banner) return;
  if (appState.errorMessage) {
    banner.textContent = appState.errorMessage;
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
  return editSession.invoices.size > 0 || editSession.tasks.size > 0;
}

function createEditSnapshot() {
  editSession.snapshot = {
    invoices: deepClone(appState.invoices),
    tasks: deepClone(appState.tasks)
  };
  editSession.invoices.clear();
  editSession.tasks.clear();
}

function restoreSnapshotFromEditSession() {
  if (!editSession.snapshot) return;
  appState.invoices = deepClone(editSession.snapshot.invoices || []);
  appState.tasks = deepClone(editSession.snapshot.tasks || []);
}

function clearEditSession() {
  editSession.snapshot = null;
  editSession.invoices.clear();
  editSession.tasks.clear();
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
  renderInvoices();
  renderTasks();
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

function initConfirmModal() {
  const root = document.getElementById('edit-confirm-modal');
  if (!root) return;
  confirmModalElements.root = root;
  confirmModalElements.summary = document.getElementById('edit-confirm-summary');
  confirmModalElements.invoicesSection = document.getElementById('modal-invoices-section');
  confirmModalElements.invoicesList = document.getElementById('modal-invoices-list');
  confirmModalElements.tasksSection = document.getElementById('modal-tasks-section');
  confirmModalElements.tasksList = document.getElementById('modal-tasks-list');
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
  const total = pendingInvoices.length + pendingTasks.length;
  confirmModalElements.summary.textContent = total === 1
    ? 'Se detectó 1 cambio pendiente.'
    : `Se detectaron ${total} cambios pendientes.`;

  if (confirmModalElements.invoicesSection) {
    confirmModalElements.invoicesSection.hidden = pendingInvoices.length === 0;
  }
  if (confirmModalElements.tasksSection) {
    confirmModalElements.tasksSection.hidden = pendingTasks.length === 0;
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
    await applyPendingChangesToServer();
    removePendingItemsFromState();
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

async function applyPendingChangesToServer() {
  const invoiceRequests = Array.from(editSession.invoices.values())
    .filter(invoice => invoice.id && invoice.id !== 'N/A')
    .map(invoice => deleteInvoiceById(invoice.id));
  const taskRequests = Array.from(editSession.tasks.values())
    .filter(task => task.id)
    .map(task => deleteTaskById(task.id));

  await Promise.all([...invoiceRequests, ...taskRequests]);
}

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

function removePendingItemsFromState() {
  if (editSession.invoices.size) {
    const invoiceIds = new Set(editSession.invoices.keys());
    appState.invoices = appState.invoices.filter(invoice => !invoiceIds.has(invoice._uiId || String(invoice.id)));
  }
  if (editSession.tasks.size) {
    const taskIds = new Set(editSession.tasks.keys());
    appState.tasks = appState.tasks.filter(task => !taskIds.has(task._uiId || String(task.id)));
  }
  renderInvoices();
  renderTasks();
  updateKPIs();
}

function setModalLoadingState(isLoading) {
  if (!confirmModalElements.confirmBtn || !confirmModalElements.cancelBtn) return;
  confirmModalElements.confirmBtn.disabled = isLoading;
  confirmModalElements.cancelBtn.disabled = isLoading;
  confirmModalElements.confirmBtn.textContent = isLoading ? 'Aplicando...' : 'Aplicar cambios';
}