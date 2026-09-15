import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseSeederService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseSeederService.name);
  private seeded = false;
  private readonly seedNamespace =
    process.env.DATABASE_SEED ?? 'cheapest-api-database-seeder';

  constructor(
    @Inject('DATA_SOURCE')
    private dataSource: DataSource,
  ) {}

  async onModuleInit() {
    if (!this.seeded) {
      await this.seed();
      this.seeded = true;
    }
  }

  private async seed() {
    try {
      // Check if data already exists
      const itemCount: { count: number }[] = await this.dataSource.query(
        'SELECT COUNT(*) as count FROM items_inventario',
      );

      if (itemCount[0].count > 0) {
        this.logger.log('Database already contains data. Skipping seed.');
        return;
      }

      this.logger.log(
        `Starting database seeding with namespace "${this.seedNamespace}"...`,
      );

      const id = (key: string) => this.generateSeededUuid(key);
      const seededIds = {
        // IDs fijos (no derivados del namespace): los specs e2e de logistica,
        // inventario y ventas referencian tienda1 por este UUID literal, y las
        // pruebas de carga necesitan IDs estables y conocidos de antemano.
        tienda1: '9a2f2e7b-40c4-4c5f-a37c-baf722e18ab9',
        tienda2: '9a2f2e7b-40c4-4c5f-a37c-baf722e18aba',
        itemInventario1: id('items-inventario:1'),
        itemInventario2: id('items-inventario:2'),
        itemInventario3: id('items-inventario:3'),
        itemInventario4: id('items-inventario:4'),
        itemInventario5: id('items-inventario:5'),
        registroCompra1: id('registros-compra:1'),
        registroCompra2: id('registros-compra:2'),
        registroCompra3: id('registros-compra:3'),
        registroCompra4: id('registros-compra:4'),
        registroCompra5: id('registros-compra:5'),
        registroVenta1: id('registros-venta:1'),
        registroVenta2: id('registros-venta:2'),
        registroVenta3: id('registros-venta:3'),
        registroVenta4: id('registros-venta:4'),
        registroVenta5: id('registros-venta:5'),
        registroVenta6: id('registros-venta:6'),
        producto1: id('productos:1'),
        producto2: id('productos:2'),
        producto3: id('productos:3'),
        producto4: id('productos:4'),
        catalogo1: id('catalogos:1'),
        catalogo2: id('catalogos:2'),
        promocion1: id('promociones:1'),
        promocion2: id('promociones:2'),
        promocionTienda1: id('promocion-tiendas:1'),
        promocionTienda2: id('promocion-tiendas:2'),
        promocionTienda3: id('promocion-tiendas:3'),
        promocionTienda4: id('promocion-tiendas:4'),
        pedido1: id('pedidos:1'),
        pedido2: id('pedidos:2'),
        itemPedido1: id('items-pedido:1'),
        itemPedido2: id('items-pedido:2'),
        itemPedido3: id('items-pedido:3'),
        itemPedido4: id('items-pedido:4'),
        despacho1: id('despachos:1'),
        disponibilidadZona1: id('disponibilidad-zona:1'),
        disponibilidadZona2: id('disponibilidad-zona:2'),
        disponibilidadZona3: id('disponibilidad-zona:3'),
        disponibilidadZona4: id('disponibilidad-zona:4'),
        notaCredito1: id('notas-credito:1'),
      };

      // ============================================
      // Seed Tiendas (Identificacion)
      // Deben ir primero: el resto de las entidades referencian su id.
      // ============================================
      await this.dataSource.query(`
        INSERT INTO tiendas (id, "codigoInterno", nombre, direccion, zona, rut, "createdAt", "updatedAt") VALUES
        ('${seededIds.tienda1}', 'TIENDA-001', 'Tienda Central', 'Calle Principal 123', 'Zona Norte', '76.123.456-7', NOW(), NOW()),
        ('${seededIds.tienda2}', 'TIENDA-002', 'Tienda Sur', 'Boulevard Sur 789', 'Zona Sur', '76.234.567-8', NOW(), NOW())
      `);

      // ============================================
      // Seed Items de Inventario
      // ============================================
      await this.dataSource.query(`
        INSERT INTO items_inventario (id, "productoId", "tiendaId", cantidad, "precioVenta", "monedaId", "createdAt", "updatedAt") VALUES
        ('${seededIds.itemInventario1}', '${seededIds.producto1}', '${seededIds.tienda1}', 100, 25.50, '550e8400-e29b-41d4-a716-446655440000', NOW(), NOW()),
        ('${seededIds.itemInventario2}', '${seededIds.producto2}', '${seededIds.tienda1}', 50, 15.75, '550e8400-e29b-41d4-a716-446655440000', NOW(), NOW()),
        ('${seededIds.itemInventario3}', '${seededIds.producto1}', '${seededIds.tienda2}', 75, 27.00, '550e8400-e29b-41d4-a716-446655440000', NOW(), NOW()),
        ('${seededIds.itemInventario4}', '${seededIds.producto3}', '${seededIds.tienda1}', 200, 10.00, '550e8400-e29b-41d4-a716-446655440000', NOW(), NOW()),
        ('${seededIds.itemInventario5}', '${seededIds.producto4}', '${seededIds.tienda2}', 150, 45.99, '550e8400-e29b-41d4-a716-446655440000', NOW(), NOW())
      `);

      // ============================================
      // Seed Registros de Compra
      // ============================================
      await this.dataSource.query(`
        INSERT INTO registros_compra_producto_tienda (id, "tiendaId", "productoId", "compraId", "itemInventarioId", "fechaCompra", cantidad, "createdAt", "updatedAt") VALUES
        ('${seededIds.registroCompra1}', '${seededIds.tienda1}', '${seededIds.producto1}', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', '${seededIds.itemInventario1}', '2026-01-15 10:30:00', 50, NOW(), NOW()),
        ('${seededIds.registroCompra2}', '${seededIds.tienda1}', '${seededIds.producto1}', 'dddddddd-dddd-4ddd-8ddd-ddddddddddde', '${seededIds.itemInventario1}', '2026-01-20 14:15:00', 50, NOW(), NOW()),
        ('${seededIds.registroCompra3}', '${seededIds.tienda1}', '${seededIds.producto2}', 'dddddddd-dddd-4ddd-8ddd-dddddddddddf', '${seededIds.itemInventario2}', '2026-01-18 09:00:00', 50, NOW(), NOW()),
        ('${seededIds.registroCompra4}', '${seededIds.tienda2}', '${seededIds.producto1}', 'dddddddd-dddd-4ddd-8ddd-ddddddddddda', '${seededIds.itemInventario3}', '2026-01-22 11:45:00', 75, NOW(), NOW()),
        ('${seededIds.registroCompra5}', '${seededIds.tienda1}', '${seededIds.producto3}', 'dddddddd-dddd-4ddd-8ddd-dddddddddddb', '${seededIds.itemInventario4}', '2026-01-25 16:20:00', 200, NOW(), NOW())
      `);

      // ============================================
      // Seed Registros de Venta
      // ============================================
      await this.dataSource.query(`
        INSERT INTO registros_venta_producto_tienda (id, "tiendaId", "productoId", "ventaId", "itemInventarioId", "fechaVenta", cantidad, "createdAt", "updatedAt") VALUES
        ('${seededIds.registroVenta1}', '${seededIds.tienda1}', '${seededIds.producto1}', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '${seededIds.itemInventario1}', '2026-01-28 10:30:00', 10, NOW(), NOW()),
        ('${seededIds.registroVenta2}', '${seededIds.tienda1}', '${seededIds.producto1}', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeef', '${seededIds.itemInventario1}', '2026-01-29 15:45:00', 15, NOW(), NOW()),
        ('${seededIds.registroVenta3}', '${seededIds.tienda1}', '${seededIds.producto2}', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee0', '${seededIds.itemInventario2}', '2026-01-30 12:00:00', 5, NOW(), NOW()),
        ('${seededIds.registroVenta4}', '${seededIds.tienda2}', '${seededIds.producto1}', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', '${seededIds.itemInventario3}', '2026-01-31 09:30:00', 20, NOW(), NOW()),
        ('${seededIds.registroVenta5}', '${seededIds.tienda1}', '${seededIds.producto3}', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2', '${seededIds.itemInventario4}', '2026-02-01 14:20:00', 25, NOW(), NOW()),
        ('${seededIds.registroVenta6}', '${seededIds.tienda2}', '${seededIds.producto4}', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3', '${seededIds.itemInventario5}', '2026-02-02 11:15:00', 10, NOW(), NOW())
      `);

      // ============================================
      // Seed Productos (Logística)
      // ============================================
      await this.dataSource.query(`
        INSERT INTO productos (id, "codigoInterno", "codigoBarras", nombre, marca, categoria, presentacion, "precioBase", "monedaId", "createdAt", "updatedAt") VALUES
        ('${seededIds.producto1}', 'PROD001', '1234567890123', 'Producto Ejemplo 1', 'Marca A', 'Categoria 1', 'Caja 10 unidades', 25.50, 'cccccccc-cccc-cccc-cccc-cccccccccccc', NOW(), NOW()),
        ('${seededIds.producto2}', 'PROD002', '1234567890124', 'Producto Ejemplo 2', 'Marca B', 'Categoria 1', 'Bolsa 5 kg', 15.75, 'cccccccc-cccc-cccc-cccc-cccccccccccc', NOW(), NOW()),
        ('${seededIds.producto3}', 'PROD003', '1234567890125', 'Producto Ejemplo 3', 'Marca A', 'Categoria 2', 'Botella 1L', 10.00, 'cccccccc-cccc-cccc-cccc-cccccccccccc', NOW(), NOW()),
        ('${seededIds.producto4}', 'PROD004', '1234567890126', 'Producto Ejemplo 4', 'Marca C', 'Categoria 2', 'Paquete 20 unidades', 45.99, 'cccccccc-cccc-cccc-cccc-cccccccccccc', NOW(), NOW())
      `);

      // ============================================
      // Seed Catálogos
      // ============================================
      await this.dataSource.query(`
        INSERT INTO catalogos (id, "tiendaId", "vigenciaDesde", "vigenciaHasta", zona, "createdAt", "updatedAt") VALUES
        ('${seededIds.catalogo1}', '${seededIds.tienda1}', NOW() - INTERVAL '30 days', NOW() + INTERVAL '335 days', 'Zona Norte', NOW(), NOW()),
        ('${seededIds.catalogo2}', '${seededIds.tienda2}', NOW() - INTERVAL '30 days', NOW() + INTERVAL '335 days', 'Zona Sur', NOW(), NOW())
      `);

      // ============================================
      // Seed Catálogo-Producto
      // TypeORM auto-generates the junction table as
      // "catalogos_productos_productos" with columns
      // "catalogosId" and "productosId"
      // ============================================
      await this.dataSource.query(`
        INSERT INTO "catalogos_productos_productos" ("catalogosId", "productosId") VALUES
        ('${seededIds.catalogo1}', '${seededIds.producto1}'),
        ('${seededIds.catalogo1}', '${seededIds.producto2}'),
        ('${seededIds.catalogo1}', '${seededIds.producto3}'),
        ('${seededIds.catalogo2}', '${seededIds.producto1}'),
        ('${seededIds.catalogo2}', '${seededIds.producto4}')
      `);

      // ============================================
      // Seed Promociones
      // ============================================
      await this.dataSource.query(`
        INSERT INTO promociones (id, nombre, "precioPromocional", "monedaId", "productoId", inicio, fin, restricciones, "createdAt", "updatedAt") VALUES
        ('${seededIds.promocion1}', 'Promoción Producto 1', 20.00, 'cccccccc-cccc-cccc-cccc-cccccccccccc', '${seededIds.producto1}', NOW() - INTERVAL '30 days', NOW() + INTERVAL '335 days', 100, NOW(), NOW()),
        ('${seededIds.promocion2}', 'Promoción Producto 2', 12.00, 'cccccccc-cccc-cccc-cccc-cccccccccccc', '${seededIds.producto2}', NOW() - INTERVAL '30 days', NOW() + INTERVAL '335 days', 50, NOW(), NOW())
      `);

      await this.dataSource.query(`
        INSERT INTO promocion_tiendas (id, "promocionId", "tiendaId") VALUES
        ('${seededIds.promocionTienda1}', '${seededIds.promocion1}', '${seededIds.tienda1}'),
        ('${seededIds.promocionTienda2}', '${seededIds.promocion2}', '${seededIds.tienda1}'),
        ('${seededIds.promocionTienda3}', '${seededIds.promocion2}', '${seededIds.tienda2}'),
        ('${seededIds.promocionTienda4}', '${seededIds.promocion1}', '${seededIds.tienda2}')
      `);

      // ============================================
      // Seed Pedidos
      // ============================================
      await this.dataSource.query(`
        INSERT INTO pedidos (id, identificador, "tiendaId", "fechaHoraCreacion", "montoTotal", "monedaId", estado, "createdAt", "updatedAt") VALUES
        ('${seededIds.pedido1}', 'PED-001', '${seededIds.tienda1}', '2026-02-03 10:00:00', 45.50, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'creado', NOW(), NOW()),
        ('${seededIds.pedido2}', 'PED-002', '${seededIds.tienda2}', '2026-02-03 11:00:00', 75.75, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'aprobado', NOW(), NOW())
      `);

      // ============================================
      // Seed Items de Pedido
      // ============================================
      await this.dataSource.query(`
        INSERT INTO items_pedido (id, "pedidoId", "productoId", cantidad, "precioUnitario", descuento, "monedaId", lote, "fechaVencimiento", "createdAt", "updatedAt") VALUES
        ('${seededIds.itemPedido1}', '${seededIds.pedido1}', '${seededIds.producto1}', 1, 25.50, 0.00, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'LOTE001', '2026-12-31', NOW(), NOW()),
        ('${seededIds.itemPedido2}', '${seededIds.pedido1}', '${seededIds.producto2}', 1, 20.00, 0.00, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'LOTE002', '2026-12-31', NOW(), NOW()),
        ('${seededIds.itemPedido3}', '${seededIds.pedido2}', '${seededIds.producto1}', 2, 25.50, 0.00, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'LOTE003', '2026-12-31', NOW(), NOW()),
        ('${seededIds.itemPedido4}', '${seededIds.pedido2}', '${seededIds.producto4}', 1, 45.99, 0.00, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'LOTE004', '2026-12-31', NOW(), NOW())
      `);

      // ============================================
      // Seed Despachos
      // ============================================
      await this.dataSource.query(`
        INSERT INTO despachos (id, "pedidoId", bodega, "horaSalida", "ventanaPrometidaInicio", "ventanaPrometidaFin", "createdAt", "updatedAt") VALUES
        ('${seededIds.despacho1}', '${seededIds.pedido2}', 'Bodega Central', '2026-02-03 14:00:00', '2026-02-03 15:00:00', '2026-02-03 17:00:00', NOW(), NOW())
      `);

      // ============================================
      // Seed Disponibilidad Zona
      // ============================================
      await this.dataSource.query(`
        INSERT INTO disponibilidad_zona (id, "catalogoId", "productoId", "cantidadDisponible", "ultimaActualizacion", "createdAt", "updatedAt") VALUES
        ('${seededIds.disponibilidadZona1}', '${seededIds.catalogo1}', '${seededIds.producto1}', 100, NOW(), NOW(), NOW()),
        ('${seededIds.disponibilidadZona2}', '${seededIds.catalogo1}', '${seededIds.producto2}', 50, NOW(), NOW(), NOW()),
        ('${seededIds.disponibilidadZona3}', '${seededIds.catalogo2}', '${seededIds.producto1}', 75, NOW(), NOW(), NOW()),
        ('${seededIds.disponibilidadZona4}', '${seededIds.catalogo2}', '${seededIds.producto4}', 150, NOW(), NOW(), NOW())
      `);

      // ============================================
      // Seed Notas de Crédito
      // ============================================
      await this.dataSource.query(`
        INSERT INTO notas_credito (id, "pedidoId", "numeroDocumento", fecha, motivo, monto, "monedaId", evidencia, "createdAt", "updatedAt") VALUES
        ('${seededIds.notaCredito1}', '${seededIds.pedido1}', 'NC-001', '2026-02-04', 'productoVencido', 5.50, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Producto vencido en entrega', NOW(), NOW())
      `);

      this.logger.log('✅ Database seeding completed successfully');
    } catch (error) {
      this.logger.error('❌ Error seeding database:', error);
      throw error;
    }
  }

  private generateSeededUuid(key: string): string {
    const hash = createHash('sha256')
      .update(`${this.seedNamespace}:${key}`)
      .digest();
    const bytes = Uint8Array.from(hash.subarray(0, 16));

    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Buffer.from(bytes).toString('hex');

    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32),
    ].join('-');
  }
}
