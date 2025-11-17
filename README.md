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
- Navegador moderno con soporte para Web Speech API (Chrome, Edge recomendados)

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
- **Backend**: Node.js, Express
- **APIs**: Web Speech API (reconocimiento de voz)
- **Estilos**: CSS Variables, Flexbox, Grid
- **PWA**: Manifest.json, Service Worker ready
- **Optimizaciones**: Cache headers, Lazy loading, Defer scripts

## ⚡ Optimizaciones de Rendimiento

- **PWA Ready**: Instalable como aplicación nativa
- **Cache Inteligente**: Headers optimizados para assets estáticos
- **Carga Diferida**: Scripts con atributo `defer`
- **SVG Favicon**: Vectorial y ligero
- **Sin Dependencias Frontend**: Vanilla JS para máxima velocidad
- **Responsive Design**: Mobile-first approach


## 📊 KPIs y Métricas

El dashboard muestra en tiempo real:

1. **Total de Productos**: Suma de unidades en inventario
2. **Valor Total**: Valor monetario del stock actual
3. **Alertas Activas**: Número de alertas críticas y de atención
4. **Excesos de Stock**: Productos por encima del stock máximo

## 🔮 Roadmap Futuro

### Machine Learning (Planificado)
- **Predicción de Demanda**: Algoritmos ML para anticipar necesidades de stock
- **Optimización Automática**: Sugerencias de reorden basadas en patrones históricos
- **Análisis de Tendencias**: Identificación de productos con mayor rotación

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

**Bruno Del Pino López**
- GitHub: [@brunodpl](https://github.com/brunodpl)

## 📞 Soporte

Para reportar problemas o sugerencias, por favor abre un [issue](https://github.com/brunodpl/easy_stock/issues) en GitHub.

---

Desarrollado con ❤️ para optimizar la gestión de almacenes
