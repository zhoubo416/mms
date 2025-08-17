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

const searchText = ref('')
const categoryFilter = ref('')
const categories = ref(['电线', '开关设备', '变压器', '保护设备', '测量仪表', '工具', '其他'])

const filteredMaterials = computed(() => {
  let result = materials.value
  
  if (searchText.value) {
    result = result.filter(item => 
      item.name.toLowerCase().includes(searchText.value.toLowerCase()) ||
      (item.specification && item.specification.toLowerCase().includes(searchText.value.toLowerCase()))
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

onMounted(() => {
  loadMaterials()
})
</script>

<template>
  <div class="material-management">
    <div class="page-header">
      <h2>物资管理</h2>
      <el-button type="primary" @click="openDialog()">
        <el-icon><Plus /></el-icon>
        添加物资
      </el-button>
    </div>

    <!-- 搜索和筛选 -->
    <el-card class="search-card">
      <div class="search-bar">
        <el-input
          v-model="searchText"
          placeholder="搜索物资名称或型号"
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
      <el-table :data="filteredMaterials" style="width: 100%" stripe>
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
            <el-form-item label="物资名称" required>
              <el-input v-model="currentMaterial.name" placeholder="请输入物资名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="型号">
              <el-input v-model="currentMaterial.specification" placeholder="请输入型号" />
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
            <el-form-item label="分类" required>
              <el-select v-model="currentMaterial.category" placeholder="选择分类" style="width: 100%">
                <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
              </el-select>
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
            <el-form-item label="当前库存">
              <el-input-number v-model="currentMaterial.current_stock" :min="0" :step="1" controls-position="right" style="width: 100%" />
            </el-form-item>
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
</style>