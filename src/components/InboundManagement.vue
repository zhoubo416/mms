<script setup>
import { ref, onMounted, computed } from 'vue'
import { MaterialDB } from '../database.js'
import { ElMessage, ElMessageBox } from 'element-plus'
import MaterialSelector from './MaterialSelector.vue'

const emit = defineEmits(['refresh'])

const inboundRecords = ref([])
const materials = ref([])
const dialogVisible = ref(false)
const importDialogVisible = ref(false)
const currentRecord = ref({
  material_id: null,
  quantity: 1,
  unit_price: 0,
  total_price: 0,
  supplier: '',
  batch_number: '',
  operator: '',
  remark: ''
})

const selectedMaterialInfo = ref(null)
const importFile = ref(null)
const importData = ref([])
const importPreviewData = ref([])

const searchText = ref('')
const dateRange = ref([])

const filteredRecords = computed(() => {
  let result = inboundRecords.value
  
  if (searchText.value) {
    result = result.filter(item => 
      item.material_name?.toLowerCase().includes(searchText.value.toLowerCase()) ||
      item.supplier?.toLowerCase().includes(searchText.value.toLowerCase()) ||
      item.operator?.toLowerCase().includes(searchText.value.toLowerCase())
    )
  }
  
  if (dateRange.value && dateRange.value.length === 2) {
    const startDate = dateRange.value[0]
    const endDate = dateRange.value[1]
    result = result.filter(item => {
      const itemDate = new Date(item.created_at)
      return itemDate >= startDate && itemDate <= endDate
    })
  }
  
  return result
})

const loadMaterials = async () => {
  try {
    await MaterialDB.init()
    materials.value = MaterialDB.getAllMaterials()
  } catch (error) {
    console.error('加载物资失败:', error)
    ElMessage.error('加载物资失败: ' + error.message)
  }
}

const loadInboundRecords = async () => {
  try {
    await MaterialDB.init()
    const records = MaterialDB.getInboundRecords()
    const materialsMap = {}
    
    // 创建物资映射表
    materials.value.forEach(material => {
      materialsMap[material.id] = material
    })
    
    // 为每条入库记录添加物资编码
    inboundRecords.value = records.map(record => ({
      ...record,
      material_code: materialsMap[record.material_id]?.material_code || ''
    }))
  } catch (error) {
    console.error('加载入库记录失败:', error)
    ElMessage.error('加载入库记录失败: ' + error.message)
  }
}

const openDialog = (record = null) => {
  if (record) {
    currentRecord.value = { ...record }
    selectedMaterialInfo.value = materials.value.find(m => m.id === record.material_id)
  } else {
    currentRecord.value = {
      material_id: null,
      quantity: 1,
      unit_price: 0,
      total_price: 0,
      supplier: '',
      batch_number: '',
      operator: '',
      remark: ''
    }
    selectedMaterialInfo.value = null
  }
  dialogVisible.value = true
}

const closeDialog = () => {
  dialogVisible.value = false
  currentRecord.value = {
    material_id: null,
    quantity: 1,
    unit_price: 0,
    total_price: 0,
    supplier: '',
    batch_number: '',
    operator: '',
    remark: ''
  }
  selectedMaterialInfo.value = null
}

const onMaterialSelected = (material) => {
  selectedMaterialInfo.value = material
  currentRecord.value.material_id = material.id
  currentRecord.value.unit_price = material.unit_price || 0
  calculateTotalPrice()
}

const calculateTotalPrice = () => {
  if (currentRecord.value.quantity && currentRecord.value.unit_price) {
    currentRecord.value.total_price = currentRecord.value.quantity * currentRecord.value.unit_price
  }
}

const saveRecord = async () => {
  if (!currentRecord.value.material_id) {
    ElMessage.error('请选择物资')
    return
  }
  
  if (currentRecord.value.quantity <= 0) {
    ElMessage.error('数量必须大于0')
    return
  }

  if (!currentRecord.value.operator) {
    ElMessage.error('请输入操作员姓名')
    return
  }

  try {
    const record = {
      ...currentRecord.value,
      total_amount: currentRecord.value.total_price,
      created_at: new Date().toISOString()
    }
    
    await MaterialDB.addInboundRecord(record)
    ElMessage.success('保存成功')
    closeDialog()
    loadInboundRecords()
    emit('refresh')
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败: ' + error.message)
  }
}

const deleteRecord = async (record) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除 ${record.material_name} 的入库记录吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    
    await MaterialDB.deleteInboundRecord(record.id)
    ElMessage.success('删除成功')
    loadInboundRecords()
    emit('refresh')
  } catch (error) {
    if (error === 'cancel') {
      return
    }
    console.error('删除失败:', error)
    ElMessage.error('删除失败: ' + error.message)
  }
}

const exportRecords = () => {
  const csvContent = [
    ['物资名称', '数量', '单价', '总价', '供应商', '批次号', '操作员', '入库时间', '备注'],
    ...filteredRecords.value.map(record => [
      record.material_name,
      record.quantity,
      record.unit_price,
      record.total_price,
      record.supplier,
      record.batch_number,
      record.operator,
      formatDate(record.created_at),
      record.remark
    ])
  ].map(row => row.join(',')).join('\n')

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const filename = `入库记录_${new Date().toISOString().slice(0, 10)}.csv`
  
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

const downloadTemplate = () => {
  // 创建CSV模板内容
  const templateHeaders = [
    '物资编码',
    '物资名称', 
    '数量',
    '单价',
    '总价',
    '供应商',
    '批次号',
    '操作员',
    '备注'
  ]
  
  // 添加示例数据
  const exampleData = [
    ['MAT001', '螺丝钉', '100', '0.5', '50', '供应商A', 'BATCH001', '张三', '示例备注'],
    ['MAT002', '螺母', '200', '0.3', '60', '供应商B', 'BATCH002', '李四', '']
  ]
  
  const csvContent = [
    templateHeaders.join(','),
    ...exampleData.map(row => row.join(','))
  ].join('\n')

  // 创建并下载文件
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const filename = `入库记录导入模板_${new Date().toISOString().slice(0, 10)}.csv`
  
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
      // 优先根据编码匹配，如果没有编码则根据名称匹配
      let material = null
      
      // 如果CSV中有物资编码列，优先使用编码匹配
      if (record['物资编码']) {
        material = materials.value.find(m => m.material_code === record['物资编码'])
      }
      // 如果编码匹配失败或没有编码，则根据名称匹配
      if (!material && record['物资名称']) {
        material = materials.value.find(m => m.name === record['物资名称'])
      }
      
      if (material) {
        const inboundRecord = {
          material_id: material.id,
          quantity: parseInt(record['数量'], 10) || 0,
          unit_price: parseFloat(record['单价']) || 0,
          total_amount: parseFloat(record['总价']) || (parseInt(record['数量'], 10) * parseFloat(record['单价'])),
          supplier: record['供应商'] || '',
          batch_number: record['批次号'] || '',
          operator: record['操作员'] || '',
          remark: record['备注'] || '',
          created_at: new Date().toISOString()
        }
        
        await MaterialDB.addInboundRecord(inboundRecord)
        successfulImports.push({
          materialName: material.name,
          materialCode: material.material_code,
          quantity: inboundRecord.quantity
        })
      } else {
        failedImports.push({
          code: record['物资编码'] || '',
          name: record['物资名称'] || '',
          reason: '未找到匹配的物资'
        })
      }
    }
    // 显示导入结果
    if (successfulImports.length > 0) {
      ElMessage.success(`成功导入 ${successfulImports.length} 条记录`)
    }
    
    if (failedImports.length > 0) {
      const failedMessages = failedImports.map(item => 
        `${item.code ? `编码: ${item.code}` : ''}${item.name ? ` 名称: ${item.name}` : ''} - ${item.reason}`
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
    loadInboundRecords()
    emit('refresh')
  } catch (error) {
    console.error('导入失败:', error)
    ElMessage.error('导入失败: ' + error.message)
  }
}

onMounted(() => {
  loadMaterials()
  loadInboundRecords()
})
</script>

<template>
  <div class="inbound-management">
    <div class="page-header">
      <h2>入库管理</h2>
      <div class="header-actions">
        <el-button @click="exportRecords">
          <el-icon><Download /></el-icon>
          导出记录
        </el-button>
        <el-button type="primary" @click="openDialog()">
          <el-icon><Plus /></el-icon>
          新增入库
        </el-button>
        <el-button type="success" @click="openImportDialog">
          <el-icon><Upload /></el-icon>
          导入记录
        </el-button>
      </div>
    </div>

    <!-- 搜索和筛选 -->
    <el-card class="search-card">
      <div class="search-bar">
        <el-input
          v-model="searchText"
          placeholder="搜索物资名称、供应商或操作员"
          style="width: 300px"
          clearable
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 240px"
        />
        <el-button @click="loadInboundRecords">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </el-card>

    <!-- 入库记录列表 -->
    <el-card>
      <template #header>
        <div class="card-header">
          <span>入库记录</span>
          <el-tag type="info">共 {{ filteredRecords.length }} 条记录</el-tag>
        </div>
      </template>
      
      <el-table :data="filteredRecords" style="width: 100%" stripe>
        <el-table-column prop="material_code" label="物资编码" width="120" show-overflow-tooltip />
        <el-table-column prop="material_name" label="物资名称" min-width="150" />
        <el-table-column prop="quantity" label="入库数量" width="100">
          <template #default="{ row }">
            {{ row.quantity }} {{ row.unit }}
          </template>
        </el-table-column>
        <el-table-column prop="unit_price" label="单价" width="100">
          <template #default="{ row }">
            ¥{{ (Number(row.unit_price) || 0).toFixed(2) }}
          </template>
        </el-table-column>
        <el-table-column prop="total_amount" label="总价" width="120">
          <template #default="{ row }">
            ¥{{ (Number(row.total_amount) || 0).toFixed(2) }}
          </template>
        </el-table-column>
        <el-table-column prop="supplier" label="供应商" width="120" show-overflow-tooltip />
        <el-table-column prop="batch_number" label="批次号" width="120" show-overflow-tooltip />
        <el-table-column prop="operator" label="操作员" width="100" />
        <el-table-column prop="created_at" label="入库时间" width="140">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button link type="danger" size="small" @click="deleteRecord(row)">
              <el-icon><Delete /></el-icon>
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑入库记录对话框 -->
    <el-dialog 
      v-model="dialogVisible"
      :title="currentRecord.id ? '编辑入库记录' : '新增入库记录'"
      width="500px"
    >
      <el-form :model="currentRecord" label-width="80px">
        <el-form-item label="选择物资" required>
          <MaterialSelector 
            v-model="currentRecord.material_id"
            @material-selected="onMaterialSelected"
            placeholder="请选择物资"
          />
        </el-form-item>
        <el-form-item v-if="selectedMaterialInfo" label="物资信息">
          <div class="material-info">
            <div><strong>{{ selectedMaterialInfo.name }}</strong></div>
            <div v-if="selectedMaterialInfo.material_code" class="material-code">
              编码: {{ selectedMaterialInfo.material_code }}
            </div>
            <div v-if="selectedMaterialInfo.specification" class="material-spec">
              型号: {{ selectedMaterialInfo.specification }}
            </div>
            <div class="material-stock">
              当前库存: {{ selectedMaterialInfo.current_stock }} {{ selectedMaterialInfo.unit }}
            </div>
          </div>
        </el-form-item>
        
        <el-form-item label="数量" required>
          <el-input-number 
            v-model="currentRecord.quantity" 
            :min="1" 
            @change="calculateTotalPrice"
            style="width: 100%"
          />
        </el-form-item>
        
        <el-form-item label="单价">
          <el-input-number 
            v-model="currentRecord.unit_price" 
            :min="0" 
            :precision="2"
            @change="calculateTotalPrice"
            style="width: 100%"
          />
        </el-form-item>
        
        <el-form-item label="总价">
          <el-input-number 
            v-model="currentRecord.total_price" 
            :min="0"
            :precision="2"
            style="width: 100%"
          />
        </el-form-item>
        
        <el-form-item label="供应商">
          <el-input v-model="currentRecord.supplier" placeholder="请输入供应商" />
        </el-form-item>
        
        <el-form-item label="批次号">
          <el-input v-model="currentRecord.batch_number" placeholder="请输入批次号" />
        </el-form-item>
        
        <el-form-item label="操作员">
          <el-input v-model="currentRecord.operator" placeholder="请输入操作员" />
        </el-form-item>
        
        <el-form-item label="备注">
          <el-input 
            v-model="currentRecord.remark" 
            type="textarea" 
            :rows="3" 
            placeholder="请输入备注（可选）" 
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="closeDialog">取消</el-button>
          <el-button type="primary" @click="saveRecord">确定</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 导入对话框 -->
    <el-dialog v-model="importDialogVisible" title="导入入库记录" width="800px">
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
            <li><strong>物资编码</strong>（优先匹配） 或 <strong>物资名称</strong>（必需）</li>
            <li><strong>数量</strong>（必需）</li>
            <li><strong>单价</strong>（可选）</li>
            <li><strong>总价</strong>（可选，如未填写将自动计算）</li>
            <li><strong>供应商</strong>（可选）</li>
            <li><strong>批次号</strong>（可选）</li>
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

        <!-- 预览数据 -->
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
.inbound-management {
  padding: 0;
  width: 100%;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.page-header h2 {
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.search-card {
  margin-bottom: 8px;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.material-info {
  width: 100%;
}

.material-code, .material-spec, .material-stock {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
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
