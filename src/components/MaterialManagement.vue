<script setup>
import { ref, onMounted, computed } from 'vue'
import { MaterialDB } from '../database.js'
import { ElMessage, ElMessageBox } from 'element-plus'

const emit = defineEmits(['refresh'])

const materials = ref([])
const dialogVisible = ref(false)
const editMode = ref(false)
const currentMaterial = ref({
  id: null,
  material_code: '',
  name: '',
  specification: '',
  unit: '',
  category: '',
  current_stock: 0,
  min_stock: 0,
  max_stock: 1000,
  unit_price: 0,
  remark: ''
})

const importDialogVisible = ref(false)
const importFile = ref(null)
const importData = ref([])
const importPreviewData = ref([])

const searchText = ref('')
const categoryFilter = ref('')
const categories = ref(['电线', '开关设备', '变压器', '保护设备', '测量仪表', '工具', '其他'])

const filteredMaterials = computed(() => {
  let result = materials.value
  
  if (searchText.value) {
    result = result.filter(item => 
      item.name.toLowerCase().includes(searchText.value.toLowerCase()) ||
      (item.specification && item.specification.toLowerCase().includes(searchText.value.toLowerCase())) ||
      (item.material_code && item.material_code.toLowerCase().includes(searchText.value.toLowerCase()))
    )
  }
  
  if (categoryFilter.value) {
    result = result.filter(item => item.category === categoryFilter.value)
  }
  
  return result
})

const loadMaterials = async () => {
  try {
    await MaterialDB.init()
    materials.value = MaterialDB.getAllMaterials()
    emit('refresh')
  } catch (error) {
    console.error('加载物资列表失败:', error)
    ElMessage.error('加载物资列表失败')
  }
}

const openDialog = (material = null) => {
  if (material) {
    editMode.value = true
    currentMaterial.value = { ...material }
  } else {
    editMode.value = false
    currentMaterial.value = {
      id: null,
      material_code: '',
      name: '',
      specification: '',
      unit: '',
      category: '',
      current_stock: 0,
      min_stock: 0,
      max_stock: 1000,
      unit_price: 0,
      remark: ''
    }
  }
  dialogVisible.value = true
}

const closeDialog = () => {
  dialogVisible.value = false
}

const saveMaterial = async () => {
  try {
    if (!currentMaterial.value.name || !currentMaterial.value.unit) {
      ElMessage.warning('请填写物资名称和单位')
      return
    }
    
    if (editMode.value) {
      MaterialDB.updateMaterial(currentMaterial.value.id, currentMaterial.value)
      ElMessage.success('物资信息更新成功')
    } else {
      MaterialDB.addMaterial(currentMaterial.value)
      ElMessage.success('物资添加成功')
    }
    
    closeDialog()
    loadMaterials()
  } catch (error) {
    console.error('保存物资失败:', error)
    ElMessage.error('保存物资失败')
  }
}

const deleteMaterial = async (material) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除物资 "${material.name}" 吗？此操作不可恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    
    MaterialDB.deleteMaterial(material.id)
    ElMessage.success('物资删除成功')
    loadMaterials()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除物资失败:', error)
      ElMessage.error('删除物资失败')
    }
  }
}

// 强化：对库存状态计算进行数值化，避免 undefined/字符串引发的比较问题
const getStockStatus = (current, min) => {
  const c = Number(current) || 0
  const m = Number(min) || 0
  if (c <= 0) return 'danger'
  if (c <= m) return 'warning'
  return 'success'
}

const getStockStatusText = (current, min) => {
  const c = Number(current) || 0
  const m = Number(min) || 0
  if (c <= 0) return '缺货'
  if (c <= m) return '库存不足'
  return '正常'
}

// 导出功能
const exportMaterials = () => {
  try {
    if (filteredMaterials.value.length === 0) {
      ElMessage.warning('没有数据可导出')
      return
    }

    // 创建CSV表头
    const headers = [
      '物资编码',
      '物资名称',
      '规格型号',
      '单位',
      '分类',
      '当前库存',
      '最小库存',
      '最大库存',
      '单价',
      '库存状态',
      '备注'
    ]

    // 转换数据
    const csvData = filteredMaterials.value.map(material => [
      material.material_code || '',
      material.name || '',
      material.specification || '',
      material.unit || '',
      material.category || '',
      material.current_stock || 0,
      material.min_stock || 0,
      material.max_stock || 0,
      material.unit_price || 0,
      getStockStatusText(material.current_stock, material.min_stock),
      material.remark || ''
    ])

    // 创建CSV内容
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    // 创建并下载文件
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const filename = `物资清单_${new Date().toISOString().slice(0, 10)}.csv`
    
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    ElMessage.success(`成功导出 ${filteredMaterials.value.length} 条物资记录`)
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败: ' + error.message)
  }
}

// 导入功能
const downloadTemplate = () => {
  // 创建CSV模板内容
  const templateHeaders = [
    '物资编码',
    '物资名称',
    '规格型号',
    '单位',
    '分类',
    '当前库存',
    '最小库存',
    '最大库存',
    '单价',
    '备注'
  ]
  
  // 添加示例数据
  const exampleData = [
    ['MAT001', '螺丝钉', 'M6*20', '个', '工具', '100', '10', '1000', '0.5', '常用螺丝钉'],
    ['MAT002', '电线', '2.5平方', '米', '电线', '500', '50', '2000', '3.2', '家装电线']
  ]
  
  const csvContent = [
    templateHeaders.join(','),
    ...exampleData.map(row => row.join(','))
  ].join('\n')

  // 创建并下载文件
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const filename = `物资导入模板_${new Date().toISOString().slice(0, 10)}.csv`
  
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
      if (!record['物资名称']) {
        failedImports.push({
          name: record['物资名称'] || '',
          reason: '物资名称为必填字段'
        })
        continue
      }
      
      // 检查物资编码是否已存在（如果提供了编码）
      if (record['物资编码']) {
        const existingMaterial = materials.value.find(material => 
          material.material_code === record['物资编码']
        )
        if (existingMaterial) {
          failedImports.push({
            name: record['物资名称'],
            reason: `物资编码 ${record['物资编码']} 已存在`
          })
          continue
        }
      }
      
      // 检查物资名称是否已存在
      const existingByName = materials.value.find(material => 
        material.name === record['物资名称']
      )
      if (existingByName) {
        failedImports.push({
          name: record['物资名称'],
          reason: '物资名称已存在'
        })
        continue
      }
      
      // 验证分类
      const category = record['分类'] || '其他'
      if (!categories.value.includes(category)) {
        failedImports.push({
          name: record['物资名称'],
          reason: `无效的分类: ${category}，有效值为: ${categories.value.join(', ')}`
        })
        continue
      }
      
      // 验证数值字段
      const validateNumber = (value, defaultValue = 0) => {
        const num = parseFloat(value)
        return isNaN(num) ? defaultValue : num
      }
      
      const materialData = {
        material_code: record['物资编码'] || '',
        name: record['物资名称'],
        specification: record['规格型号'] || '',
        unit: record['单位'] || '个',
        category: category,
        current_stock: validateNumber(record['当前库存'], 0),
        min_stock: validateNumber(record['最小库存'], 0),
        max_stock: validateNumber(record['最大库存'], 1000),
        unit_price: validateNumber(record['单价'], 0),
        remark: record['备注'] || '',
        created_at: new Date().toISOString()
      }
      
      await MaterialDB.addMaterial(materialData)
      successfulImports.push({
        name: materialData.name,
        code: materialData.material_code
      })
    }
    
    // 显示导入结果
    if (successfulImports.length > 0) {
      ElMessage.success(`成功导入 ${successfulImports.length} 条物资`)
    }
    
    if (failedImports.length > 0) {
      const failedMessages = failedImports.map(item => 
        `物资: ${item.name} - ${item.reason}`
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
    loadMaterials()
    emit('refresh')
  } catch (error) {
    console.error('导入失败:', error)
    ElMessage.error('导入失败: ' + error.message)
  }
}

onMounted(() => {
  loadMaterials()
})
</script>

<template>
  <div class="material-management">
    <div class="page-header">
      <h2>物资管理</h2>
      <div>
        <el-button @click="exportMaterials">
          <el-icon><Download /></el-icon>
          导出物资
        </el-button>
        <el-button type="success" @click="openImportDialog">
          <el-icon><Upload /></el-icon>
          导入物资
        </el-button>
        <el-button type="primary" @click="openDialog()">
          <el-icon><Plus /></el-icon>
          新增物资
        </el-button>
      </div>
    </div>

    <!-- 搜索和筛选 -->
    <el-card class="search-card">
      <div class="search-bar">
        <el-input
          v-model="searchText"
          placeholder="搜索物资编码、名称或型号"
          style="width: 300px"
          clearable
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        
        <el-select
          v-model="categoryFilter"
          placeholder="选择分类"
          style="width: 150px"
          clearable
        >
          <el-option
            v-for="category in categories"
            :key="category"
            :label="category"
            :value="category"
          />
        </el-select>
        
        <el-button @click="loadMaterials">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </el-card>

    <!-- 物资列表 -->
    <el-card>
      <template #header>
        <div class="card-header">
          <span>物资列表 ({{ filteredMaterials.length }} 条)</span>
        </div>
      </template>
      <el-table :data="filteredMaterials" style="width: 100%" stripe>
        <el-table-column prop="material_code" label="物资编码" width="120" />
        <el-table-column prop="name" label="物资名称" min-width="150" />
        <el-table-column prop="specification" label="型号" width="120" />
        <el-table-column prop="category" label="分类" width="100" />
        <el-table-column prop="unit" label="单位" width="80" />
        <el-table-column label="当前库存" width="120">
          <template #default="{ row }">
            <el-tag :type="getStockStatus(row.current_stock, row.min_stock)">
              {{ (Number(row.current_stock) || 0) }} {{ row.unit }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="库存状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStockStatus(row.current_stock, row.min_stock)" size="small">
              {{ getStockStatusText(row.current_stock, row.min_stock) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="min_stock" label="最低库存" width="100">
          <template #default="{ row }">
            {{ (Number(row.min_stock) || 0) }} {{ row.unit }}
          </template>
        </el-table-column>
        <el-table-column prop="unit_price" label="单价" width="100">
          <template #default="{ row }">
            ¥{{ (Number(row.unit_price) || 0).toFixed(2) }}
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="描述" min-width="150" show-overflow-tooltip />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="openDialog(row)">
              编辑
            </el-button>
            <el-button type="danger" size="small" @click="deleteMaterial(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 添加/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editMode ? '编辑物资' : '添加物资'"
      width="600px"
      @close="closeDialog"
    >
      <el-form :model="currentMaterial" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="物资编码">
              <el-input v-model="currentMaterial.material_code" placeholder="请输入物资编码（可选）" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="物资名称" required>
              <el-input v-model="currentMaterial.name" placeholder="请输入物资名称" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="型号">
              <el-input v-model="currentMaterial.specification" placeholder="请输入型号" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="分类" required>
              <el-select v-model="currentMaterial.category" placeholder="选择分类" style="width: 100%">
                <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="单位" required>
              <el-select v-model="currentMaterial.unit" placeholder="选择单位" style="width: 100%">
                <el-option label="个" value="个" />
                <el-option label="台" value="台" />
                <el-option label="米" value="米" />
                <el-option label="套" value="套" />
                <el-option label="件" value="件" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="当前库存">
              <el-input-number v-model="currentMaterial.current_stock" :min="0" :step="1" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="最低库存" required>
              <el-input-number v-model="currentMaterial.min_stock" :min="0" :step="1" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="最高库存">
              <el-input-number v-model="currentMaterial.max_stock" :min="0" :step="1" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="单价" required>
              <el-input-number v-model="currentMaterial.unit_price" :min="0" :step="0.01" :precision="2" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="存放位置">
              <el-input v-model="currentMaterial.location" placeholder="请输入存放位置（可选）" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="供应商">
              <el-input v-model="currentMaterial.supplier" placeholder="请输入供应商（可选）" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
          </el-col>
        </el-row>

        <el-form-item label="描述">
          <el-input v-model="currentMaterial.remark" type="textarea" :rows="3" placeholder="请输入描述（可选）" />
        </el-form-item>
      </el-form>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="closeDialog">取消</el-button>
          <el-button type="primary" @click="saveMaterial">确定</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 导入对话框 -->
    <el-dialog v-model="importDialogVisible" title="导入物资" width="800px">
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
            <li><strong>物资编码</strong>（可选，如提供则不能重复）</li>
            <li><strong>物资名称</strong>（必需，不能重复）</li>
            <li><strong>规格型号</strong>（可选）</li>
            <li><strong>单位</strong>（可选，默认为"个"）</li>
            <li><strong>分类</strong>（可选，有效值：电线、开关设备、变压器、保护设备、测量仪表、工具、其他）</li>
            <li><strong>当前库存</strong>（可选，默认为0）</li>
            <li><strong>最小库存</strong>（可选，默认为0）</li>
            <li><strong>最大库存</strong>（可选，默认为1000）</li>
            <li><strong>单价</strong>（可选，默认为0）</li>
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
.material-management {
  padding: 0;
  width: 100%;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.search-card {
  margin-bottom: 8px;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

:deep(.el-tag) {
  font-size: 12px;
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