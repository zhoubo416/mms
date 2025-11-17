<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { MaterialDB } from '../database.js'
import { ElMessage, ElMessageBox } from 'element-plus'
import MaterialSelector from './MaterialSelector.vue'

const emit = defineEmits(['refresh'])

const outboundRecords = ref([])
const materials = ref([])
const dialogVisible = ref(false)
const currentRecord = ref({
  material_id: null,
  quantity: 0,
  purpose: '',
  recipient: '',
  department: '',
  operator: '',
  remark: ''
})

const selectedMaterialInfo = ref(null)
const importDialogVisible = ref(false)
const importFile = ref(null)
const importData = ref([])
const importPreviewData = ref([])

const searchText = ref('')
const dateRange = ref([])

const filteredRecords = computed(() => {
  let result = outboundRecords.value
  
  if (searchText.value) {
    result = result.filter(item => 
      item.material_name?.toLowerCase().includes(searchText.value.toLowerCase()) ||
      item.recipient?.toLowerCase().includes(searchText.value.toLowerCase()) ||
      item.department?.toLowerCase().includes(searchText.value.toLowerCase()) ||
      item.operator?.toLowerCase().includes(searchText.value.toLowerCase())
    )
  }
  
  if (dateRange.value && dateRange.value.length === 2) {
    const [startDate, endDate] = dateRange.value
    result = result.filter(item => {
      const recordDate = new Date(item.created_at)
      return recordDate >= startDate && recordDate <= endDate
    })
  }
  
  return result
})

const selectedMaterial = computed(() => {
  return materials.value.find(m => m.id === currentRecord.value.material_id)
})

const availableStock = computed(() => {
  return selectedMaterial.value ? selectedMaterial.value.current_stock : 0
})

// 当选择物资后，自动设置一个合理的默认出库数量（有库存则为1，否则为0）
watch(() => currentRecord.value.material_id, (newId) => {
  if (!newId) {
    currentRecord.value.quantity = 0
    return
  }
  const mat = materials.value.find(m => m.id === newId)
  currentRecord.value.quantity = mat && mat.current_stock > 0 ? 1 : 0
})

const loadOutboundRecords = async () => {
  try {
    await MaterialDB.init()
    const records = MaterialDB.getOutboundRecords(200)
    const materialsMap = {}
    
    // 创建物资映射表
    materials.value.forEach(material => {
      materialsMap[material.id] = material
    })
    
    // 为每条出库记录添加物资编码
    outboundRecords.value = records.map(record => ({
      ...record,
      material_code: materialsMap[record.material_id]?.material_code || ''
    }))
    
    emit('refresh')
  } catch (error) {
    console.error('加载出库记录失败:', error)
    ElMessage.error('加载出库记录失败')
  }
}

const loadMaterials = async () => {
  try {
    await MaterialDB.init()
    materials.value = MaterialDB.getAllMaterials()
  } catch (error) {
    console.error('加载物资列表失败:', error)
    ElMessage.error('加载物资列表失败')
  }
}

const openDialog = () => {
  currentRecord.value = {
    material_id: null,
    quantity: 0,
    purpose: '',
    recipient: '',
    department: '',
    operator: '',
    remark: ''
  }
  selectedMaterialInfo.value = null
  dialogVisible.value = true
}

// 处理物资选择
const handleMaterialSelected = (material) => {
  selectedMaterialInfo.value = material
  if (material) {
    currentRecord.value.material_id = material.id
    // 设置默认出库数量
    currentRecord.value.quantity = material.current_stock > 0 ? 1 : 0
  } else {
    currentRecord.value.material_id = null
    currentRecord.value.quantity = 0
  }
}

const closeDialog = () => {
  dialogVisible.value = false
}

const saveOutboundRecord = async () => {
  try {
    if (!currentRecord.value.material_id) {
      ElMessage.warning('请选择物资')
      return
    }
    
    if (!currentRecord.value.quantity || currentRecord.value.quantity <= 0) {
      ElMessage.warning('请输入正确的出库数量')
      return
    }
    
    const currentStock = selectedMaterialInfo.value ? selectedMaterialInfo.value.current_stock : 0
    if (currentRecord.value.quantity > currentStock) {
      ElMessage.warning(`出库数量不能超过当前库存 ${currentStock} ${selectedMaterialInfo.value?.unit || ''}`)
      return
    }
    
    if (!currentRecord.value.recipient) {
      ElMessage.warning('请输入领用人')
      return
    }
    
    if (!currentRecord.value.operator) {
      ElMessage.warning('请输入操作员姓名')
      return
    }
    
    MaterialDB.addOutboundRecord(currentRecord.value)
    ElMessage.success('出库记录添加成功')
    
    closeDialog()
    loadOutboundRecords()
    loadMaterials() // 刷新物资列表以更新库存
  } catch (error) {
    console.error('保存出库记录失败:', error)
    ElMessage.error('保存出库记录失败')
  }
}

const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleString('zh-CN')
}

const exportRecords = () => {
  try {
    const csvContent = generateCSV(filteredRecords.value)
    downloadCSV(csvContent, `出库记录_${new Date().toISOString().split('T')[0]}.csv`)
    ElMessage.success('导出成功')
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败')
  }
}

const generateCSV = (data) => {
  const headers = ['物资名称', '数量', '单位', '用途', '领用人', '部门', '操作员', '出库时间', '备注']
  const rows = data.map(record => [
    record.material_name || '',
    record.quantity,
    record.unit || '',
    record.purpose || '',
    record.recipient || '',
    record.department || '',
    record.operator || '',
    formatDate(record.created_at),
    record.remark || ''
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

const purposes = [
  '设备维修',
  '设备安装',
  '日常维护',
  '应急抢修',
  '设备改造',
  '检修作业',
  '其他'
]

const departments = [
  '运维部',
  '检修部',
  '技术部',
  '安全部',
  '调度中心',
  '变电站',
  '其他'
]

// 导入功能
const downloadTemplate = () => {
  // 创建CSV模板内容
  const templateHeaders = [
    '物资编码',
    '物资名称', 
    '数量',
    '用途',
    '领用人',
    '部门',
    '操作员',
    '备注'
  ]
  
  // 添加示例数据
  const exampleData = [
    ['MAT001', '螺丝钉', '50', '设备维修', '张三', '维修部', '李四', '设备维修用'],
    ['MAT002', '螺母', '100', '生产使用', '王五', '生产部', '赵六', '']
  ]
  
  const csvContent = [
    templateHeaders.join(','),
    ...exampleData.map(row => row.join(','))
  ].join('\n')

  // 创建并下载文件
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const filename = `出库记录导入模板_${new Date().toISOString().slice(0, 10)}.csv`
  
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
      let material = null
      
      // 优先根据编码匹配，如果没有编码则根据名称匹配
      if (record['物资编码']) {
        material = materials.value.find(m => m.material_code === record['物资编码'])
      }
      
      if (!material && record['物资名称']) {
        material = materials.value.find(m => m.name === record['物资名称'])
      }
      
      if (material) {
        const quantity = parseInt(record['数量'], 10) || 0
        
        // 检查库存是否足够
        if (quantity > material.current_stock) {
          failedImports.push({
            code: record['物资编码'] || '',
            name: record['物资名称'] || '',
            reason: `库存不足，当前库存: ${material.current_stock}，需要: ${quantity}`
          })
          continue
        }
        
        const outboundRecord = {
          material_id: material.id,
          quantity: quantity,
          purpose: record['用途'] || '',
          recipient: record['领用人'] || '',
          department: record['部门'] || '',
          operator: record['操作员'] || '',
          remark: record['备注'] || '',
          created_at: new Date().toISOString()
        }
        
        await MaterialDB.addOutboundRecord(outboundRecord)
        successfulImports.push({
          materialName: material.name,
          materialCode: material.material_code,
          quantity: outboundRecord.quantity
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
    loadOutboundRecords()
    emit('refresh')
  } catch (error) {
    console.error('导入失败:', error)
    ElMessage.error('导入失败: ' + error.message)
  }
}

onMounted(() => {
  loadMaterials()
  loadOutboundRecords()
})
</script>

<template>
  <div class="outbound-management">
    <div class="page-header">
      <h2>出库管理</h2>
      <div class="header-actions">
        <el-button @click="exportRecords">
          <el-icon><Download /></el-icon>
          导出记录
        </el-button>
        <el-button type="success" @click="openImportDialog">
          <el-icon><Upload /></el-icon>
          导入记录
        </el-button>
        <el-button type="primary" @click="openDialog()">
          <el-icon><Plus /></el-icon>
          新增出库
        </el-button>
      </div>
    </div>

    <!-- 搜索和筛选 -->
    <el-card class="search-card">
      <div class="search-bar">
        <el-input
          v-model="searchText"
          placeholder="搜索物资名称、领用人、部门或操作员"
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
        
        <el-button @click="loadOutboundRecords">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </el-card>

    <!-- 出库记录列表 -->
    <el-card>
      <template #header>
        <div class="card-header">
          <span>出库记录</span>
          <el-tag type="info">共 {{ filteredRecords.length }} 条记录</el-tag>
        </div>
      </template>
      
      <el-table :data="filteredRecords" style="width: 100%" stripe>
        <el-table-column prop="material_code" label="物资编码" width="120" show-overflow-tooltip />
        <el-table-column prop="material_name" label="物资名称" min-width="150" />
        <el-table-column prop="quantity" label="出库数量" width="100">
          <template #default="{ row }">
            {{ row.quantity }} {{ row.unit }}
          </template>
        </el-table-column>
        <el-table-column prop="purpose" label="用途" width="120" show-overflow-tooltip />
        <el-table-column prop="recipient" label="领用人" width="100" />
        <el-table-column prop="department" label="部门" width="100" />
        <el-table-column prop="operator" label="操作员" width="100" />
        <el-table-column prop="created_at" label="出库时间" width="160">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
      </el-table>
    </el-card>

    <!-- 新增出库对话框 -->
    <el-dialog
      v-model="dialogVisible"
      title="新增出库记录"
      width="600px"
      @close="closeDialog"
    >
      <el-form :model="currentRecord" label-width="100px">
        <el-form-item label="选择物资" required>
          <MaterialSelector
            v-model="currentRecord.material_id"
            placeholder="请输入物资编码或名称搜索"
            @material-selected="handleMaterialSelected"
          />
          <div v-if="selectedMaterialInfo" class="material-info-display">
            <el-tag type="info" size="small">
              {{ selectedMaterialInfo.category }}
            </el-tag>
            <span class="material-stock" :class="{ 'low-stock': selectedMaterialInfo.current_stock <= 0 }">
              当前库存: {{ selectedMaterialInfo.current_stock }} {{ selectedMaterialInfo.unit }}
            </span>
            <span v-if="selectedMaterialInfo.current_stock <= 0" class="stock-warning">
              (无库存)
            </span>
            <span v-else-if="selectedMaterialInfo.current_stock <= selectedMaterialInfo.min_stock" class="stock-warning">
              (库存不足)
            </span>
          </div>
        </el-form-item>
        
        <el-form-item label="出库数量" required>
          <el-input-number
            v-model="currentRecord.quantity"
            :min="selectedMaterialInfo ? 1 : 0"
            :max="selectedMaterialInfo ? selectedMaterialInfo.current_stock : 0"
            :disabled="!selectedMaterialInfo || selectedMaterialInfo.current_stock <= 0"
            style="width: 200px"
          />
          <span v-if="selectedMaterialInfo" style="margin-left: 8px; color: #909399; font-size: 12px">
            {{ selectedMaterialInfo.unit }} (可用库存: {{ selectedMaterialInfo.current_stock }})
          </span>
        </el-form-item>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="用途">
              <el-select v-model="currentRecord.purpose" placeholder="选择用途" style="width: 100%">
                <el-option
                  v-for="purpose in purposes"
                  :key="purpose"
                  :label="purpose"
                  :value="purpose"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="部门">
              <el-select v-model="currentRecord.department" placeholder="选择部门" style="width: 100%">
                <el-option
                  v-for="department in departments"
                  :key="department"
                  :label="department"
                  :value="department"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="领用人" required>
              <el-input v-model="currentRecord.recipient" placeholder="请输入领用人姓名" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="操作员" required>
              <el-input v-model="currentRecord.operator" placeholder="请输入操作员姓名" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-form-item label="备注">
          <el-input
            v-model="currentRecord.remark"
            type="textarea"
            :rows="3"
            placeholder="请输入备注信息"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="closeDialog">取消</el-button>
          <el-button type="primary" @click="saveOutboundRecord">保存</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 导入对话框 -->
    <el-dialog v-model="importDialogVisible" title="导入出库记录" width="800px">
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
            <li><strong>数量</strong>（必需，系统会自动检查库存是否足够）</li>
            <li><strong>用途</strong>（可选）</li>
            <li><strong>领用人</strong>（可选）</li>
            <li><strong>部门</strong>（可选）</li>
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
.outbound-management {
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

.material-stock.low-stock {
  color: #f56c6c;
}

.stock-warning {
  color: #e6a23c;
  font-weight: 500;
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