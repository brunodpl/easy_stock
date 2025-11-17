const { useState, useEffect, useRef } = React;

// Componente de Botón Grande (Cubo)
function ActionButton({ icon, title, value, subtitle, color, onClick, badge }) {
    return (
        <div 
            className="action-button" 
            onClick={onClick}
            style={{ '--button-color': color }}
        >
            <div className="action-button-icon">{icon}</div>
            <div className="action-button-content">
                <div className="action-button-title">{title}</div>
                <div className="action-button-value">{value}</div>
                {subtitle && <div className="action-button-subtitle">{subtitle}</div>}
            </div>
            {badge && <div className="action-button-badge">{badge}</div>}
        </div>
    );
}

// Componente de Landing Page
function LandingPage({ onEnter }) {
    return (
        <div className="landing-page">
            <div className="landing-icon">📦</div>
            <h1 className="landing-title">StockPredict - Gestión Inteligente de Inventario</h1>
            <p className="landing-subtitle">Predice demanda, optimiza stock y maximiza rentabilidad</p>
            <button className="cta-button" onClick={onEnter}>Acceder al Dashboard</button>
        </div>
    );
}

// Componente de Dashboard
function Dashboard() {
    const [products, setProducts] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [warehouseStatus, setWarehouseStatus] = useState(0);
    const [spaceOccupancy, setSpaceOccupancy] = useState(0);
    const [alerts, setAlerts] = useState([]);
    const [kpis, setKpis] = useState({
        totalProducts: 0,
        totalValue: 0,
        alerts: 0,
        excess: 0
    });
    const [showAlertsModal, setShowAlertsModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [showSpaceModal, setShowSpaceModal] = useState(false);
    const [showInvoicesModal, setShowInvoicesModal] = useState(false);

    useEffect(() => {
        // Inicializar datos desde app
        if (window.app) {
            loadData();
            // Configurar actualización periódica (cada 2 segundos)
            const interval = setInterval(() => {
                if (window.app) {
                    loadData();
                }
            }, 2000);
            return () => clearInterval(interval);
        }
    }, []);

    const loadData = () => {
        if (!window.app) return;
        
        setProducts([...window.app.products]);
        setInvoices([...window.app.invoices]);
        setTasks([...window.app.tasks]);
        
        // Calcular KPIs
        const totalProducts = window.app.products.length;
        const totalValue = window.app.products.reduce((sum, p) => sum + (p.stock_actual * p.precio_unitario), 0);
        const alertsCount = window.app.products.filter(p => {
            const status = window.app.getProductStatus(p);
            return status.label === 'Alerta Baja' || status.label === 'Crítico';
        }).length;
        const excess = window.app.products.filter(p => window.app.getProductStatus(p).label === 'Exceso').length;
        
        setKpis({ totalProducts, totalValue, alerts: alertsCount, excess });
        
        // Calcular estado del almacén
        const critical = window.app.products.filter(p => window.app.getProductStatus(p).label === 'Crítico').length;
        const alerts = window.app.products.filter(p => window.app.getProductStatus(p).label === 'Alerta Baja').length;
        const excessCount = window.app.products.filter(p => window.app.getProductStatus(p).label === 'Exceso').length;
        
        let score = 100 - (critical * 30) - (alerts * 10) - (excessCount * 5);
        score = Math.max(0, Math.min(100, score));
        setWarehouseStatus(score);
        
        // Calcular ocupación de espacio
        const percentage = Math.round((window.app.warehouseUsed / window.app.warehouseCapacity) * 100);
        setSpaceOccupancy(percentage);
        
        // Calcular alertas
        const alertsList = [];
        window.app.products.forEach(p => {
            const status = window.app.getProductStatus(p);
            if (status.label === 'Crítico') {
                alertsList.push({
                    severity: 'grave',
                    title: `Stock Crítico: ${p.nombre}`,
                    description: `Solo quedan ${p.stock_actual} unidades. Mínimo recomendado: ${p.stockMin}`,
                    product: p
                });
            } else if (status.label === 'Alerta Baja') {
                alertsList.push({
                    severity: 'atencion',
                    title: `Stock Bajo: ${p.nombre}`,
                    description: `Stock actual: ${p.stock_actual} unidades. Mínimo: ${p.stockMin}`,
                    product: p
                });
            }
        });
        setAlerts(alertsList);
    };

    const getStatusColor = (score) => {
        if (score <= 33) return '#ef4444';
        if (score <= 66) return '#f59e0b';
        return '#10b981';
    };

    const getStatusLabel = (score) => {
        if (score <= 33) return 'Crítico';
        if (score <= 66) return 'Atención';
        return 'Óptimo';
    };

    const getSpaceColor = (percentage) => {
        if (percentage <= 70) return '#10b981';
        if (percentage <= 85) return '#f59e0b';
        return '#ef4444';
    };

    const upcomingInvoices = invoices.filter(inv => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        const dueDate = new Date(inv.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate <= nextWeek && dueDate >= today;
    }).slice(0, 3);

    const overdueInvoices = invoices.filter(inv => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(inv.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate < today;
    });

    return (
        <div className="dashboard active">
            <header className="header">
                <div className="logo">
                    <span>📦</span>
                    <span>StockPredict</span>
                </div>
                <div className="header-actions">
                    <input 
                        type="date" 
                        id="dateFilter" 
                        className="form-control" 
                        style={{width: 'auto'}}
                        defaultValue={new Date().toISOString().split('T')[0]}
                    />
                    <button className="btn btn-primary" onClick={() => window.app.openAddProductModal()}>
                        + Añadir Producto
                    </button>
                </div>
            </header>

            <div className="main-content">
                {/* KPIs */}
                <div className="kpi-grid">
                    <div className="kpi-card">
                        <div className="kpi-label">Total de Productos</div>
                        <div className="kpi-value">{kpis.totalProducts}</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">Valor Total del Inventario</div>
                        <div className="kpi-value">€{kpis.totalValue.toLocaleString('es-ES', { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">Productos en Alerta</div>
                        <div className="kpi-value" style={{color: 'var(--alert)'}}>{kpis.alerts}</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-label">Productos con Exceso</div>
                        <div className="kpi-value" style={{color: 'var(--primary)'}}>{kpis.excess}</div>
                    </div>
                </div>

                {/* Botones de Acción Grandes */}
                <div className="action-buttons-grid">
                    <ActionButton
                        icon="🚨"
                        title="Alertas"
                        value={alerts.length}
                        subtitle={alerts.length > 0 ? `${alerts.length} alertas activas` : 'Sin alertas'}
                        color="#ef4444"
                        badge={alerts.length > 0 ? alerts.length : null}
                        onClick={() => setShowAlertsModal(true)}
                    />
                    <ActionButton
                        icon="📊"
                        title="Estado del Almacén"
                        value={warehouseStatus}
                        subtitle={getStatusLabel(warehouseStatus)}
                        color={getStatusColor(warehouseStatus)}
                        onClick={() => setShowStatusModal(true)}
                    />
                    <ActionButton
                        icon="📦"
                        title="Ocupación de Espacio"
                        value={`${spaceOccupancy}%`}
                        subtitle={`${Math.round(window.app?.warehouseUsed || 0)} m³ / ${window.app?.warehouseCapacity || 1000} m³`}
                        color={getSpaceColor(spaceOccupancy)}
                        onClick={() => setShowSpaceModal(true)}
                    />
                    <ActionButton
                        icon="📄"
                        title="Próximas Facturas"
                        value={upcomingInvoices.length + overdueInvoices.length}
                        subtitle={overdueInvoices.length > 0 ? `${overdueInvoices.length} vencidas` : 'Todas al día'}
                        color={overdueInvoices.length > 0 ? '#ef4444' : '#2563eb'}
                        badge={overdueInvoices.length > 0 ? overdueInvoices.length : null}
                        onClick={() => setShowInvoicesModal(true)}
                    />
                </div>

                {/* Tabla de Productos */}
                <div className="card" style={{marginTop: 'var(--space-32)'}}>
                    <h2 className="card-title">Productos</h2>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Nombre</th>
                                    <th>Stock</th>
                                    <th>Ubicación</th>
                                    <th>Mín</th>
                                    <th>Máx</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.map(product => {
                                    const status = window.app?.getProductStatus(product) || { label: 'Óptimo', class: 'badge-success' };
                                    return (
                                        <tr key={product.id} onClick={() => window.app?.viewProduct(product.id)}>
                                            <td><strong>{product.id}</strong></td>
                                            <td>
                                                <strong>{product.nombre}</strong><br/>
                                                <span style={{color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)'}}>
                                                    {product.sku}
                                                </span>
                                            </td>
                                            <td><strong style={{fontSize: 'var(--font-size-lg)'}}>{product.stock_actual}</strong></td>
                                            <td><strong>{product.ubicacion || 'N/A'}</strong></td>
                                            <td>{product.stockMin}</td>
                                            <td>{product.stockMax}</td>
                                            <td><span className={`badge ${status.class}`}>{status.label}</span></td>
                                            <td>
                                                <button 
                                                    className="btn btn-sm btn-secondary" 
                                                    onClick={(e) => { e.stopPropagation(); window.app?.viewProduct(product.id); }}
                                                >
                                                    Ver
                                                </button>
                                                <button 
                                                    className="btn btn-sm btn-secondary" 
                                                    onClick={(e) => { e.stopPropagation(); window.app?.editProduct(product.id); }}
                                                >
                                                    Editar
                                                </button>
                                                <button 
                                                    className="btn btn-sm btn-danger" 
                                                    onClick={(e) => { e.stopPropagation(); window.app?.deleteProduct(product.id); }}
                                                >
                                                    Eliminar
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal de Alertas */}
            {showAlertsModal && (
                <div className="modal-overlay active" onClick={() => setShowAlertsModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">🚨 Alertas Inteligentes</h2>
                        </div>
                        <div className="modal-body">
                            {alerts.length === 0 ? (
                                <div style={{textAlign: 'center', padding: 'var(--space-24)', color: 'var(--color-text-secondary)'}}>
                                    No hay alertas 🎉
                                </div>
                            ) : (
                                alerts.map((alert, idx) => {
                                    const severityClass = `alert-severity-${alert.severity}`;
                                    const severityLabel = alert.severity === 'grave' ? 'GRAVE' : 'ATENCIÓN';
                                    return (
                                        <div 
                                            key={idx} 
                                            className="alert-item"
                                            onClick={() => {
                                                if (alert.product) window.app?.viewProduct(alert.product.id);
                                                setShowAlertsModal(false);
                                            }}
                                        >
                                            <div className={`alert-severity-badge ${severityClass}`}>{severityLabel}</div>
                                            <div className="alert-item-title">{alert.title}</div>
                                            <div className="alert-item-desc">{alert.description}</div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowAlertsModal(false)}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Estado */}
            {showStatusModal && (
                <div className="modal-overlay active" onClick={() => setShowStatusModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">📊 Estado del Almacén</h2>
                        </div>
                        <div className="modal-body">
                            <div className="warehouse-status-gauge">
                                <div className="gauge-container">
                                    <div 
                                        className="gauge-circle"
                                        style={{
                                            borderColor: getStatusColor(warehouseStatus),
                                            color: getStatusColor(warehouseStatus)
                                        }}
                                    >
                                        <span className="gauge-value">{warehouseStatus}</span>
                                    </div>
                                </div>
                                <div className="gauge-label">
                                    Estado: {getStatusLabel(warehouseStatus)}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowStatusModal(false)}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Espacio */}
            {showSpaceModal && (
                <div className="modal-overlay active" onClick={() => setShowSpaceModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">📦 Ocupación de Espacio</h2>
                        </div>
                        <div className="modal-body">
                            <div className="space-occupancy">
                                <div className="occupancy-display">{spaceOccupancy}%</div>
                                <div className="occupancy-bar">
                                    <div 
                                        className="occupancy-fill"
                                        style={{
                                            width: `${spaceOccupancy}%`,
                                            background: getSpaceColor(spaceOccupancy)
                                        }}
                                    >
                                        {spaceOccupancy > 10 ? `${spaceOccupancy}%` : ''}
                                    </div>
                                </div>
                                <div className="occupancy-info">
                                    <span>{Math.round(window.app?.warehouseUsed || 0)} m³</span>
                                    <span>{window.app?.warehouseCapacity || 1000} m³</span>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowSpaceModal(false)}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Facturas */}
            {showInvoicesModal && (
                <div className="modal-overlay active" onClick={() => setShowInvoicesModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">📄 Facturas Próximas</h2>
                        </div>
                        <div className="modal-body">
                            {[...overdueInvoices, ...upcomingInvoices].length === 0 ? (
                                <div style={{textAlign: 'center', padding: 'var(--space-24)', color: 'var(--color-text-secondary)'}}>
                                    No hay facturas próximas
                                </div>
                            ) : (
                                [...overdueInvoices, ...upcomingInvoices].map(invoice => {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    const dueDate = new Date(invoice.dueDate);
                                    const daysDiff = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
                                    const isOverdue = daysDiff < 0;
                                    const isUrgent = daysDiff <= 2 && daysDiff >= 0;
                                    const cardClass = isOverdue ? 'overdue' : isUrgent ? 'urgent' : '';
                                    const dateStr = dueDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
                                    
                                    return (
                                        <div 
                                            key={invoice.id}
                                            className={`invoice-card ${cardClass}`}
                                            onClick={() => {
                                                window.app?.viewInvoice(invoice.id);
                                                setShowInvoicesModal(false);
                                            }}
                                        >
                                            <div className="invoice-header">
                                                <div className="invoice-id">{invoice.id}</div>
                                                <div className="invoice-amount">€{invoice.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</div>
                                            </div>
                                            <div className="invoice-details">
                                                <div><strong>Proveedor:</strong> {invoice.vendor}</div>
                                                <div><strong>Vencimiento:</strong> {dateStr} ({isOverdue ? `${Math.abs(daysDiff)} días vencida` : `${daysDiff} días`})</div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowInvoicesModal(false)}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Componente Principal
function App() {
    const [showDashboard, setShowDashboard] = useState(false);
    const [updateKey, setUpdateKey] = useState(0);

    useEffect(() => {
        // Inicializar app cuando esté lista
        if (window.app && !showDashboard) {
            window.app.init();
        }
    }, [showDashboard]);

    // Función para forzar actualización
    useEffect(() => {
        window.reactAppUpdate = () => {
            setUpdateKey(prev => prev + 1);
        };
    }, []);

    if (!showDashboard) {
        return <LandingPage onEnter={() => setShowDashboard(true)} />;
    }

    return <Dashboard key={updateKey} />;
}

// Renderizar la aplicación cuando el DOM esté listo
function initReactApp() {
    const rootElement = document.getElementById('root');
    if (!rootElement) {
        console.error('No se encontró el elemento root');
        return;
    }

    // Esperar a que React esté disponible
    if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
        console.error('React no está disponible');
        return;
    }

    // Usar createRoot si está disponible (React 18+), sino usar render (React 17)
    if (ReactDOM.createRoot) {
        const root = ReactDOM.createRoot(rootElement);
        root.render(<App />);
        // Función para actualizar React desde app.js
        window.reactAppUpdate = () => {
            root.render(<App />);
        };
    } else {
        // Fallback para React 17
        ReactDOM.render(<App />, rootElement);
        window.reactAppUpdate = () => {
            ReactDOM.render(<App />, rootElement);
        };
    }
}

// Intentar renderizar inmediatamente
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReactApp);
} else {
    // DOM ya está listo
    setTimeout(initReactApp, 100);
}

