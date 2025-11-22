// ===== Easy Stock API Server =====
// Serves the dashboard assets and exposes CRUD endpoints powered by Prisma.
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// ===== Middleware & Static Assets =====
app.use(express.json());
app.use(express.static(__dirname));

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
app.delete('/api/invoices/:id', validateUUID, async (req, res) => {
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
app.delete('/api/tasks/:id', validateUUID, async (req, res) => {
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
app.post('/api/products', async (req, res) => {
  try {
    const product = await prisma.product.create({
      data: req.body
    });
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: 'Error creating product' });
  }
});

// ✏️ PUT: Actualizar detalles de producto
app.put('/api/products/:id', validateUUID, async (req, res) => {
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
app.delete('/api/products/:id', validateUUID, async (req, res) => {
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
app.put('/api/products/:id/stock', validateUUID, async (req, res) => {
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

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📦 Easy Stock con Prisma + PostgreSQL`);
}).on('error', (err) => {
  console.error('❌ Error al iniciar:', err);
});

// Cerrar Prisma al apagar servidor
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
