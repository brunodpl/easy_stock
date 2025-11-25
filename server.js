// ===== Easy Stock API Server =====
// Serves the dashboard assets and exposes CRUD endpoints powered by Prisma.
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const multer = require('multer');
const FormData = require('form-data');
const axios = require('axios');
const pdf = require('pdf-parse');
const os = require('os');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3:8b';
const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY || null;
const OCR_SNAPSHOT_DIR = path.join(__dirname, 'ocr-service', 'uploads', 'ocr_snapshots');
const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:8000';
const INVOICE_JSON_DIR = path.join(__dirname, 'uploads', 'invoices');



// ===== Middleware & Static Assets =====
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '200kb' }));

// Adjust CORS if you later split frontend/backend origins
app.use(cors({ origin: true, methods: ['GET','POST','PUT','DELETE','OPTIONS'] }));

// Rate limit API to mitigate brute force / floods
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

// Serve only the public/ directory as static assets
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d', etag: true }));

// --- Basic API key auth for mutating endpoints (optional, enabled if API_KEY is set) ---
function requireApiKey(req, res, next) {
  if (!API_KEY) return next(); // no-op if not configured
  const header = req.get('x-api-key');
  if (header && header === API_KEY) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}
const protect = [requireApiKey];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']);
    if (allowed.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no soportado. Usa JPG, PNG o PDF.'));
    }
  }
});

const handleOcrUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    console.error('Error subiendo archivo OCR:', err.message || err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Archivo demasiado grande (máximo 10MB).' });
    }
    return res.status(400).json({ error: err.message || 'Error subiendo archivo.' });
  });
};

// ===== Validation Helpers =====
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RAW_STATUS_MAP = {
  pendiente: 'PENDING',
  pending: 'PENDING',
  vencida: 'OVERDUE',
  overdue: 'OVERDUE',
  pagada: 'PAID',
  paid: 'PAID'
};
const DISPLAYED_INVOICE_STATUSES = new Set(['PENDING', 'OVERDUE']);

class ValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

function validateUUID(req, res, next) {
  const { id } = req.params;
  if (!UUID_REGEX.test(id)) {
    return res.status(400).json({ error: 'Invalid UUID format' });
  }
  next();
}

function normalizeInvoiceStatus(status) {
  if (!status) return 'PENDING';
  const normalized = RAW_STATUS_MAP[String(status).trim().toLowerCase()];
  if (normalized) return normalized;
  return String(status).trim().toUpperCase();
}

// ===== Product Payload Normalization =====
function buildProductUpdateData(payload = {}, currentProduct = {}) {
  const data = {};
  const errors = [];

  const stringFields = [
    ['name', 'Nombre', true],
    ['sku', 'SKU', true],
    ['category', 'Categoría', false],
    ['zone', 'Zona', false],
    ['supplier', 'Proveedor', false],
    ['numberOfUnits', 'Número de unidades', false]
  ];

  stringFields.forEach(([field, label, isRequired]) => {
    if (!(field in payload)) {
      return;
    }

    const rawValue = payload[field];
    if (rawValue === null || rawValue === undefined) {
      if (isRequired) {
        errors.push(`${label} no puede estar vacío.`);
      } else {
        data[field] = null;
      }
      return;
    }

    const value = String(rawValue).trim();
    if (!value) {
      if (isRequired) {
        errors.push(`${label} no puede estar vacío.`);
      } else {
        data[field] = null;
      }
    } else {
      data[field] = value;
    }
  });

  const intFields = [
    ['minStock', 'Stock mínimo'],
    ['maxStock', 'Stock máximo'],
    ['currentStock', 'Stock actual']
  ];

  intFields.forEach(([field, label]) => {
    if (field in payload) {
      const parsed = Number(payload[field]);
      if (!Number.isFinite(parsed) || parsed < 0) {
        errors.push(`${label} debe ser un número positivo.`);
      } else {
        data[field] = Math.floor(parsed);
      }
    }
  });

  if ('unitPrice' in payload) {
    const parsed = Number(payload.unitPrice);
    if (!Number.isFinite(parsed) || parsed < 0) {
      errors.push('Precio unitario debe ser un número positivo.');
    } else {
      data.unitPrice = parsed;
    }
  }

  if ('expirationDate' in payload) {
    const raw = payload.expirationDate;
    if (raw === null || raw === '') {
      data.expirationDate = null;
    } else {
      const parsed = new Date(raw);
      if (Number.isNaN(parsed.getTime())) {
        errors.push('La fecha de caducidad no es válida.');
      } else {
        data.expirationDate = parsed;
      }
    }
  }

  const nextMin = data.minStock ?? currentProduct.minStock ?? null;
  const nextMax = data.maxStock ?? currentProduct.maxStock ?? null;
  if (nextMin !== null && nextMax !== null && nextMin > nextMax) {
    errors.push('El stock mínimo no puede ser mayor que el stock máximo.');
  }

  if (!Object.keys(data).length) {
    errors.push('No se enviaron cambios válidos.');
  }

  if (errors.length) {
    throw new ValidationError('Datos de producto inválidos', errors);
  }

  return data;
}

const SKU_SANITIZE_REGEX = /[^A-Z0-9]+/g;

function parseDateOrNull(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildSkuFromBase(baseValue, index, nonce) {
  const fallback = `OCR-${nonce}-${index + 1}`;
  if (!baseValue) return fallback.slice(0, 40);
  const normalized = String(baseValue)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(SKU_SANITIZE_REGEX, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const slug = normalized || `ITEM-${index + 1}`;
  return `${slug}-${nonce}-${index + 1}`.slice(0, 40);
}

function normalizeOcrProduct(producto, index, metadata = {}, nonce = '') {
  const errors = [];
  if (!producto || typeof producto !== 'object') {
    return { errors: ['Formato de producto inválido.'], data: null };
  }

  const descripcion = String(producto.descripcion || '').trim();
  if (!descripcion) {
    errors.push('La descripción es obligatoria.');
  }

  const sku = buildSkuFromBase(producto.codigo || descripcion, index, nonce || Date.now().toString(36).toUpperCase());
  const cantidad = Number(producto.cantidad);
  const stock = Number.isFinite(cantidad) && cantidad > 0 ? Math.floor(cantidad) : 0;
  const minStock = stock > 0 ? Math.max(1, Math.floor(stock * 0.5)) : 0;
  const maxStock = stock > 0 ? Math.max(stock, minStock + 5) : 50;
  const numberOfUnits = producto.peso_volumen || producto.unidad || null;
  const expirationDate = parseDateOrNull(producto.caducidad);
  const priceCandidate = Number(producto.precioUnitario ?? producto.unitPrice ?? 0);
  const unitPrice = Number.isFinite(priceCandidate) && priceCandidate >= 0 ? Number(priceCandidate.toFixed(2)) : 0;

  const data = {
    sku,
    name: descripcion || sku,
    unitPrice,
    currentStock: stock,
    minStock,
    maxStock,
    numberOfUnits,
    expirationDate,
    supplier: metadata?.proveedor || null,
    location: metadata?.destinatario || null,
    zone: null,
    barcode: producto.codigo || null
  };

  return { errors, data };
}

async function fetchVolumeSpecs() {
  // Volume specs table/model was removed, so short-circuit to keep /api/space stable.
  return [];
}

async function fetchZones() {
  if (!prisma.zone?.findMany) {
    console.warn('Zone model not available in Prisma client; returning empty zone list.');
    return [];
  }

  try {
    return await prisma.zone.findMany({
      where: { active: true },
      orderBy: { code: 'asc' }
    });
  } catch (error) {
    if (error.code === 'P2021' || error.code === 'P2022') {
      console.warn(`Zones schema mismatch (${error.code}); continuing with zero zones.`);
      return [];
    }
    throw error;
  }
}

function zoneCapacityM3(zone = {}) {
  const direct = Number(zone.capacity_m3 ?? zone.capacity ?? zone.capacityM3);
  if (Number.isFinite(direct) && direct > 0) {
    return direct;
  }

  const area = Number(zone.area ?? zone.squareMeters ?? 0);
  const height = Number(zone.height ?? zone.maxHeight ?? 0);
  if (area > 0 && height > 0) {
    return Number((area * height).toFixed(2));
  }

  return 100; // fallback capacity so UI remains functional even without metadata
}

function toMeters(rawValue) {
  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }
  if (numeric > 20) {
    return numeric / 100; // assume centimeters if value is large
  }
  return numeric;
}

function calcOccupiedVolumeM3(quantity, spec = {}, eta = {}) {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    return { occupiedM3: 0, honeycombLossM3: 0 };
  }

  const length = toMeters(spec.unitL ?? spec.length ?? eta.unitL ?? eta.length);
  const width = toMeters(spec.unitW ?? spec.width ?? eta.unitW ?? eta.width);
  const height = toMeters(spec.unitH ?? spec.height ?? eta.unitH ?? eta.height);

  const baseVolume = (length > 0 && width > 0 && height > 0)
    ? length * width * height
    : 0.01; // 10L default placeholder

  const occupiedM3 = qty * baseVolume;
  const honeycombRatio = Math.min(
    Math.max(Number(eta.honeycombLossRatio ?? eta.honeycomb ?? 0.08), 0),
    0.35
  );
  const honeycombLossM3 = occupiedM3 * honeycombRatio;

  return {
    occupiedM3,
    honeycombLossM3
  };
}

// ===== Invoice Processing Pipeline =====
async function runOCR(filePath) {
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath), {
      filename: path.basename(filePath),
      contentType: 'application/pdf'
    });

    const response = await axios.post(
      `${OCR_SERVICE_URL}/api/extract-albaran`,
      form,
      {
        headers: form.getHeaders(),
        timeout: 120000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    const payload = response.data || {};
    const candidates = [
      payload.raw_text,
      payload.text,
      payload.ocr_text,
      payload?.data?.raw_text,
      payload?.data?.texto,
      payload?.data?.textoPlano,
      payload?.message
    ];
    const firstText = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
    if (firstText) {
      return firstText;
    }

    // As a fallback, stringify the structured payload so the LLM still receives context
    return JSON.stringify(payload);
  } catch (error) {
    console.error('Error solicitando OCR remoto:', error.message || error);
    throw new Error('Servicio OCR no disponible');
  }
}

async function interpretWithOllama(text) {
  try {
    const response = await axios.post('http://localhost:11434/api/generate', {
      model: OLLAMA_MODEL, // Configurable vía variable de entorno
      prompt: `Eres un asistente de extracción de facturas.
      
Extrae la siguiente información en formato JSON:
- numero_factura
- fecha
- proveedor
- nif_cif
- subtotal
- iva
- total

Texto de la factura:
${text}

Devuelve SOLO el JSON, sin explicaciones.`,
      stream: false
    });
    
    // Ollama devuelve un objeto con la propiedad 'response' que contiene el texto generado
    const resultText = response.data.response;
    
    // Intentar limpiar el resultado si contiene bloques de código markdown
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? jsonMatch[0] : resultText;
    
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error interpretando con Ollama:', error);
    throw error;
  }
}

async function processInvoicePDF(filePath) {
  let text = '';

  try {
    // PASO 1: Intentar extraer texto nativo
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdf(dataBuffer);
    text = pdfData.text;

    // Si el PDF está vacío o tiene muy poco texto → es imagen escaneada
    if (!text || text.trim().length < 50) {
      console.log('PDF escaneado o sin texto, usando OCR...');
      // PASO 2: Fallback al servicio OCR remoto
      text = await runOCR(filePath);
    }
  } catch (error) {
    console.error('Error procesando PDF:', error);
    return { success: false, error: 'Error leyendo el PDF', rawText: text };
  }

  // PASO 3: Interpretar con Ollama
  try {
    const invoiceData = await interpretWithOllama(text);
    return { success: true, invoice: invoiceData, rawText: text };
  } catch (error) {
    console.error('Error en interpretación IA:', error);
    return { success: false, error: 'Falló la interpretación de la factura', rawText: text };
  }
}

function buildInvoiceJsonFilename(originalName = 'factura') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = path.parse(originalName).name || 'factura';
  const slug = base
    .normalize('NFD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${timestamp}-${slug || 'factura'}.json`;
}

// ===== API Endpoints =====

// 📦 GET: Obtener todos los productos
app.get('/api/products', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' }
    });
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Error fetching products' });
  }
});

// 🚨 GET: Obtener alertas activas
app.get('/api/alerts', async (req, res) => {
  try {
    const alerts = await prisma.alert.findMany({
      where: { resolved: false },
      include: { product: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Error fetching alerts' });
  }
});

// 📊 GET: KPIs del dashboard
app.get('/api/kpis', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      select: {
        currentStock: true,
        minStock: true,
        unitPrice: true
      }
    });

    const totalProducts = products.reduce((sum, p) => sum + (p.currentStock || 0), 0);
    const totalValue = products.reduce(
      (sum, p) => sum + (p.currentStock || 0) * Number(p.unitPrice || 0),
      0
    );
    const criticalStock = products.filter(
      p => (p.currentStock || 0) <= (p.minStock || 0) * 0.5
    ).length;

    const alertsCount = await prisma.alert.count({
      where: { resolved: false }
    });

    const warehouseConfig = await prisma.warehouseConfig.findFirst();
    const totalCapacity = warehouseConfig?.totalCapacity && warehouseConfig.totalCapacity > 0
      ? warehouseConfig.totalCapacity
      : 1000;
    const occupiedPercentage = totalCapacity
      ? Math.min((totalProducts / totalCapacity) * 100, 100)
      : null;

    res.json({
      totalProducts,
      totalValue,
      alertsCount,
      criticalStock,
      warehouseConfig: warehouseConfig
        ? {
            totalCapacity,
            occupiedPercentage
          }
        : null
    });
  } catch (error) {
    console.error('Error calculating KPIs:', error);
    res.status(500).json({ error: 'Error calculating KPIs' });
  }
});

// 🧾 GET: Facturas próximas
app.get('/api/invoices', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const invoicesRaw = await prisma.invoice.findMany({
      where: {
        deletedAt: null,
        limitDate: {
          gte: today,
          lte: nextWeek
        }
      },
      orderBy: { limitDate: 'asc' }
    });

    const invoices = invoicesRaw
      .map((invoice) => ({
        ...invoice,
        status: normalizeInvoiceStatus(invoice.status)
      }))
      .filter((invoice) => DISPLAYED_INVOICE_STATUSES.has(invoice.status));

    res.json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Error fetching invoices' });
  }
});

// ✅ GET: Tareas
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Error fetching tasks' });
  }
});

// 🧾 DELETE: Factura
app.delete('/api/invoices/:id', protect, validateUUID, async (req, res) => {
  const { id } = req.params;
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: { deletedAt: true }
    });

    if (!invoice || invoice.deletedAt) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    await prisma.invoice.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
    res.status(204).end();
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ error: 'Error deleting invoice' });
  }
});

// ✅ DELETE: Tarea
app.delete('/api/tasks/:id', protect, validateUUID, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.task.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    console.error('Error deleting task:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Task not found' });
    } else {
      res.status(500).json({ error: 'Error deleting task' });
    }
  }
});

// 📋 POST: Crear producto
app.post('/api/products', protect, async (req, res) => {
  try {
    // Minimal inline validation (replace with Zod later)
    const { sku, name, unitPrice } = req.body || {};
    const errors = [];
    if (!sku || typeof sku !== 'string' || !sku.trim()) errors.push('SKU es obligatorio.');
    if (!name || typeof name !== 'string' || !name.trim()) errors.push('Nombre es obligatorio.');
    const price = Number(unitPrice);
    if (!Number.isFinite(price) || price < 0) errors.push('unitPrice debe ser un número positivo.');
    if (errors.length) return res.status(400).json({ error: 'Validación fallida', details: errors });

    const product = await prisma.product.create({ data: { ...req.body, unitPrice: price } });
    res.status(201).json(product);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'SKU ya existe' });
    }
    res.status(500).json({ error: 'Error creating product' });
  }
});

// 📤 POST: Subir archivo a OCR Python
app.post('/api/ocr/upload', protect, handleOcrUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se envió ningún archivo.' });
    }

    console.log('Reenviando archivo a OCR:', req.file.originalname);
    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    const response = await axios.post(
      `${OCR_SERVICE_URL}/api/extract-albaran`,
      formData,
      {
        headers: formData.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 120000
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Error en proxy OCR:', error.message || error);
    if (error.response) {
      return res.status(error.response.status).json({
        error: 'Error del servicio OCR',
        details: error.response.data
      });
    }
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'Servicio OCR no disponible',
        details: 'Verifica que el servicio Python esté corriendo.'
      });
    }
    if (error.message && error.message.includes('Tipo de archivo no soportado')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Error procesando archivo', details: error.message || 'Error desconocido' });
  }
});

// 🧠 POST: Procesar factura con IA Híbrida (Local)
app.post('/api/invoices/process', protect, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se envió ningún archivo.' });
  }

  const tempPath = path.join(os.tmpdir(), `upload-${Date.now()}.pdf`);
  
  try {
    fs.writeFileSync(tempPath, req.file.buffer);

    const extraction = await processInvoicePDF(tempPath);
    const jsonFilename = buildInvoiceJsonFilename(req.file.originalname);
    fs.mkdirSync(INVOICE_JSON_DIR, { recursive: true });

    const payloadToPersist = {
      processedAt: new Date().toISOString(),
      sourceFile: {
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype
      },
      success: Boolean(extraction?.success),
      error: extraction?.error || null,
      invoice: extraction?.invoice || null,
      rawText: extraction?.rawText || ''
    };

    const savedPath = path.join(INVOICE_JSON_DIR, jsonFilename);
    fs.writeFileSync(savedPath, JSON.stringify(payloadToPersist, null, 2), 'utf8');

    const responseBody = {
      success: payloadToPersist.success,
      invoice: payloadToPersist.invoice,
      error: payloadToPersist.error,
      rawText: payloadToPersist.rawText,
      sourceFile: payloadToPersist.sourceFile,
      savedJson: path.join('uploads', 'invoices', jsonFilename).replace(/\\/g, '/')
    };

    const statusCode = responseBody.success ? 200 : 422;
    res.status(statusCode).json(responseBody);
  } catch (error) {
    console.error('Error en endpoint de procesamiento:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
});

// 🤖 POST: Importar productos desde OCR
app.post('/api/import/ocr-products', protect, async (req, res) => {
  try {
    const { snapshotId, productos, metadata, confirmedIndices } = req.body || {};

    if (!Array.isArray(productos) || productos.length === 0) {
      return res.status(400).json({ error: 'No se enviaron productos para importar.' });
    }

    if (!Array.isArray(confirmedIndices) || confirmedIndices.length < 2) {
      return res.status(400).json({ error: 'Debes confirmar al menos 2 productos antes de importar.' });
    }

    if (snapshotId) {
      const snapshotPath = path.join(OCR_SNAPSHOT_DIR, `${snapshotId}.json`);
      if (!fs.existsSync(snapshotPath)) {
        return res.status(404).json({ error: 'Snapshot no encontrado. Vuelve a procesar el archivo.' });
      }
    }

    const nonce = Date.now().toString(36).toUpperCase();
    const normalizedEntries = productos.map((producto, index) => {
      const normalized = normalizeOcrProduct(producto, index, metadata, nonce);
      return { index, ...normalized };
    });

    const invalid = normalizedEntries
      .filter((entry) => entry.errors.length)
      .map((entry) => ({ index: entry.index, errors: entry.errors }));

    const validEntries = normalizedEntries.filter((entry) => !entry.errors.length);
    if (!validEntries.length) {
      return res.status(400).json({ error: 'No hay productos válidos para importar.', invalid });
    }

    const summary = {
      inserted: 0,
      duplicates: [],
      invalid,
      createdIds: [],
      total: productos.length
    };

    for (const entry of validEntries) {
      try {
        const created = await prisma.product.create({ data: entry.data });
        summary.inserted += 1;
        summary.createdIds.push(created.id);
      } catch (error) {
        if (error.code === 'P2002') {
          summary.duplicates.push(entry.data.sku);
        } else {
          console.error('Error inserting OCR product:', error);
          return res.status(500).json({ error: 'Error creando productos desde OCR' });
        }
      }
    }

    summary.skipped = summary.invalid.length + summary.duplicates.length;
    res.json(summary);
  } catch (error) {
    console.error('Error importing OCR products:', error);
    res.status(500).json({ error: 'Error importing OCR products' });
  }
});

// ✏️ PUT: Actualizar detalles de producto
app.put('/api/products/:id', protect, validateUUID, async (req, res) => {
  const { id } = req.params;
  try {
    const currentProduct = await prisma.product.findUnique({
      where: { id },
      select: {
        minStock: true,
        maxStock: true,
        deletedAt: true
      }
    });

    if (!currentProduct || currentProduct.deletedAt) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const updateData = buildProductUpdateData(req.body, currentProduct);
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: updateData
    });
    res.json(updatedProduct);
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message, details: error.details });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'SKU already exists' });
    }
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Error updating product' });
  }
});

// 🗑️ DELETE: Producto (soft delete)
app.delete('/api/products/:id', protect, validateUUID, async (req, res) => {
  const { id } = req.params;
  try {
    const product = await prisma.product.findUnique({
      where: { id },
      select: { deletedAt: true }
    });

    if (!product || product.deletedAt) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
    res.status(204).end();
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Error deleting product' });
  }
});

// 🔄 PUT: Actualizar stock de producto
app.put('/api/products/:id/stock', protect, validateUUID, async (req, res) => {
  try {
    const { id } = req.params;
    const { cantidad, tipo, motivo } = req.body;

    if (typeof cantidad !== 'number' || Number.isNaN(cantidad) || cantidad <= 0) {
      return res.status(400).json({ error: 'cantidad must be a positive number' });
    }

    if (tipo !== 'entrada' && tipo !== 'salida') {
      return res.status(400).json({ error: "tipo must be 'entrada' or 'salida'" });
    }

    const currentProduct = await prisma.product.findUnique({
      where: { id },
      select: { currentStock: true, deletedAt: true }
    });

    if (!currentProduct || currentProduct.deletedAt) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const quantityBefore = currentProduct.currentStock ?? 0;
    const quantityAfter = tipo === 'entrada'
      ? quantityBefore + cantidad
      : quantityBefore - cantidad;

    if (quantityAfter < 0) {
      return res.status(400).json({ error: 'Stock cannot be negative' });
    }

    const [product] = await prisma.$transaction([
      prisma.product.update({
        where: { id },
        data: { currentStock: quantityAfter }
      }),
      prisma.stockMovement.create({
        data: {
          productId: id,
          movementType: tipo,
          quantity: cantidad,
          quantityBefore,
          quantityAfter,
          reference: motivo,
          notes: motivo
        }
      })
    ]);

    res.json(product);
  } catch (error) {
    console.error('Error updating stock:', error);
    res.status(500).json({ error: 'Error updating stock', details: error.message });
  }
});

// ===== Space occupancy by zone (m³) =====
app.get('/api/space', async (req, res) => {
  try {
    const [zones, products, volumeSpecs] = await Promise.all([
      fetchZones(),
      prisma.product.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          currentStock: true,
          zone: true,
          name: true,
          sku: true
        }
      }),
      fetchVolumeSpecs()
    ]);

    const volumeSpecMap = new Map(volumeSpecs.map(spec => [spec.productId, spec]));

    // Build zone map and initialize aggregates
    const zoneMap = new Map();
    zones.forEach(z => {
      const cap = zoneCapacityM3(z);
      const eta = (z.eta && typeof z.eta === 'object') ? z.eta : {};
      zoneMap.set(z.code, {
        code: z.code,
        name: z.name,
        capacity_m3: cap,
        eta,
        occupied_m3: 0,
        honeycomb_loss_m3: 0,
        items: 0
      });
    });

    // Aggregate product volumes per zone
    products.forEach(p => {
      const zcode = p.zone || 'UNASSIGNED';
      if (!zoneMap.has(zcode)) {
        // Create a synthetic zone bucket for unassigned/unknown zones with zero capacity
        zoneMap.set(zcode, { code: zcode, name: zcode, capacity_m3: 0, eta: {}, occupied_m3: 0, honeycomb_loss_m3: 0, items: 0 });
      }
      const bucket = zoneMap.get(zcode);
      const eta = bucket.eta || {};
      const qty = Number(p.currentStock || 0);
      const spec = volumeSpecMap.get(p.id) || {};
      if (qty > 0 && spec && (spec.unitL || spec.unitW || spec.unitH)) {
        const { occupiedM3, honeycombLossM3 } = calcOccupiedVolumeM3(qty, spec, eta);
        bucket.occupied_m3 += occupiedM3;
        bucket.honeycomb_loss_m3 += honeycombLossM3;
        bucket.items += 1;
      }
    });

    // Build response with percents and totals
    const zonesOut = [];
    let totalCapacity = 0, totalOccupied = 0, totalLoss = 0;
    for (const z of zoneMap.values()) {
      const cap = Math.max(0, z.capacity_m3);
      const occ = Math.min(Math.max(0, z.occupied_m3), cap || Number.MAX_SAFE_INTEGER);
      const available = Math.max(0, cap - occ);
      const pctOcc = cap > 0 ? (occ / cap) * 100 : 0;
      zonesOut.push({
        code: z.code,
        name: z.name,
        capacity_m3: Number(cap.toFixed(2)),
        occupied_m3: Number(occ.toFixed(2)),
        available_m3: Number(available.toFixed(2)),
        pct_occupied: Number(pctOcc.toFixed(1)),
        honeycomb_loss_m3: Number(z.honeycomb_loss_m3.toFixed(2)),
        items: z.items
      });
      totalCapacity += cap;
      totalOccupied += occ;
      totalLoss += z.honeycomb_loss_m3;
    }

    const pctTotalOcc = totalCapacity > 0 ? (totalOccupied / totalCapacity) * 100 : 0;

    res.json({
      zones: zonesOut,
      totals: {
        capacity_m3: Number(totalCapacity.toFixed(2)),
        occupied_m3: Number(totalOccupied.toFixed(2)),
        available_m3: Number(Math.max(0, totalCapacity - totalOccupied).toFixed(2)),
        pct_occupied: Number(pctTotalOcc.toFixed(1)),
        honeycomb_loss_m3: Number(totalLoss.toFixed(2))
      }
    });
  } catch (error) {
    console.error('Error calculating space occupancy:', error);
    res.status(500).json({ error: 'Error calculating space occupancy' });
  }
});

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Iniciar servidor
const server = app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📦 Easy Stock con Prisma + PostgreSQL`);
}).on('error', (err) => {
  console.error('❌ Error al iniciar:', err);
});

// Graceful shutdown
async function shutdown(signal){
  console.log(`\n${signal} recibido. Cerrando servidor...`);
  try {
    await prisma.$disconnect();
  } catch(e) {
    console.error('Error al desconectar Prisma:', e);
  }
  server.close(() => process.exit(0));
}
['SIGINT','SIGTERM'].forEach(sig => process.on(sig, () => shutdown(sig)));
