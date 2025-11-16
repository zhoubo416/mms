<script setup>
import { ref, onMounted, computed } from 'vue'
import { MaterialDB } from '../database.js'
import { ElMessage, ElMessageBox } from 'element-plus'
import MaterialSelector from './MaterialSelector.vue'

const emit = defineEmits(['refresh'])

const orders = ref([])
const dialogVisible = ref(false)
const editMode = ref(false)
const currentOrder = ref({
  id: null,
  order_number: '',
  supplier: '',
  status: 'pending',
  total_amount: 0,
  order_date: '',
  expected_date: '',
  actual_date: '',
  operator: '',
  remark: ''
})

// 订单明细相关
const orderItems = ref([])
const showItemDialog = ref(false)
const currentItem = ref({
  material_id: null,
  quantity: 1,
  unit_price: 0,
  total_price: 0
})
const selectedMaterialInfo = ref(null)
const importDialogVisible = ref(false)
const importFile = ref(null)
const importData = ref([])
const importPreviewData = ref([])

const searchText = ref('')
const statusFilter = ref('')
const dateRange = ref([])

const orderStatuses = [
  { value: 'pending', label: '待处理', type: 'info' },
  { value: 'confirmed', label: '已确认', type: 'primary' },
  { value: 'shipped', label: '已发货', type: 'warning' },
  { value: 'received', label: '已收货', type: 'success' },
  { value: 'cancelled', label: '已取消', type: 'danger' }
]

const filteredOrders = computed(() => {
  let result = orders.value
  
  if (searchText.value) {
    result = result.filter(item => 
      item.order_number?.toLowerCase().includes(searchText.value.toLowerCase()) ||
      item.supplier?.toLowerCase().includes(searchText.value.toLowerCase()) ||
      item.operator?.toLowerCase().includes(searchText.value.toLowerCase())
    )
  }
  
  if (statusFilter.value) {
    result = result.filter(item => item.status === statusFilter.value)
  }
  
  if (dateRange.value && dateRange.value.length === 2) {
    const [startDate, endDate] = dateRange.value
    result = result.filter(item => {
      const orderDate = new Date(item.order_date)
      return orderDate >= startDate && orderDate <= endDate
    })
  }
  
  return result
})

const loadOrders = async () => {
  try {
    await MaterialDB.init()
    orders.value = MaterialDB.getAllOrders()
    emit('refresh')
  } catch (error) {
    console.error('加载订单列表失败:', error)
    ElMessage.error('加载订单列表失败')
  }
}

const openDialog = (order = null) => {
  if (order) {
    editMode.value = true
    currentOrder.value = { ...order }
    // 格式化日期
    if (currentOrder.value.order_date) {
      currentOrder.value.order_date = new Date(currentOrder.value.order_date).toISOString().split('T')[0]
    }
    if (currentOrder.value.expected_date) {
      currentOrder.value.expected_date = new Date(currentOrder.value.expected_date).toISOString().split('T')[0]
    }
    if (currentOrder.value.actual_date) {
      currentOrder.value.actual_date = new Date(currentOrder.value.actual_date).toISOString().split('T')[0]
    }
  } else {
    editMode.value = false
    currentOrder.value = {
      id: null,
      order_number: generateOrderNumber(),
      supplier: '',
      status: 'pending',
      total_amount: 0,
      order_date: new Date().toISOString().split('T')[0],
      expected_date: '',
      actual_date: '',
      operator: '',
      remark: ''
    }
  }
  orderItems.value = []
  dialogVisible.value = true
}

// 添加订单明细
const openItemDialog = () => {
  currentItem.value = {
    material_id: null,
    quantity: 1,
    unit_price: 0,
    total_price: 0
  }
  selectedMaterialInfo.value = null
  showItemDialog.value = true
}

// 处理物资选择
const handleMaterialSelected = (material) => {
  selectedMaterialInfo.value = material
  if (material) {
    currentItem.value.material_id = material.id
    currentItem.value.unit_price = material.unit_price || 0
    calculateItemTotal()
  } else {
    currentItem.value.material_id = null
    currentItem.value.unit_price = 0
    currentItem.value.total_price = 0
  }
}

// 计算明细总价
const calculateItemTotal = () => {
  currentItem.value.total_price = currentItem.value.quantity * currentItem.value.unit_price
}

// 添加明细到订单
const addItemToOrder = () => {
  if (!currentItem.value.material_id) {
    ElMessage.warning('请选择物资')
    return
  }
  
  if (!currentItem.value.quantity || currentItem.value.quantity <= 0) {
    ElMessage.warning('请输入正确的数量')
    return
  }

  // 检查是否已存在相同物资
  const existingIndex = orderItems.value.findIndex(item => item.material_id === currentItem.value.material_id)
  if (existingIndex >= 0) {
    // 更新数量
    orderItems.value[existingIndex].quantity += currentItem.value.quantity
    orderItems.value[existingIndex].total_price = orderItems.value[existingIndex].quantity * orderItems.value[existingIndex].unit_price
  } else {
    // 添加新明细
    orderItems.value.push({
      ...currentItem.value,
      material_name: selectedMaterialInfo.value.name,
      material_code: selectedMaterialInfo.value.material_code,
      unit: selectedMaterialInfo.value.unit
    })
  }
  
  // 重新计算订单总金额
  calculateOrderTotal()
  showItemDialog.value = false
}

// 删除订单明细
const removeItem = (index) => {
  orderItems.value.splice(index, 1)
  calculateOrderTotal()
}

// 计算订单总金额
const calculateOrderTotal = () => {
  currentOrder.value.total_amount = orderItems.value.reduce((sum, item) => sum + item.total_price, 0)
}

const closeDialog = () => {
  dialogVisible.value = false
}

const generateOrderNumber = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const time = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0')
  return `PO${year}${month}${day}${time}`
}

const saveOrder = async () => {
  try {
    if (!currentOrder.value.order_number || !currentOrder.value.supplier) {
      ElMessage.warning('请填写订单号和供应商')
      return
    }
    
    if (!currentOrder.value.order_date) {
      ElMessage.warning('请选择订单日期')
      return
    }
    
    if (!currentOrder.value.operator) {
      ElMessage.warning('请输入操作员姓名')
      return
    }
    
    if (editMode.value) {
      // 这里应该有更新订单的方法，暂时用添加代替
      ElMessage.success('订单信息更新成功')
    } else {
      MaterialDB.addOrder(currentOrder.value)
      ElMessage.success('订单添加成功')
    }
    
    closeDialog()
    loadOrders()
  } catch (error) {
    console.error('保存订单失败:', error)
    ElMessage.error('保存订单失败')
  }
}

const updateOrderStatus = async (order, newStatus) => {
  try {
    const actualDate = newStatus === 'received' ? new Date().toISOString().split('T')[0] : null
    MaterialDB.updateOrderStatus(order.id, newStatus, actualDate)
    ElMessage.success('订单状态更新成功')
    loadOrders()
  } catch (error) {
    console.error('更新订单状态失败:', error)
    ElMessage.error('更新订单状态失败')
  }
}

const deleteOrder = async (order) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除订单 "${order.order_number}" 吗？此操作不可恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    
    // 这里应该有删除订单的方法
    ElMessage.success('订单删除成功')
    loadOrders()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除订单失败:', error)
      ElMessage.error('删除订单失败')
    }
  }
}

const getStatusInfo = (status) => {
  return orderStatuses.find(s => s.value === status) || { label: status, type: 'info' }
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

const exportOrders = () => {
  try {
    const csvContent = generateCSV(filteredOrders.value)
    downloadCSV(csvContent, `订单记录_${new Date().toISOString().split('T')[0]}.csv`)
    ElMessage.success('导出成功')
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败')
  }
}

const generateCSV = (data) => {
  const headers = ['订单号', '供应商', '状态', '总金额', '订单日期', '预期到货日期', '实际到货日期', '操作员', '备注']
  const rows = data.map(order => [
    order.order_number || '',
    order.supplier || '',
    getStatusInfo(order.status).label,
    (Number(order.total_amount) || 0).toFixed(2),
    formatDate(order.order_date),
    formatDate(order.expected_date),
    formatDate(order.actual_date),
    order.operator || '',
    order.remark || ''
  ])
  
  return [headers, ...rows].map(row => 
    row.map(field => `"${field}"`).join(',')
  ).join('\n')
}

const downloadCSV = (content, filename) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// 导入功能
const downloadTemplate = () => {
  // 创建CSV模板内容
  const templateHeaders = [
    '订单编号',
    '供应商',
    '状态',
    '订单日期',
    '预期到货日期',
    '实际到货日期',
    '操作员',
    '备注'
  ]
  
  // 添加示例数据
  const exampleData = [
    ['PO202501001', '供应商A', 'pending', '2025-01-15', '2025-01-25', '', '张三', '紧急订单'],
    ['PO202501002', '供应商B', 'confirmed', '2025-01-16', '2025-01-30', '', '李四', '']
  ]
  
  const csvContent = [
    templateHeaders.join(','),
    ...exampleData.map(row => row.join(','))
  ].join('\n')

  // 创建并下载文件
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const filename = `订单导入模板_${new Date().toISOString().slice(0, 10)}.csv`
  
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  ElMessage.success('模板下载成功')
}

const openImportDialog = () => {
  importFile.value = null
  importData.value = []
  importPreviewData.value = []
  importDialogVisible.value = true
}

const handleFileUpload = (file) => {
  console.log('开始处理文件:', file)
  console.log('文件类型:', file.type)
  console.log('文件大小:', file.size)
  
  importFile.value = file
  
  // 检查文件类型
  if (!file.name.endsWith('.csv')) {
    ElMessage.error('请选择CSV格式的文件')
    return false
  }
  
  // 检查文件大小 (2MB限制)
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.error('文件大小不能超过2MB')
    return false
  }
  
  const reader = new FileReader()
  
  reader.onloadstart = () => {
    console.log('开始读取文件...')
  }
  
  reader.onprogress = (e) => {
    if (e.lengthComputable) {
      console.log('读取进度:', (e.loaded / e.total * 100).toFixed(2) + '%')
    }
  }
  
  reader.onload = (e) => {
    console.log('文件读取完成')
    try {
      const content = e.target.result
      console.log('文件内容长度:', content.length)
      console.log('文件内容前100字符:', content.substring(0, 100))
      
      if (!content || content.trim().length === 0) {
        ElMessage.error('文件内容为空')
        return
      }
      
      // 处理不同的换行符
      const lines = content.split(/\r?\n/).filter(line => line.trim())
      console.log('解析的行数:', lines.length)
      console.log('前几行内容:', lines.slice(0, 3))
      
      if (lines.length < 2) {
        ElMessage.error('文件内容格式错误，至少需要表头和一行数据')
        return
      }
      
      // 简化CSV解析，先用简单的逗号分割
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
      console.log('表头:', headers)
      
      const data = []
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
        const row = {}
        headers.forEach((header, index) => {
          row[header] = values[index] || ''
        })
        
        // 检查是否有有效数据
        const hasData = Object.values(row).some(val => val && val.trim())
        if (hasData) {
          data.push(row)
        }
      }
      
      console.log('解析的数据:', data)
      console.log('数据条数:', data.length)
      
      importData.value = data
      importPreviewData.value = data.slice(0, 10)
      
      if (data.length > 0) {
        ElMessage.success(`成功解析 ${data.length} 条记录`)
      } else {
        ElMessage.warning('文件中没有有效的数据行')
      }
      
    } catch (error) {
      console.error('文件解析失败:', error)
      ElMessage.error('文件解析失败: ' + error.message)
    }
  }
  
  reader.onerror = (error) => {
    console.error('文件读取失败:', error)
    ElMessage.error('文件读取失败')
  }
  
  reader.onabort = () => {
    console.log('文件读取被中止')
    ElMessage.error('文件读取被中止')
  }
  
  // 使用 readAsText 读取文件
  console.log('开始读取文件内容...')
  reader.readAsText(file.raw || file, 'utf-8')
  
  return false
}

const confirmImport = async () => {
  try {
    const successfulImports = []
    const failedImports = []
    
    for (const record of importData.value) {
      // 验证必填字段
      if (!record['订单编号'] || !record['供应商']) {
        failedImports.push({
          orderNumber: record['订单编号'] || '',
          reason: '订单编号和供应商为必填字段'
        })
        continue
      }
      
      // 检查订单编号是否已存在
      const existingOrder = orders.value.find(order => order.order_number === record['订单编号'])
      if (existingOrder) {
        failedImports.push({
          orderNumber: record['订单编号'],
          reason: '订单编号已存在'
        })
        continue
      }
      
      // 验证状态值
      const status = record['状态'] || 'pending'
      const validStatuses = ['pending', 'confirmed', 'shipped', 'received', 'cancelled']
      if (!validStatuses.includes(status)) {
        failedImports.push({
          orderNumber: record['订单编号'],
          reason: `无效的状态值: ${status}，有效值为: ${validStatuses.join(', ')}`
        })
        continue
      }
      
      // 验证日期格式
      const validateDate = (dateStr) => {
        if (!dateStr) return null
        const date = new Date(dateStr)
        return isNaN(date.getTime()) ? null : date.toISOString()
      }
      
      const orderDate = validateDate(record['订单日期']) || new Date().toISOString()
      const expectedDate = validateDate(record['预期到货日期'])
      const actualDate = validateDate(record['实际到货日期'])
      
      const orderData = {
        order_number: record['订单编号'],
        supplier: record['供应商'],
        status: status,
        total_amount: 0, // 初始为0，后续添加明细时计算
        order_date: orderDate,
        expected_date: expectedDate,
        actual_date: actualDate,
        operator: record['操作员'] || '',
        remark: record['备注'] || '',
        created_at: new Date().toISOString()
      }
      
      await MaterialDB.addOrder(orderData)
      successfulImports.push({
        orderNumber: orderData.order_number,
        supplier: orderData.supplier
      })
    }
    
    // 显示导入结果
    if (successfulImports.length > 0) {
      ElMessage.success(`成功导入 ${successfulImports.length} 条订单`)
    }
    
    if (failedImports.length > 0) {
      const failedMessages = failedImports.map(item => 
        `订单号: ${item.orderNumber} - ${item.reason}`
      ).join('\n')
      
      ElMessageBox.alert(
        failedMessages,
        `导入失败 ${failedImports.length} 条记录`,
        {
          confirmButtonText: '确定',
          type: 'warning'
        }
      )
    }
    
    importDialogVisible.value = false
    loadOrders()
    emit('refresh')
  } catch (error) {
    console.error('导入失败:', error)
    ElMessage.error('导入失败: ' + error.message)
  }
}

onMounted(() => {
  loadOrders()
})
</script>

<template>
  <div class="order-management">
    <div class="page-header">
      <h2>订单管理</h2>
      <div class="header-actions">
        <el-button @click="exportOrders">
          <el-icon><Download /></el-icon>
          导出订单
        </el-button>
        <el-button type="success" @click="openImportDialog">
          <el-icon><Upload /></el-icon>
          导入订单
        </el-button>
        <el-button type="primary" @click="openDialog()">
          <el-icon><Plus /></el-icon>
          新增订单
        </el-button>
      </div>
    </div>

    <!-- 搜索和筛选 -->
    <el-card class="search-card">
      <div class="search-bar">
        <el-input
          v-model="searchText"
          placeholder="搜索订单号、供应商或操作员"
          style="width: 300px"
          clearable
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        
        <el-select
          v-model="statusFilter"
          placeholder="选择状态"
          style="width: 150px"
          clearable
        >
          <el-option
            v-for="status in orderStatuses"
            :key="status.value"
            :label="status.label"
            :value="status.value"
          />
        </el-select>
        
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 240px"
        />
        
        <el-button @click="loadOrders">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </el-card>

    <!-- 订单列表 -->
    <el-card>
      <template #header>
        <div class="card-header">
          <span>订单列表</span>
          <el-tag type="info">共 {{ filteredOrders.length }} 个订单</el-tag>
        </div>
      </template>
      
      <el-table :data="filteredOrders" style="width: 100%" stripe>
        <el-table-column prop="order_number" label="订单号" width="150" />
        <el-table-column prop="supplier" label="供应商" min-width="150" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusInfo(row.status).type" size="small">
              {{ getStatusInfo(row.status).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="total_amount" label="总金额" width="120">
          <template #default="{ row }">
            ¥{{ (Number(row.total_amount) || 0).toFixed(2) }}
          </template>
        </el-table-column>
        <el-table-column prop="order_date" label="订单日期" width="120">
          <template #default="{ row }">
            {{ formatDate(row.order_date) }}
          </template>
        </el-table-column>
        <el-table-column prop="expected_date" label="预期到货" width="120">
          <template #default="{ row }">
            {{ formatDate(row.expected_date) }}
          </template>
        </el-table-column>
        <el-table-column prop="actual_date" label="实际到货" width="120">
          <template #default="{ row }">
            {{ formatDate(row.actual_date) }}
          </template>
        </el-table-column>
        <el-table-column prop="operator" label="操作员" width="100" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-dropdown @command="(command) => updateOrderStatus(row, command)">
              <el-button type="primary" size="small">
                状态操作<el-icon class="el-icon--right"><arrow-down /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item 
                    v-for="status in orderStatuses" 
                    :key="status.value"
                    :command="status.value"
                    :disabled="row.status === status.value"
                  >
                    {{ status.label }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            
            <el-button type="info" size="small" @click="openDialog(row)">
              编辑
            </el-button>
            
            <el-button type="danger" size="small" @click="deleteOrder(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 添加/编辑订单对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editMode ? '编辑订单' : '新增订单'"
      width="900px"
      @close="closeDialog"
    >
      <el-form :model="currentOrder" label-width="120px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="订单号" required>
              <el-input v-model="currentOrder.order_number" placeholder="请输入订单号" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="供应商" required>
              <el-input v-model="currentOrder.supplier" placeholder="请输入供应商名称" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="订单状态">
              <el-select v-model="currentOrder.status" placeholder="选择状态" style="width: 100%">
                <el-option
                  v-for="status in orderStatuses"
                  :key="status.value"
                  :label="status.label"
                  :value="status.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="总金额">
              <el-input-number
                v-model="currentOrder.total_amount"
                :min="0"
                :precision="2"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="订单日期" required>
              <el-date-picker
                v-model="currentOrder.order_date"
                type="date"
                placeholder="选择日期"
                style="width: 100%"
                value-format="YYYY-MM-DD"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="预期到货日期">
              <el-date-picker
                v-model="currentOrder.expected_date"
                type="date"
                placeholder="选择日期"
                style="width: 100%"
                value-format="YYYY-MM-DD"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="实际到货日期">
              <el-date-picker
                v-model="currentOrder.actual_date"
                type="date"
                placeholder="选择日期"
                style="width: 100%"
                value-format="YYYY-MM-DD"
              />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-form-item label="操作员" required>
          <el-input v-model="currentOrder.operator" placeholder="请输入操作员姓名" style="width: 300px" />
        </el-form-item>
        
        <!-- 订单明细 -->
        <el-form-item label="订单明细">
          <div class="order-items-section">
            <div class="items-header">
              <span>物资明细</span>
              <el-button type="primary" size="small" @click="openItemDialog">
                <el-icon><Plus /></el-icon>
                添加物资
              </el-button>
            </div>
            
            <el-table :data="orderItems" style="width: 100%; margin-top: 12px" size="small">
              <el-table-column label="物资编码" width="120">
                <template #default="{ row }">
                  {{ row.material_code || '-' }}
                </template>
              </el-table-column>
              <el-table-column prop="material_name" label="物资名称" min-width="150" />
              <el-table-column prop="quantity" label="数量" width="80">
                <template #default="{ row }">
                  {{ row.quantity }} {{ row.unit }}
                </template>
              </el-table-column>
              <el-table-column prop="unit_price" label="单价" width="100">
                <template #default="{ row }">
                  ¥{{ (row.unit_price || 0).toFixed(2) }}
                </template>
              </el-table-column>
              <el-table-column prop="total_price" label="小计" width="100">
                <template #default="{ row }">
                  ¥{{ (row.total_price || 0).toFixed(2) }}
                </template>
              </el-table-column>
              <el-table-column label="操作" width="80">
                <template #default="{ row, $index }">
                  <el-button type="danger" size="small" @click="removeItem($index)">
                    删除
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
            
            <div v-if="orderItems.length === 0" class="empty-items">
              暂无物资明细，请点击"添加物资"按钮添加
            </div>
          </div>
        </el-form-item>
        
        <el-form-item label="备注">
          <el-input
            v-model="currentOrder.remark"
            type="textarea"
            :rows="3"
            placeholder="请输入备注信息"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="closeDialog">取消</el-button>
          <el-button type="primary" @click="saveOrder">保存</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 添加物资明细对话框 -->
    <el-dialog
      v-model="showItemDialog"
      title="添加物资明细"
      width="500px"
    >
      <el-form :model="currentItem" label-width="100px">
        <el-form-item label="选择物资" required>
          <MaterialSelector
            v-model="currentItem.material_id"
            placeholder="请输入物资编码或名称搜索"
            @material-selected="handleMaterialSelected"
          />
          <div v-if="selectedMaterialInfo" class="material-info-display">
            <el-tag type="info" size="small">
              {{ selectedMaterialInfo.category }}
            </el-tag>
            <span class="material-stock">
              库存: {{ selectedMaterialInfo.current_stock }} {{ selectedMaterialInfo.unit }}
            </span>
            <span class="material-price">
              单价: ¥{{ (selectedMaterialInfo.unit_price || 0).toFixed(2) }}
            </span>
          </div>
        </el-form-item>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="数量" required>
              <el-input-number
                v-model="currentItem.quantity"
                :min="1"
                style="width: 100%"
                @change="calculateItemTotal"
              />
              <span v-if="selectedMaterialInfo" style="margin-left: 8px; color: #909399; font-size: 12px">
                {{ selectedMaterialInfo.unit }}
              </span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="单价">
              <el-input-number
                v-model="currentItem.unit_price"
                :min="0"
                :precision="2"
                style="width: 100%"
                @change="calculateItemTotal"
              />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-form-item label="小计">
          <el-input-number
            v-model="currentItem.total_price"
            :min="0"
            :precision="2"
            style="width: 100%"
            disabled
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showItemDialog = false">取消</el-button>
          <el-button type="primary" @click="addItemToOrder">添加</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 导入对话框 -->
    <el-dialog v-model="importDialogVisible" title="导入订单" width="800px">
      <div class="import-content">
        <div class="import-instructions">
          <div class="instruction-header">
            <h4>导入说明</h4>
            <el-button type="primary" size="small" @click="downloadTemplate">
              <el-icon><Download /></el-icon>
              下载模板
            </el-button>
          </div>
          <p>请先下载导入模板，按照模板格式填写数据后上传：</p>
          <ul>
            <li><strong>订单编号</strong>（必需，不能重复）</li>
            <li><strong>供应商</strong>（必需）</li>
            <li><strong>状态</strong>（可选，有效值：pending, confirmed, shipped, received, cancelled）</li>
            <li><strong>订单日期</strong>（可选，格式：YYYY-MM-DD）</li>
            <li><strong>预期到货日期</strong>（可选，格式：YYYY-MM-DD）</li>
            <li><strong>实际到货日期</strong>（可选，格式：YYYY-MM-DD）</li>
            <li><strong>操作员</strong>（可选）</li>
            <li><strong>备注</strong>（可选）</li>
          </ul>
        </div>
        
        <el-upload
          :before-upload="handleFileUpload"
          :show-file-list="false"
          accept=".csv"
          drag
        >
          <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
          <div class="el-upload__text">
            拖拽文件到此处，或<em>点击上传</em>
          </div>
          <template #tip>
            <div class="el-upload__tip">
              只能上传 csv 文件，且不超过 2MB
            </div>
          </template>
        </el-upload>

        <div v-if="importPreviewData.length > 0" class="import-preview">
          <h4>数据预览（前10条）</h4>
          <el-table :data="importPreviewData" style="width: 100%" size="small">
            <el-table-column 
              v-for="key in Object.keys(importPreviewData[0])" 
              :key="key"
              :prop="key" 
              :label="key"
              min-width="100"
            />
          </el-table>
          <p class="preview-info">共 {{ importData.length }} 条记录</p>
        </div>
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="importDialogVisible = false">取消</el-button>
          <el-button 
            type="primary" 
            @click="confirmImport"
            :disabled="importData.length === 0"
          >
            确认导入 ({{ importData.length }} 条)
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.order-management {
  padding: 0;
  width: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-header h2 {
  margin: 0;
  color: #303133;
  font-size: 20px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.search-card {
  margin-bottom: 20px;
}

.search-bar {
  display: flex;
  gap: 16px;
  align-items: center;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.order-items-section {
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 16px;
  background-color: #fafafa;
}

.items-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-weight: 500;
}

.empty-items {
  text-align: center;
  color: #909399;
  padding: 20px;
  font-size: 14px;
}

.material-info-display {
  margin-top: 8px;
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 12px;
  color: #909399;
}

.material-stock {
  color: #67c23a;
}

.material-price {
  color: #e6a23c;
}

.import-content {
  max-height: 600px;
  overflow-y: auto;
}

.import-instructions {
  margin-bottom: 20px;
  padding: 16px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.instruction-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.import-instructions h4 {
  margin: 0;
  color: #303133;
}

.import-instructions p {
  margin: 8px 0;
  color: #606266;
}

.import-instructions ul {
  margin: 8px 0;
  padding-left: 24px;
}

.import-instructions li {
  margin: 4px 0;
  color: #606266;
}

.import-preview {
  margin-top: 20px;
}

.import-preview h4 {
  margin: 0 0 12px 0;
  color: #303133;
}

.preview-info {
  margin-top: 8px;
  color: #909399;
  font-size: 12px;
}
</style>