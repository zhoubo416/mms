import initSqlJs from 'sql.js'

class MaterialDB {
  static db = null
  static initialized = false

  static async init() {
    if (this.initialized && this.db) return

    // Electron/打包环境优先使用本地 wasm 资源，其次回退到 CDN
    const baseUrls = [
      // 打包后相对路径：dist/index.html -> dist/assets/sql-wasm.wasm（或 public/sql-wasm.wasm）
      './',
      '/sqljs/',
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
            // 对现有数据库执行迁移
            this.migrateDatabase()
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
        material_code TEXT,
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

    // 检查并添加 material_code 字段（用于数据库迁移）
    this.migrateDatabase()

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
      INSERT INTO materials (material_code, name, category, specification, unit, current_stock, min_stock, max_stock, unit_price, location, supplier, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    this.executeUpdate(sql, [
      material.material_code || '', material.name, material.category, material.specification || '', material.unit,
      material.current_stock || 0, material.min_stock || 0, material.max_stock || 0,
      material.unit_price || 0, material.location || '', material.supplier || '', material.remark || ''
    ])
    return { lastInsertRowid: this.getLastInsertId() }
  }

  static updateMaterial(id, material) {
    const sql = `
      UPDATE materials 
      SET material_code = ?, name = ?, category = ?, specification = ?, unit = ?, min_stock = ?, max_stock = ?, unit_price = ?, location = ?, supplier = ?, remark = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `
    return this.executeUpdate(sql, [
      material.material_code || '', material.name, material.category, material.specification || '', material.unit,
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

  // 根据物资编码查找物资
  static getMaterialByCode(code) {
    const result = this.executeQuery('SELECT * FROM materials WHERE material_code = ?', [code])
    return result.length > 0 ? result[0] : null
  }

  // 根据编码或名称搜索物资
  static searchMaterials(keyword) {
    const sql = `
      SELECT * FROM materials 
      WHERE material_code LIKE ? OR name LIKE ?
      ORDER BY name
      LIMIT 20
    `
    const searchTerm = `%${keyword}%`
    return this.executeQuery(sql, [searchTerm, searchTerm])
  }

  // 数据库迁移方法
  static migrateDatabase() {
    try {
      // 检查表结构
      const tableInfo = this.executeQuery("PRAGMA table_info(materials)")
      console.log('当前表结构:', tableInfo)
      
      const hasCodeField = tableInfo.some(column => column.name === 'material_code')
      const hasLocationField = tableInfo.some(column => column.name === 'location')
      const hasSupplierField = tableInfo.some(column => column.name === 'supplier')
      
      // 如果缺少关键字段，重建表
      if (!hasCodeField || !hasLocationField || !hasSupplierField) {
        console.log('检测到表结构不完整，开始重建表...')
        this.rebuildMaterialsTable()
      } else {
        console.log('表结构完整，无需迁移')
      }
    } catch (error) {
      console.warn('数据库迁移失败，尝试重建表:', error)
      this.rebuildMaterialsTable()
    }
  }

  // 重建物资表
  static rebuildMaterialsTable() {
    try {
      // 备份现有数据
      let existingData = []
      try {
        existingData = this.executeQuery('SELECT * FROM materials')
        console.log('备份了', existingData.length, '条现有数据')
      } catch (e) {
        console.log('无现有数据需要备份')
      }

      // 删除旧表
      this.db.exec('DROP TABLE IF EXISTS materials')
      
      // 创建新表
      this.db.exec(`
        CREATE TABLE materials (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          material_code TEXT,
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

      // 恢复数据
      if (existingData.length > 0) {
        console.log('开始恢复数据...')
        for (const item of existingData) {
          const sql = `
            INSERT INTO materials (
              name, category, specification, unit, current_stock, min_stock, max_stock, 
              unit_price, location, supplier, remark, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
          this.executeUpdate(sql, [
            item.name,
            item.category,
            item.specification || '',
            item.unit,
            item.current_stock || 0,
            item.min_stock || 0,
            item.max_stock || 0,
            item.unit_price || 0,
            item.location || '',
            item.supplier || '',
            item.remark || '',
            item.created_at,
            item.updated_at
          ])
        }
        console.log('数据恢复完成')
      }

      this.saveDatabase()
      console.log('表重建完成')
    } catch (error) {
      console.error('重建表失败:', error)
      throw error
    }
  }

  static getLastInsertId() {
    const result = this.executeQuery('SELECT last_insert_rowid() as id')
    return result[0]?.id || 0
  }
}

export { MaterialDB }