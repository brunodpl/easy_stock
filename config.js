// Configuración de la aplicación
const CONFIG = {
    // Configuración de almacén
    warehouse: {
        capacity: 1000, // m³
        defaultLocations: ['A-01', 'A-02', 'B-01', 'B-02', 'C-01', 'C-02', 'D-01', 'D-02']
    },
    
    // Configuración de alertas
    alerts: {
        severityLevels: {
            grave: { color: '#ef4444', label: 'GRAVE', priority: 0 },
            atencion: { color: '#f59e0b', label: 'ATENCIÓN', priority: 1 },
            leves: { color: '#d97706', label: 'LEVES', priority: 2 },
            informativas: { color: '#2563eb', label: 'INFORMATIVAS', priority: 3 }
        },
        thresholds: {
            criticalStock: 0.5, // 50% del mínimo
            lowStock: 1.0, // 100% del mínimo
            excessStock: 1.5 // 150% del máximo
        }
    },
    
    // Configuración de reconocimiento de voz
    voice: {
        lang: 'es-ES',
        continuous: false,
        interimResults: false,
        commands: {
            'ver producto': 'viewProduct',
            'mostrar producto': 'viewProduct',
            'añadir producto': 'addProduct',
            'agregar producto': 'addProduct',
            'ver alertas': 'viewAlerts',
            'mostrar alertas': 'viewAlerts',
            'ver facturas': 'viewInvoices',
            'mostrar facturas': 'viewInvoices',
            'ver tareas': 'viewTasks',
            'mostrar tareas': 'viewTasks',
            'cerrar modal': 'closeModal',
            'volver': 'goBack'
        }
    },
    
    // Configuración de interacciones táctiles
    touch: {
        longPressDelay: 500, // ms
        swipeThreshold: 50, // px
        doubleTapDelay: 300 // ms
    },
    
    // Configuración de UI
    ui: {
        minTouchTarget: 44, // px
        fontSize: {
            xs: '16px',
            sm: '18px',
            base: '20px',
            lg: '22px',
            xl: '24px',
            '2xl': '28px',
            '3xl': '32px',
            '4xl': '40px'
        }
    },
    
    // Configuración de almacenamiento
    storage: {
        key: 'stockpredict_data',
        autoSave: true,
        saveInterval: 30000 // 30 segundos
    }
};

