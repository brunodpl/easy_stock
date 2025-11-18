// Warehouse Management Dashboard Application

// Sample Data
const sampleData = {
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
};

// Application State
let appState = {
  products: [],
  invoices: [],
  tasks: [],
  warehouseConfig: {},
  alerts: []
};

// Initialize Application
function init() {
  console.log('Initializing Warehouse Management Dashboard...');
  
  // Load data
  loadData();
  
  // Update UI
  updateCurrentDate();
  updateKPIs();
  renderAlerts();
  renderProductsTable();
  updateWarehouseGauge();
  updateSpaceOccupancy();
  renderInvoices();
  renderTasks();
  
  // Initialize voice control
  initVoiceControl();
  
  console.log('Dashboard initialized successfully!');
}

// Load Data
function loadData() {
  appState.products = sampleData.products;
  appState.invoices = sampleData.invoices;
  appState.tasks = sampleData.tasks;
  appState.warehouseConfig = sampleData.warehouseConfig;
  
  // Generate alerts based on product stock
  generateAlerts();
}

// Helper function to calculate days until expiration
function getDaysUntilExpiration(expirationDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDate = new Date(expirationDate);
  expDate.setHours(0, 0, 0, 0);
  const diffTime = expDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Generate Alerts
function generateAlerts() {
  appState.alerts = [];
  
  appState.products.forEach(product => {
    // Check expiration alerts
    const daysUntilExpiration = getDaysUntilExpiration(product.caducidad);
    
    if (daysUntilExpiration < 2) {
      appState.alerts.push({
        type: 'critical',
        title: `⚠️ Caducidad crítica: ${product.nombre}`,
        description: `Caduca en ${daysUntilExpiration} día(s) - ${product.caducidad}. Ubicación: ${product.ubicacion}`,
        priority: 'critical'
      });
    } else if (daysUntilExpiration >= 2 && daysUntilExpiration <= 7) {
      appState.alerts.push({
        type: 'warning',
        title: `⏰ Próximo a caducar: ${product.nombre}`,
        description: `Caduca en ${daysUntilExpiration} días - ${product.caducidad}. Ubicación: ${product.ubicacion}`,
        priority: 'warning'
      });
    }
    
    // Check stock alerts
    if (product.stock_actual <= product.stockMin * 0.5) {
      appState.alerts.push({
        type: 'critical',
        title: `Stock crítico: ${product.nombre}`,
        description: `Solo quedan ${product.stock_actual} unidades. Ubicación: ${product.ubicacion}`,
        priority: 'critical'
      });
    } else if (product.stock_actual <= product.stockMin) {
      appState.alerts.push({
        type: 'warning',
        title: `Stock bajo: ${product.nombre}`,
        description: `${product.stock_actual} unidades disponibles. Ubicación: ${product.ubicacion}`,
        priority: 'warning'
      });
    } else if (product.stock_actual >= product.stockMax) {
      appState.alerts.push({
        type: 'info',
        title: `Exceso de stock: ${product.nombre}`,
        description: `${product.stock_actual} unidades (máx: ${product.stockMax}). Ubicación: ${product.ubicacion}`,
        priority: 'info'
      });
    }
  });
  
  // Sort alerts by priority
  const priorityOrder = { critical: 0, warning: 1, info: 2 };
  appState.alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
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
  // Total Products
  const totalProducts = appState.products.reduce((sum, p) => sum + p.stock_actual, 0);
  const totalProductsElement = document.getElementById('kpi-total-products');
  if (totalProductsElement) {
    totalProductsElement.textContent = totalProducts.toLocaleString('es-ES');
  }
  
  // Total Value
  const totalValue = appState.products.reduce((sum, p) => sum + (p.stock_actual * p.precio_unitario), 0);
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
        <div class="alert-description">${alert.description}</div>
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
    
    return `
      <tr>
        <td><strong>${product.sku}</strong></td>
        <td>${product.nombre}</td>
        <td><span class="${stockClass}"><strong>${product.stock_actual}</strong> uds</span></td>
        <td>${product.ubicacion}</td>
        <td><span class="${expirationClass}">${product.caducidad}${daysUntilExpiration < 8 ? ` (${daysUntilExpiration}d)` : ''}</span></td>
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
  const capacity = appState.warehouseConfig.capacity || 1000;
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
  const capacity = appState.warehouseConfig.capacity || 1000;
  const percentage = Math.min((totalStock / capacity) * 100, 100);
  
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
  
  invoicesList.innerHTML = appState.invoices.map(invoice => {
    const dueDate = new Date(invoice.dueDate);
    const today = new Date();
    const isOverdue = dueDate < today;
    const dueDateFormatted = dueDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    
    return `
      <div class="invoice-item ${isOverdue ? 'overdue' : ''}">
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
  
  tasksList.innerHTML = appState.tasks.map(task => `
    <div class="task-item ${task.priority}">
      <div class="task-title">${task.title}</div>
      <div class="task-assignee">👤 Asignado: <strong>${task.assignedTo}</strong></div>
      <div class="task-contact">📞 Supervisor: ${task.supervisor} - <a href="tel:${task.phone}">${task.phone}</a></div>
    </div>
  `).join('');
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