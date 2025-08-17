import initSqlJs from 'sql.js'

class MaterialDB {
  static db = null
  static initialized = false

  static async init() {
    if (this.initialized && this.db) return

    const baseUrls = [
      'https://sql.js.org/dist/',
      'https://cdn.jsdelivr.net/npm/sql.js@1.10.2/dist/',
      'https://unpkg.com/sql.js@1.10.2/dist/'
    ]

    let lastError = null

    for (const base of baseUrls) {
      try {
        const SQL = await initSqlJs({
          locateFile: file => `${base}${file}`
        })

        // 尝试从localStorage加载数据库（容错处理）
        const savedData = localStorage.getItem('materialsDB')
        if (savedData) {
          try {
            const parsed = JSON.parse(savedData)
            const data = new Uint8Array(parsed)
            this.db = new SQL.Database(data)
          } catch (e) {
            console.warn('本地数据库恢复失败，已重置为空数据库:', e)
            localStorage.removeItem('materialsDB')
            this.db = new SQL.Database()
            this.createTables()
          }
        } else {
          this.db = new SQL.Database()
          this.createTables()
        }

        this.initialized = true
        return
      } catch (error) {
        console.error(`数据库初始化失败，尝试来源: ${base}`)
        console.error(error)
        lastError = error
        // 继续尝试下一个来源
      }
    }

    // 所有来源均失败
    this.initialized = false
    this.db = null
    throw (lastError || new Error('数据库初始化失败'))
  }

  static createTables() {
    // 创建物资表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS materials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        specification TEXT,
        unit TEXT NOT NULL,
        current_stock INTEGER DEFAULT 0,
        min_stock INTEGER DEFAULT 0,
        max_stock INTEGER DEFAULT 0,
        unit_price REAL DEFAULT 0,
        location TEXT,
        supplier TEXT,
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 创建入库记录表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS inbound_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        material_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL DEFAULT 0,
        total_amount REAL DEFAULT 0,
        supplier TEXT,
        batch_number TEXT,
        production_date DATE,
        expiry_date DATE,
        operator TEXT NOT NULL,
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (material_id) REFERENCES materials(id)
      )
    `)

    // 创建出库记录表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS outbound_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        material_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        purpose TEXT,
        department TEXT,
        recipient TEXT NOT NULL,
        operator TEXT NOT NULL,
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (material_id) REFERENCES materials(id)
      )
    `)

    // 创建订单表（与 OrderManagement.vue 字段一致）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT UNIQUE NOT NULL,
        supplier TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        total_amount REAL DEFAULT 0,
        order_date DATE NOT NULL,
        expected_date DATE,
        actual_date DATE,
        operator TEXT NOT NULL,
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 初次创建后持久化一次
    this.saveDatabase()
  }

  static saveDatabase() {
    if (this.db) {
      const data = this.db.export()
      localStorage.setItem('materialsDB', JSON.stringify(Array.from(data)))
    }
  }

  static executeQuery(sql, params = []) {
    if (!this.db) {
      throw new Error('数据库未初始化')
    }
    
    const stmt = this.db.prepare(sql)
    if (params.length > 0) {
      stmt.bind(params)
    }
    
    const result = []
    while (stmt.step()) {
      result.push(stmt.getAsObject())
    }
    stmt.free()
    return result
  }

  static executeUpdate(sql, params = []) {
    if (!this.db) {
      throw new Error('数据库未初始化')
    }
    
    const stmt = this.db.prepare(sql)
    if (params.length > 0) {
      stmt.bind(params)
    }
    stmt.step()
    stmt.free()
    this.saveDatabase()
    return { changes: 1 }
  }

  // 物资管理
  static getAllMaterials() {
    return this.executeQuery('SELECT * FROM materials ORDER BY name')
  }

  static getMaterialById(id) {
    const result = this.executeQuery('SELECT * FROM materials WHERE id = ?', [id])
    return result.length > 0 ? result[0] : null
  }

  static addMaterial(material) {
    const sql = `
      INSERT INTO materials (name, category, specification, unit, current_stock, min_stock, max_stock, unit_price, location, supplier, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    this.executeUpdate(sql, [
      material.name, material.category, material.specification || '', material.unit,
      material.current_stock || 0, material.min_stock || 0, material.max_stock || 0,
      material.unit_price || 0, material.location || '', material.supplier || '', material.remark || ''
    ])
    return { lastInsertRowid: this.getLastInsertId() }
  }

  static updateMaterial(id, material) {
    const sql = `
      UPDATE materials 
      SET name = ?, category = ?, specification = ?, unit = ?, min_stock = ?, max_stock = ?, unit_price = ?, location = ?, supplier = ?, remark = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `
    return this.executeUpdate(sql, [
      material.name, material.category, material.specification || '', material.unit,
      material.min_stock, material.max_stock, material.unit_price, 
      material.location || '', material.supplier || '', material.remark || '', id
    ])
  }

  static deleteMaterial(id) {
    return this.executeUpdate('DELETE FROM materials WHERE id = ?', [id])
  }

  static updateStock(materialId, quantity) {
    return this.executeUpdate(
      'UPDATE materials SET current_stock = current_stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [quantity, materialId]
    )
  }

  // 入库管理
  static addInboundRecord(record) {
    const sql = `
      INSERT INTO inbound_records (material_id, quantity, unit_price, total_amount, supplier, batch_number, production_date, expiry_date, operator, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    this.executeUpdate(sql, [
      record.material_id, record.quantity, record.unit_price || 0,
      record.total_amount || 0, record.supplier || '', record.batch_number || '',
      record.production_date || null, record.expiry_date || null,
      record.operator, record.remark || ''
    ])
    
    // 更新库存
    this.updateStock(record.material_id, record.quantity)
    return { lastInsertRowid: this.getLastInsertId() }
  }

  static getInboundRecords(limit = 100) {
    const sql = `
      SELECT ir.*, m.name as material_name, m.unit, m.category
      FROM inbound_records ir
      LEFT JOIN materials m ON ir.material_id = m.id
      ORDER BY ir.created_at DESC
      LIMIT ?
    `
    return this.executeQuery(sql, [limit])
  }

  static getOutboundRecords(limit = 100) {
    const sql = `
      SELECT or_.*, m.name as material_name, m.unit, m.category
      FROM outbound_records or_
      LEFT JOIN materials m ON or_.material_id = m.id
      ORDER BY or_.created_at DESC
      LIMIT ?
    `
    return this.executeQuery(sql, [limit])
  }

  static addOutboundRecord(record) {
    const sql = `
      INSERT INTO outbound_records (material_id, quantity, purpose, department, recipient, operator, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    this.executeUpdate(sql, [
      record.material_id, record.quantity,
      record.purpose || '', record.department || '', record.recipient || '',
      record.operator || '', record.remark || ''
    ])

    // 更新库存：出库为负数
    this.updateStock(record.material_id, -Math.abs(record.quantity))
    return { lastInsertRowid: this.getLastInsertId() }
  }

  // 订单管理
  static getAllOrders() {
    return this.executeQuery('SELECT * FROM orders ORDER BY created_at DESC')
  }

  static addOrder(order) {
    const sql = `
      INSERT INTO orders (order_number, supplier, status, total_amount, order_date, expected_date, operator, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    this.executeUpdate(sql, [
      order.order_number,
      order.supplier,
      order.status || 'pending',
      order.total_amount || 0,
      order.order_date,
      order.expected_date || null,
      order.operator,
      order.remark || ''
    ])
    return { lastInsertRowid: this.getLastInsertId() }
  }

  static updateOrderStatus(id, status, actualDate = null) {
    return this.executeUpdate(
      'UPDATE orders SET status = ?, actual_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, actualDate, id]
    )
  }

  // 库存预警
  static getLowStockMaterials() {
    return this.executeQuery('SELECT * FROM materials WHERE current_stock <= min_stock')
  }

  // 统计信息
  static getStatistics() {
    const totalMaterials = this.executeQuery('SELECT COUNT(*) as count FROM materials')[0]?.count || 0
    const lowStockCount = this.executeQuery('SELECT COUNT(*) as count FROM materials WHERE current_stock <= min_stock')[0]?.count || 0
    const totalValue = this.executeQuery('SELECT SUM(current_stock * unit_price) as value FROM materials')[0]?.value || 0
    
    return {
      totalMaterials,
      lowStockCount,
      totalValue
    }
  }

  static getLastInsertId() {
    const result = this.executeQuery('SELECT last_insert_rowid() as id')
    return result[0]?.id || 0
  }
}

export { MaterialDB }