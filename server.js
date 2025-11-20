// server.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// ========== API ENDPOINTS ==========

// 📦 GET: Obtener todos los productos
app.get('/api/products', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
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
    const totalCapacity = warehouseConfig?.totalCapacity || 1000;
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
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['pendiente', 'vencida'] },
        limitDate: { lte: nextWeek }
      },
      orderBy: { limitDate: 'asc' }
    });
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
app.delete('/api/invoices/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.invoice.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    console.error('Error deleting invoice:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Invoice not found' });
    } else {
      res.status(500).json({ error: 'Error deleting invoice' });
    }
  }
});

// ✅ DELETE: Tarea
app.delete('/api/tasks/:id', async (req, res) => {
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

// 🔄 PUT: Actualizar stock de producto
app.put('/api/products/:id/stock', async (req, res) => {
  try {
    const { id } = req.params;
    const { cantidad, tipo, motivo } = req.body;

    // Actualizar stock y crear movimiento
    const [product, movement] = await prisma.$transaction([
      prisma.product.update({
        where: { id: parseInt(id) },
        data: {
          stock_actual: tipo === 'entrada' 
            ? { increment: cantidad }
            : { decrement: cantidad }
        }
      }),
      prisma.stockMovement.create({
        data: {
          productId: parseInt(id),
          tipo,
          cantidad,
          motivo
        }
      })
    ]);

    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Error updating stock' });
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
