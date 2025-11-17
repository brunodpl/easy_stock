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
      ubicacion: "A-01",
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

// Generate Alerts
function generateAlerts() {
  appState.alerts = [];
  
  appState.products.forEach(product => {
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
    let statusClass = 'ok';
    let statusText = 'OK';
    
    if (product.stock_actual <= product.stockMin * 0.5) {
      statusClass = 'critical';
      statusText = 'CRÍTICO';
    } else if (product.stock_actual <= product.stockMin) {
      statusClass = 'low';
      statusText = 'BAJO';
    } else if (product.stock_actual >= product.stockMax) {
      statusClass = 'excess';
      statusText = 'EXCESO';
    }
    
    return `
      <tr>
        <td><strong>${product.sku}</strong></td>
        <td>${product.nombre}</td>
        <td><strong>${product.stock_actual}</strong> uds</td>
        <td>${product.ubicacion}</td>
        <td>€${product.precio_unitario.toFixed(2)}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
      </tr>
    `;
  }).join('');
}

// Update Warehouse Gauge
function updateWarehouseGauge() {
  const percentage = appState.warehouseConfig.occupied_percentage || 0;
  const gaugePercentageElement = document.getElementById('gauge-percentage');
  const gaugeFill = document.getElementById('gauge-fill');
  
  if (gaugePercentageElement) {
    gaugePercentageElement.textContent = `${percentage}%`;
  }
  
  if (gaugeFill) {
    // Calculate stroke-dashoffset for semi-circle (251.2 is circumference of half circle)
    const circumference = 251.2;
    const offset = circumference - (circumference * percentage / 100);
    gaugeFill.style.strokeDashoffset = offset;
    
    // Change color based on percentage
    if (percentage >= 90) {
      gaugeFill.style.stroke = 'var(--color-error)';
    } else if (percentage >= 75) {
      gaugeFill.style.stroke = 'var(--color-warning)';
    } else {
      gaugeFill.style.stroke = 'var(--color-primary)';
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