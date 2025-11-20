CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Para búsquedas difusas

-- CreateTable
CREATE TABLE "warehouse_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "warehouse_name" VARCHAR(255) DEFAULT 'Mi Almacén',
    "total_capacity" INTEGER DEFAULT 18,
    "units_of_measure" VARCHAR(50) DEFAULT 'm2',
    "total_zones" INTEGER DEFAULT 2,
    "expiry_warning_days" INTEGER DEFAULT 7,
    "max_health_score" INTEGER DEFAULT 100,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "max_capacity" INTEGER NOT NULL,
    "units_of_measure" VARCHAR(50) DEFAULT 'm2',
    "zone_type" VARCHAR(50) DEFAULT 'normal',
    "temperature_controlled" BOOLEAN DEFAULT false,
    "active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "sku" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "category" VARCHAR(100),
    "barcode" VARCHAR(100),
    "current_stock" INTEGER DEFAULT 0,
    "min_stock" INTEGER DEFAULT 10,
    "max_stock" INTEGER DEFAULT 100,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) DEFAULT 'EUR',
    "location" VARCHAR(100),
    "zone" VARCHAR(50),
    "expiration_date" DATE,
    "supplier" VARCHAR(255),
    "deleted_at" TIMESTAMP(6),
    "date_added" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "product_id" UUID,
    "movement_type" VARCHAR(20) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "quantity_before" INTEGER,
    "quantity_after" INTEGER,
    "reference" VARCHAR(100),
    "document_type" VARCHAR(50),
    "cost_per_unit" DECIMAL(10,2),
    "total_cost" DECIMAL(10,2),
    "created_by" UUID,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "product_id" UUID,
    "alert_type" VARCHAR(20) NOT NULL,
    "category" VARCHAR(50),
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "resolved" BOOLEAN DEFAULT false,
    "resolved_at" TIMESTAMP(6),
    "resolved_by" UUID,
    "auto_generated" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "invoice_number" VARCHAR(100) NOT NULL,
    "supplier_name" VARCHAR(255) NOT NULL,
    "nif_cif" VARCHAR(50),
    "subtotal" DECIMAL(10,2) NOT NULL,
    "tax_amount" DECIMAL(10,2) DEFAULT 0,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) DEFAULT 'EUR',
    "invoice_date" DATE NOT NULL,
    "limit_date" DATE NOT NULL,
    "paid_date" DATE,
    "status" VARCHAR(20) DEFAULT 'pendiente',
    "payment_method" VARCHAR(50),
    "payment_reference" VARCHAR(100),
    "file_path" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "title" VARCHAR(255) NOT NULL,
    "priority" VARCHAR(20) DEFAULT 'medium',
    "assigned_to" VARCHAR(255),
    "supervisor" VARCHAR(255),
    "phone" VARCHAR(50),
    "status" VARCHAR(20) DEFAULT 'pending',
    "due_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idx_warehouse_config_singleton" ON "warehouse_config"("id");

-- CreateIndex
CREATE UNIQUE INDEX "zones_code_key" ON "zones"("code");

-- CreateIndex
CREATE INDEX "idx_zones_code" ON "zones"("code");

-- CreateIndex
CREATE INDEX "idx_zones_active" ON "zones"("active");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "idx_products_category" ON "products"("category");

-- CreateIndex
CREATE INDEX "idx_products_location" ON "products"("location");

-- CreateIndex
CREATE INDEX "idx_products_expiration" ON "products"("expiration_date");

-- CreateIndex
CREATE INDEX "idx_products_stock" ON "products"("current_stock");

-- CreateIndex
CREATE INDEX "idx_products_deleted" ON "products"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_products_sku" ON "products"("sku");

-- CreateIndex
CREATE INDEX "idx_products_name_trgm" ON "products" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "idx_movements_product" ON "stock_movements"("product_id");

-- CreateIndex
CREATE INDEX "idx_movements_type" ON "stock_movements"("movement_type");

-- CreateIndex
CREATE INDEX "idx_movements_date" ON "stock_movements"("created_at");

-- CreateIndex
CREATE INDEX "idx_movements_reference" ON "stock_movements"("reference");

-- CreateIndex
CREATE INDEX "idx_alerts_product" ON "alerts"("product_id");

-- CreateIndex
CREATE INDEX "idx_alerts_type" ON "alerts"("alert_type");

-- CreateIndex
CREATE INDEX "idx_alerts_category" ON "alerts"("category");

-- CreateIndex
CREATE INDEX "idx_alerts_resolved" ON "alerts"("resolved");

-- CreateIndex
CREATE INDEX "idx_alerts_created" ON "alerts"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "idx_invoices_number" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "idx_invoices_supplier" ON "invoices"("supplier_name");

-- CreateIndex
CREATE INDEX "idx_invoices_due_date" ON "invoices"("limit_date");

-- CreateIndex
CREATE INDEX "idx_invoices_status" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "idx_tasks_priority" ON "tasks"("priority");

-- CreateIndex
CREATE INDEX "idx_tasks_status" ON "tasks"("status");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
