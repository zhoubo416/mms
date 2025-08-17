<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { MaterialDB } from '../database.js'
import { ElMessage } from 'element-plus'

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
    outboundRecords.value = MaterialDB.getOutboundRecords(200)
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
  dialogVisible.value = true
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
    
    if (currentRecord.value.quantity > availableStock.value) {
      ElMessage.warning(`出库数量不能超过当前库存 ${availableStock.value} ${selectedMaterial.value.unit}`)
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
          <el-select
            v-model="currentRecord.material_id"
            placeholder="请选择物资"
            style="width: 100%"
            filterable
          >
            <el-option
              v-for="material in materials"
              :key="material.id"
              :label="`${material.name} ${material.specification ? '(' + material.specification + ')' : ''}`"
              :value="material.id"
              :disabled="material.current_stock <= 0"
            >
              <div style="display: flex; justify-content: space-between">
                <span>{{ material.name }} {{ material.specification ? '(' + material.specification + ')' : '' }}</span>
                <span 
                  :style="{
                    color: material.current_stock <= 0 ? '#f56c6c' : 
                           material.current_stock <= material.min_stock ? '#e6a23c' : '#67c23a',
                    fontSize: '12px'
                  }"
                >
                  库存: {{ material.current_stock }} {{ material.unit }}
                </span>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        
        <el-form-item label="出库数量" required>
          <el-input-number
            v-model="currentRecord.quantity"
            :min="selectedMaterial ? 1 : 0"
            :max="availableStock"
            :disabled="!selectedMaterial || availableStock <= 0"
            style="width: 200px"
          />
          <span v-if="selectedMaterial" style="margin-left: 8px; color: #909399; font-size: 12px">
            {{ selectedMaterial.unit }} (可用库存: {{ availableStock }})
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
</style>