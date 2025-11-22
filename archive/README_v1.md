# 📦 Easy Stock - Sistema de Gestión de Almacén

Sistema inteligente de gestión de inventario diseñado para pequeñas y medianas empresas. Easy Stock ofrece una interfaz intuitiva con control por voz y alertas automatizadas para optimizar la gestión del almacén.

## 🎯 Características Principales

### Dashboard Interactivo
- **Panel de Control Completo**: Visualización en tiempo real de KPIs esenciales
- **Gestión de Inventario**: Tabla detallada con información de productos por ID/SKU
- **Sistema de Alertas Inteligente**: Clasificación por prioridad (Críticas, Atención, Leves, Informativas)
- **Estado del Almacén**: Indicador visual de salud general (0-100%) basado en advertencias
- **Ocupación de Espacio**: Seguimiento del porcentaje de capacidad utilizada
- **Facturas Próximas**: Visualización de pagos pendientes para la próxima semana

### Accesibilidad Avanzada
- **Control por Voz**: Integración con Web Speech API para interacciones manos libres
- **Interfaz Touch-Friendly**: Optimizada para dispositivos táctiles
- **Diseño Responsive**: Compatible con escritorio, tablets y móviles
- **Paleta de Colores Intuitiva**: Código de colores para identificación rápida de estados

### Alertas Automatizadas
El sistema genera alertas automáticamente basadas en:
- **Caducidad de Productos**: Avisos críticos (<2 días) y preventivos (2-7 días)
- **Niveles de Stock**: Detección de stock crítico, bajo o excesivo
- **Ubicación**: Información de localización para acción rápida

## 🚀 Inicio Rápido

### Requisitos Previos
- Node.js (v14 o superior)
- Navegador con soporte para Web Speech API (Chrome, Edge recomendados)

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/brunodpl/easy_stock.git

# Navegar al directorio
cd easy_stock

# Instalar dependencias
npm install

# Iniciar el servidor
npm start
```

El servidor estará disponible en `http://localhost:3001`

## 📁 Estructura del Proyecto

```
easy_stock/
├── index.html              # Estructura principal HTML
├── app.js                  # Lógica de la aplicación
├── style.css              # Estilos y tema visual
├── voice.js               # Módulo de reconocimiento por voz
├── utils.js               # Utilidades y funciones auxiliares
├── server.js              # Servidor Express
├── package.json           # Dependencias del proyecto
└── README.md             # Documentación
```

## 💻 Tecnologías Utilizadas

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Backend**: Node.js, Express, Python
- **APIs**: Web Speech API (reconocimiento de voz)
- **Estilos**: CSS Variables, Flexbox, Grid
- **PWA**: Manifest.json, Service Worker ready

## ⚡ Optimizaciones de Rendimiento

- **PWA Ready**: Instalable como aplicación nativa
- **Cache Inteligente**: Headers optimizados para assets estáticos
- **Carga Diferida**: Scripts con atributo `defer`
- **SVG Favicon**: Vectorial y ligero
- **Sin Dependencias Frontend**: Vanilla JS para máxima velocidad
- **Responsive Design**: Mobile-first approach


## 📊 KPIs y Métricas

El dashboard muestra en tiempo real:
### KPIs del Dashboard

**Inventario**
- 🟢 **Total de productos**: unidades totales en inventario  
- 🔴 **Valor total del inventario**: valor monetario del stock actual  
- 🟡 **Valor promedio por SKU**: valor medio por producto  

**Alertas**
- 🔴 **Alertas activas**: total de alertas sin resolver  
- 🔴 **Alertas críticas**: máxima prioridad  
- 🟡 **Alertas de atención**: prioridad media  
- 🟢 **Alertas leves**: baja prioridad  
- 🔵 **Alertas informativas**: notificaciones generales  

**Stock & Caducidad**
- 🔴 **Excesos de stock**: productos por encima del stock máximo  
- 🔴 **Stock crítico**: por debajo del 50% del mínimo  
- 🟡 **Stock bajo**: entre 50% y 100% del mínimo  
- 🔴 **Productos caducados**: fecha de vencimiento pasada  
- 🔴 **Caducidad inminente (< 2 días)**  
- 🟡 **Caducidad próxima (2–7 días)**  
- 🔴 **Valor en riesgo de caducidad**: valor monetario de productos que caducan en < 7 días  

**Facturación & Espacio**
- 🔴 **Facturas pendientes**: sin pagar  
- 🔴 **Facturas vencidas**: fuera de plazo  
- 🔴 **% de espacio ocupado**: porcentaje de capacidad utilizada  
- 🔴 **Puntuación de salud general**: score 0–100 del almacén  

**Los calculos SQL de los KPI estarán en el apartado Base de Datos**

## 🔮 Roadmap

✅ Dashboard básico en JavaScript

✅ Frontend con interfaz touch-friendly

🔄 Base de datos: Supabase (en implementación)

❌ Control por voz: NO implementado

❌ Procesamiento CSV + LLM: Pendiente

❌ ML predictions: Pendiente

> **Nota**: La implementación de ML está planificada para cuando se disponga de datos históricos suficientes. Muchos negocios objetivo no cuentan con sistemas de recopilación de datos estructurados.

### Automatización con IA
- **Procesamiento de CSV**: Integración con LLM API para resolver incongruencias en exportaciones diarias
- **Corrección Automática**: Detección y corrección de errores de registro durante la jornada laboral
- **Validación Inteligente**: Verificación automática de datos ingresados

### Mejoras Planificadas
- **Gestión de Tareas Avanzada**: Sistema completo de seguimiento con prioridades
- **Contactos de Emergencia**: Visualización de supervisores y teléfonos de contacto
- **Base de Datos Persistente**: Migración a sistema de base de datos robusto
- **Reportes Exportables**: Generación de informes en PDF/Excel
- **Notificaciones Push**: Alertas en tiempo real para eventos críticos

## 🗄️ Base de Datos

> **En desarrollo**: Actualmente en fase de diseño con Data Engineer para determinar la arquitectura óptima de base de datos según las necesidades de escalabilidad y rendimiento.

Consideraciones en evaluación:
- Modelo relacional vs NoSQL
- Estrategias de backup y recuperación
- Optimización para consultas en tiempo real
- Escalabilidad horizontal

#### Cálculos SQL de KPI's

```sql
-- 1. Total de Productos
SUM(current_stock)

-- 2. SKUs Únicos Activos
COUNT(DISTINCT sku)

-- 3. Valor Total del Inventario
SUM(current_stock * unit_price)

-- 4. Valor Promedio por SKU
AVG(current_stock * unit_price)

-- 5. Alertas Activas
COUNT(*) WHERE resolved = false

-- 6. Alertas Críticas
COUNT(*) WHERE alert_type = 'critica' AND resolved = false

-- 7. Alertas de Atención
COUNT(*) WHERE alert_type = 'atencion' AND resolved = false

-- 8. Alertas Leves
COUNT(*) WHERE alert_type = 'leve' AND resolved = false

-- 9. Alertas Informativas
COUNT(*) WHERE alert_type = 'informativa' AND resolved = false

-- 10. Excesos de Stock
COUNT(*) WHERE current_stock > max_stock

-- 11. Stock Crítico
COUNT(*) WHERE current_stock <= min_stock * 0.5

-- 12. Stock Bajo
COUNT(*) WHERE current_stock > min_stock * 0.5 AND current_stock <= min_stock

-- 13. Productos Caducados
COUNT(*) WHERE expiration_date < CURRENT_DATE

-- 14. Caducidad Inminente (< 2 días)
COUNT(*) WHERE expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 2

-- 15. Caducidad Próxima (2–7 días)
COUNT(*) WHERE expiration_date BETWEEN CURRENT_DATE + 2 AND CURRENT_DATE + 7

-- 16. Valor en Riesgo de Caducidad
SUM(current_stock * unit_price) WHERE expiration_date <= CURRENT_DATE + 7

-- 17. Facturas Pendientes
COUNT(*) WHERE status = 'pendiente'

-- 18. Facturas Vencidas
COUNT(*) WHERE due_date < CURRENT_DATE AND status != 'pagada'

-- 19. % Espacio Ocupado
(SUM(current_stock) / capacidad_maxima) * 100

-- 20. Puntuación de Salud General
-- Ver función calculateWarehouseHealth() actual

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Para cambios importantes:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/NuevaCaracteristica`)
3. Commit tus cambios (`git commit -m 'Añadir nueva característica'`)
4. Push a la rama (`git push origin feature/NuevaCaracteristica`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia ISC.

## 👤 Autor

**Bruno Del Palacio Rodríguez**
- GitHub: [@brunodpl](https://github.com/brunodpl)

## 📞 Soporte

brundata00@gmail.com

Para reportar problemas o sugerencias, por favor abre un [issue](https://github.com/brunodpl/easy_stock/issues) en GitHub.

---

Desarrollado con ❤️ para optimizar la gestión de almacenes
