// StockPredict Application
const app = {
    products: [],
    nextId: 1,
    charts: {},

    // Initialize app
    init() {
        this.loadSampleData();
        this.setDefaultDate();
        this.renderDashboard();
    },

    // Load sample products
    loadSampleData() {
        const sampleProducts = [
            { nombre: 'Laptop HP 15 pulgadas', sku: 'TECH-LP-001', stock_actual: 5, precio_unitario: 599, categoria: 'Electronica' },
            { nombre: 'Camiseta Básica Blanca', sku: 'ROPA-CAM-002', stock_actual: 150, precio_unitario: 12, categoria: 'Ropa' },
            { nombre: 'Café Premium 1kg', sku: 'ALIM-CAF-003', stock_actual: 8, precio_unitario: 18, categoria: 'Alimentos' },
            { nombre: 'Silla Oficina Ergonómica', sku: 'HOG-SIL-004', stock_actual: 3, precio_unitario: 189, categoria: 'Hogar' },
            { nombre: 'Mouse Inalámbrico', sku: 'TECH-MOU-005', stock_actual: 45, precio_unitario: 25, categoria: 'Electronica' },
            { nombre: 'Pantalón Vaquero', sku: 'ROPA-PAN-006', stock_actual: 22, precio_unitario: 45, categoria: 'Ropa' },
            { nombre: 'Aceite Oliva Extra', sku: 'ALIM-ACE-007', stock_actual: 2, precio_unitario: 15, categoria: 'Alimentos' },
            { nombre: 'Lámpara LED Escritorio', sku: 'HOG-LAM-008', stock_actual: 60, precio_unitario: 35, categoria: 'Hogar' }
        ];

        this.products = sampleProducts.map(p => ({
            id: this.nextId++,
            ...p,
            ...this.calculatePredictions(p.stock_actual)
        }));
    },

    // Calculate predictions and recommendations for a product
    calculatePredictions(stock, customMin = null, customMax = null) {
        // Daily demand with variability
        const demandDaily = stock / 30;
        const variability = 0.8 + Math.random() * 0.4; // ±20%
        const seasonalityFactor = 0.9 + Math.random() * 0.3; // 0.9-1.2
        
        const prediction7Days = Math.round(demandDaily * 7 * seasonalityFactor * variability);
        const stockMin = customMin !== null ? customMin : Math.round(prediction7Days * 1.5);
        const stockMax = customMax !== null ? customMax : Math.round(prediction7Days * 3);

        return {
            demandDaily,
            prediction7Days,
            stockMin,
            stockMax
        };
    },

    // Get product status
    getProductStatus(product) {
        const { stock_actual, stockMin, stockMax } = product;
        
        if (stock_actual < stockMin * 0.5) return { label: 'Crítico', class: 'badge-danger' };
        if (stock_actual < stockMin) return { label: 'Alerta Baja', class: 'badge-warning' };
        if (stock_actual > stockMax * 1.5) return { label: 'Exceso', class: 'badge-info' };
        return { label: 'Óptimo', class: 'badge-success' };
    },

    // Show dashboard
    showDashboard() {
        document.getElementById('landing').style.display = 'none';
        document.getElementById('dashboard').classList.add('active');
    },

    // Set default date
    setDefaultDate() {
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];
        document.getElementById('dateFilter').value = dateStr;
    },

    // Render full dashboard
    renderDashboard() {
        this.renderKPIs();
        this.renderProductsTable();
        this.renderAlerts();
        this.renderRecommendations();
        this.renderSummaryChart();
    },

    // Render KPIs
    renderKPIs() {
        const totalProducts = this.products.length;
        const totalValue = this.products.reduce((sum, p) => sum + (p.stock_actual * p.precio_unitario), 0);
        const alerts = this.products.filter(p => {
            const status = this.getProductStatus(p);
            return status.label === 'Alerta Baja' || status.label === 'Crítico';
        }).length;
        const excess = this.products.filter(p => this.getProductStatus(p).label === 'Exceso').length;

        document.getElementById('kpiTotalProducts').textContent = totalProducts;
        document.getElementById('kpiTotalValue').textContent = `€${totalValue.toLocaleString('es-ES', { maximumFractionDigits: 0 })}`;
        document.getElementById('kpiAlerts').textContent = alerts;
        document.getElementById('kpiExcess').textContent = excess;
    },

    // Render products table
    renderProductsTable() {
        const tbody = document.getElementById('productsTableBody');
        tbody.innerHTML = '';

        this.products.forEach(product => {
            const status = this.getProductStatus(product);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${product.id}</td>
                <td><strong>${product.nombre}</strong><br><small style="color: var(--color-text-secondary);">${product.sku}</small></td>
                <td><strong>${product.stock_actual}</strong></td>
                <td>${product.stockMin}</td>
                <td>${product.stockMax}</td>
                <td>${product.prediction7Days} unidades</td>
                <td><span class="badge ${status.class}">${status.label}</span></td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="app.viewProduct(${product.id})">Ver</button>
                    <button class="btn btn-sm btn-secondary" onclick="app.editProduct(${product.id})">Editar</button>
                    <button class="btn btn-sm btn-danger" onclick="app.deleteProduct(${product.id})">Eliminar</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    },

    // Render alerts
    renderAlerts() {
        const container = document.getElementById('alertsContainer');
        
        // Get critical and alert products
        const critical = this.products.filter(p => this.getProductStatus(p).label === 'Crítico');
        const alerts = this.products.filter(p => this.getProductStatus(p).label === 'Alerta Baja');
        const highDemand = this.products.filter(p => p.prediction7Days > p.stock_actual);
        
        let alertsHtml = '';
        
        // Critical alerts
        critical.slice(0, 3).forEach(p => {
            alertsHtml += `
                <div class="alert-item">
                    <div class="alert-item-title">⚠️ ${p.nombre}</div>
                    <div class="alert-item-desc">Stock crítico: ${p.stock_actual} unidades (mínimo: ${p.stockMin})</div>
                </div>
            `;
        });
        
        // Alert products
        if (critical.length < 3) {
            alerts.slice(0, 3 - critical.length).forEach(p => {
                alertsHtml += `
                    <div class="alert-item">
                        <div class="alert-item-title">⚡ ${p.nombre}</div>
                        <div class="alert-item-desc">Stock bajo: ${p.stock_actual} unidades (mínimo: ${p.stockMin})</div>
                    </div>
                `;
            });
        }
        
        if (!alertsHtml) {
            alertsHtml = '<div style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">No hay alertas críticas 🎉</div>';
        }
        
        container.innerHTML = alertsHtml;
    },

    // Render recommendations
    renderRecommendations() {
        const container = document.getElementById('recommendationsContainer');
        let recommendations = [];
        
        // Generate recommendations
        this.products.forEach(p => {
            const status = this.getProductStatus(p);
            const daysCoverage = Math.round(p.stock_actual / (p.demandDaily || 1));
            
            if (status.label === 'Crítico' || status.label === 'Alerta Baja') {
                recommendations.push(`Reabastecer <strong>${p.nombre}</strong>: Stock cubrirá solo ${daysCoverage} días según predicción`);
            } else if (status.label === 'Exceso') {
                recommendations.push(`Reducir pedido de <strong>${p.nombre}</strong>: Exceso de stock detectado (${p.stock_actual} unidades)`);
            }
        });
        
        // Add generic recommendations
        if (recommendations.length < 2) {
            recommendations.push('Optimizar rotación: Revisa productos de baja demanda para posibles promociones');
        }
        
        let html = '';
        recommendations.slice(0, 3).forEach(rec => {
            html += `<div class="recommendation-item">${rec}</div>`;
        });
        
        container.innerHTML = html;
    },

    // Render summary chart
    renderSummaryChart() {
        const ctx = document.getElementById('summaryChart');
        
        if (this.charts.summary) {
            this.charts.summary.destroy();
        }
        
        // Get top 5 products by predicted demand
        const topProducts = [...this.products]
            .sort((a, b) => b.prediction7Days - a.prediction7Days)
            .slice(0, 5);
        
        this.charts.summary = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topProducts.map(p => p.nombre.split(' ').slice(0, 2).join(' ')),
                datasets: [{
                    label: 'Demanda 7 días',
                    data: topProducts.map(p => p.prediction7Days),
                    backgroundColor: '#1FB8CD'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    },

    // Open add product modal
    openAddProductModal() {
        document.getElementById('addProductForm').reset();
        document.getElementById('addProductModal').classList.add('active');
    },

    // Close add product modal
    closeAddProductModal() {
        document.getElementById('addProductModal').classList.remove('active');
    },

    // Save new product
    saveNewProduct() {
        const nombre = document.getElementById('addName').value;
        const sku = document.getElementById('addSku').value || `SKU-${this.nextId}`;
        const stock = parseInt(document.getElementById('addStock').value);
        const precio = parseFloat(document.getElementById('addPrice').value);
        const categoria = document.getElementById('addCategory').value;
        
        if (!nombre || isNaN(stock) || isNaN(precio)) {
            alert('Por favor completa todos los campos requeridos');
            return;
        }
        
        const newProduct = {
            id: this.nextId++,
            nombre,
            sku,
            stock_actual: stock,
            precio_unitario: precio,
            categoria,
            ...this.calculatePredictions(stock)
        };
        
        this.products.push(newProduct);
        this.closeAddProductModal();
        this.renderDashboard();
        this.showToast('Producto añadido exitosamente');
    },

    // View product details
    viewProduct(id) {
        const product = this.products.find(p => p.id === id);
        if (!product) return;
        
        document.getElementById('viewProductName').textContent = product.nombre;
        
        const daysCoverage = Math.round(product.stock_actual / (product.demandDaily || 1));
        const rotationRate = ((product.demandDaily * 30) / product.stock_actual * 100).toFixed(1);
        const reorderPoint = Math.round(product.stockMin * 1.2);
        
        const content = `
            <div style="margin-bottom: var(--space-24);">
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-16);">
                    <div>
                        <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">SKU</div>
                        <div style="font-weight: 600;">${product.sku}</div>
                    </div>
                    <div>
                        <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">Categoría</div>
                        <div style="font-weight: 600;">${product.categoria}</div>
                    </div>
                    <div>
                        <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">Precio Unitario</div>
                        <div style="font-weight: 600;">€${product.precio_unitario}</div>
                    </div>
                    <div>
                        <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">Valor Total</div>
                        <div style="font-weight: 600;">€${(product.stock_actual * product.precio_unitario).toFixed(2)}</div>
                    </div>
                </div>
            </div>
            
            <h3 style="font-size: var(--font-size-lg); margin-bottom: var(--space-16);">Histórico de Stock (30 días)</h3>
            <div class="chart-container">
                <canvas id="historyChart"></canvas>
            </div>
            
            <h3 style="font-size: var(--font-size-lg); margin: var(--space-24) 0 var(--space-16);">Predicción de Demanda (7 días)</h3>
            <div class="chart-container">
                <canvas id="predictionChart"></canvas>
            </div>
            
            <h3 style="font-size: var(--font-size-lg); margin: var(--space-24) 0 var(--space-16);">Métricas Calculadas</h3>
            <div class="metrics-grid">
                <div class="metric-item">
                    <div class="metric-label">Tasa de Rotación</div>
                    <div class="metric-value">${rotationRate}%</div>
                </div>
                <div class="metric-item">
                    <div class="metric-label">Días de Cobertura</div>
                    <div class="metric-value">${daysCoverage} días</div>
                </div>
                <div class="metric-item">
                    <div class="metric-label">Punto de Reposición</div>
                    <div class="metric-value">${reorderPoint} unidades</div>
                </div>
                <div class="metric-item">
                    <div class="metric-label">Demanda Diaria</div>
                    <div class="metric-value">${product.demandDaily.toFixed(1)} und.</div>
                </div>
            </div>
            
            <div style="margin-top: var(--space-24); padding: var(--space-16); background: rgba(37, 99, 235, 0.05); border-left: 3px solid var(--primary); border-radius: var(--radius-sm);">
                <div style="font-weight: 600; margin-bottom: var(--space-8);">💡 Recomendación IA</div>
                <div style="font-size: var(--font-size-sm);">
                    ${this.getProductRecommendation(product, daysCoverage)}
                </div>
            </div>
        `;
        
        document.getElementById('viewProductContent').innerHTML = content;
        document.getElementById('viewProductModal').classList.add('active');
        
        // Render charts after modal is shown
        setTimeout(() => {
            this.renderHistoryChart(product);
            this.renderPredictionChart(product);
        }, 100);
    },

    // Get product recommendation
    getProductRecommendation(product, daysCoverage) {
        const status = this.getProductStatus(product);
        
        if (status.label === 'Crítico') {
            return `<strong>Acción urgente:</strong> Reabastecer inmediatamente. El stock actual solo cubre ${daysCoverage} días. Se recomienda ordenar ${product.stockMax - product.stock_actual} unidades.`;
        } else if (status.label === 'Alerta Baja') {
            return `<strong>Atención:</strong> Planificar reabastecimiento pronto. Stock cubrirá ${daysCoverage} días. Ordenar ${product.stockMin - product.stock_actual} unidades para alcanzar nivel óptimo.`;
        } else if (status.label === 'Exceso') {
            return `<strong>Optimización:</strong> Exceso de inventario detectado. Considerar promociones o reducir próximas órdenes. Excedente: ${product.stock_actual - product.stockMax} unidades.`;
        } else {
            return `<strong>Estado óptimo:</strong> El inventario está balanceado. Mantener seguimiento regular y reabastecer cuando llegue a ${product.stockMin} unidades.`;
        }
    },

    // Render history chart
    renderHistoryChart(product) {
        const ctx = document.getElementById('historyChart');
        if (this.charts.history) {
            this.charts.history.destroy();
        }
        
        // Generate simulated 30-day history
        const history = [];
        let stock = product.stock_actual;
        for (let i = 30; i >= 0; i--) {
            const variance = (Math.random() - 0.5) * product.demandDaily * 0.5;
            stock += variance;
            history.push(Math.max(0, Math.round(stock)));
        }
        history.reverse();
        
        const labels = Array.from({ length: 31 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (30 - i));
            return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        });
        
        this.charts.history = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Stock',
                    data: history,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    },

    // Render prediction chart
    renderPredictionChart(product) {
        const ctx = document.getElementById('predictionChart');
        if (this.charts.prediction) {
            this.charts.prediction.destroy();
        }
        
        // Generate 7-day prediction
        const predictions = [];
        for (let i = 0; i < 7; i++) {
            const variance = 0.8 + Math.random() * 0.4;
            predictions.push(Math.round(product.demandDaily * variance));
        }
        
        const labels = Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() + i + 1);
            return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        });
        
        this.charts.prediction = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Demanda Predicha',
                    data: predictions,
                    backgroundColor: '#10b981'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    },

    // Close view product modal
    closeViewProductModal() {
        document.getElementById('viewProductModal').classList.remove('active');
        if (this.charts.history) this.charts.history.destroy();
        if (this.charts.prediction) this.charts.prediction.destroy();
    },

    // Edit product
    editProduct(id) {
        const product = this.products.find(p => p.id === id);
        if (!product) return;
        
        document.getElementById('editId').value = product.id;
        document.getElementById('editName').value = product.nombre;
        document.getElementById('editStock').value = product.stock_actual;
        document.getElementById('editPrice').value = product.precio_unitario;
        document.getElementById('editStockMin').value = product.stockMin;
        document.getElementById('editStockMax').value = product.stockMax;
        
        document.getElementById('editProductModal').classList.add('active');
    },

    // Close edit product modal
    closeEditProductModal() {
        document.getElementById('editProductModal').classList.remove('active');
    },

    // Save edited product
    saveEditProduct() {
        const id = parseInt(document.getElementById('editId').value);
        const product = this.products.find(p => p.id === id);
        if (!product) return;
        
        const nombre = document.getElementById('editName').value;
        const stock = parseInt(document.getElementById('editStock').value);
        const precio = parseFloat(document.getElementById('editPrice').value);
        const stockMin = document.getElementById('editStockMin').value ? parseInt(document.getElementById('editStockMin').value) : null;
        const stockMax = document.getElementById('editStockMax').value ? parseInt(document.getElementById('editStockMax').value) : null;
        
        if (!nombre || isNaN(stock) || isNaN(precio)) {
            alert('Por favor completa todos los campos requeridos');
            return;
        }
        
        // Update product
        product.nombre = nombre;
        product.stock_actual = stock;
        product.precio_unitario = precio;
        
        // Recalculate predictions
        const predictions = this.calculatePredictions(stock, stockMin, stockMax);
        Object.assign(product, predictions);
        
        this.closeEditProductModal();
        this.renderDashboard();
        this.showToast('Producto actualizado exitosamente');
    },

    // Delete product
    deleteProduct(id) {
        const product = this.products.find(p => p.id === id);
        if (!product) return;
        
        if (confirm(`¿Estás seguro de que quieres eliminar "${product.nombre}"?`)) {
            this.products = this.products.filter(p => p.id !== id);
            this.renderDashboard();
            this.showToast('Producto eliminado exitosamente');
        }
    },

    // Show toast notification
    showToast(message) {
        const toast = document.getElementById('toast');
        document.getElementById('toastMessage').textContent = message;
        toast.classList.add('active');
        
        setTimeout(() => {
            toast.classList.remove('active');
        }, 3000);
    }
};

// Initialize app when page loads
window.addEventListener('DOMContentLoaded', () => {
    app.init();
});