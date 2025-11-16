<script setup>
import { ref, computed, watch } from 'vue'
import { MaterialDB } from '../database.js'
import { ElMessage } from 'element-plus'

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: null
  },
  placeholder: {
    type: String,
    default: '请输入物资编码或名称搜索'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  clearable: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:modelValue', 'material-selected'])

const searchKeyword = ref('')
const searchResults = ref([])
const selectedMaterial = ref(null)
const loading = ref(false)
const showDropdown = ref(false)

// 搜索物资
const searchMaterials = async (keyword) => {
  if (!keyword || keyword.length < 1) {
    searchResults.value = []
    showDropdown.value = false
    return
  }

  loading.value = true
  try {
    await MaterialDB.init()
    searchResults.value = MaterialDB.searchMaterials(keyword)
    showDropdown.value = searchResults.value.length > 0
  } catch (error) {
    console.error('搜索物资失败:', error)
    ElMessage.error('搜索物资失败')
    searchResults.value = []
    showDropdown.value = false
  } finally {
    loading.value = false
  }
}

// 选择物资
const selectMaterial = (material) => {
  selectedMaterial.value = material
  searchKeyword.value = material.material_code || material.name
  showDropdown.value = false
  
  emit('update:modelValue', material.id)
  emit('material-selected', material)
}

// 清空选择
const clearSelection = () => {
  selectedMaterial.value = null
  searchKeyword.value = ''
  searchResults.value = []
  showDropdown.value = false
  
  emit('update:modelValue', null)
  emit('material-selected', null)
}

// 监听搜索关键词变化
watch(searchKeyword, (newVal) => {
  if (newVal !== (selectedMaterial.value?.material_code || selectedMaterial.value?.name)) {
    selectedMaterial.value = null
    emit('update:modelValue', null)
    emit('material-selected', null)
  }
  searchMaterials(newVal)
}, { debounce: 300 })

// 监听外部值变化
watch(() => props.modelValue, async (newVal) => {
  if (newVal && newVal !== selectedMaterial.value?.id) {
    try {
      await MaterialDB.init()
      const material = MaterialDB.getMaterialById(newVal)
      if (material) {
        selectedMaterial.value = material
        searchKeyword.value = material.material_code || material.name
      }
    } catch (error) {
      console.error('加载物资信息失败:', error)
    }
  } else if (!newVal) {
    clearSelection()
  }
})

// 处理输入框失焦
const handleBlur = () => {
  // 延迟隐藏下拉框，以便点击选项
  setTimeout(() => {
    showDropdown.value = false
  }, 200)
}

// 格式化显示文本
const formatMaterialDisplay = (material) => {
  const parts = []
  if (material.material_code) {
    parts.push(`[${material.material_code}]`)
  }
  parts.push(material.name)
  if (material.specification) {
    parts.push(`(${material.specification})`)
  }
  return parts.join(' ')
}
</script>

<template>
  <div class="material-selector">
    <el-input
      v-model="searchKeyword"
      :placeholder="placeholder"
      :disabled="disabled"
      :clearable="clearable"
      :loading="loading"
      @focus="searchMaterials(searchKeyword)"
      @blur="handleBlur"
      @clear="clearSelection"
    >
      <template #prefix>
        <el-icon><Search /></el-icon>
      </template>
    </el-input>
    
    <!-- 搜索结果下拉框 -->
    <div v-if="showDropdown" class="search-dropdown">
      <div v-if="loading" class="dropdown-item loading">
        <el-icon class="is-loading"><Loading /></el-icon>
        搜索中...
      </div>
      <div v-else-if="searchResults.length === 0" class="dropdown-item no-data">
        暂无匹配的物资
      </div>
      <div
        v-else
        v-for="material in searchResults"
        :key="material.id"
        class="dropdown-item"
        @click="selectMaterial(material)"
      >
        <div class="material-info">
          <div class="material-name">
            {{ formatMaterialDisplay(material) }}
          </div>
          <div class="material-details">
            <span class="category">{{ material.category }}</span>
            <span class="stock">库存: {{ material.current_stock }} {{ material.unit }}</span>
            <span class="price">¥{{ (material.unit_price || 0).toFixed(2) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.material-selector {
  position: relative;
  width: 100%;
}

.search-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #dcdfe6;
  border-top: none;
  border-radius: 0 0 4px 4px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000;
}

.dropdown-item {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
}

.dropdown-item:hover {
  background-color: #f5f7fa;
}

.dropdown-item:last-child {
  border-bottom: none;
}

.dropdown-item.loading,
.dropdown-item.no-data {
  text-align: center;
  color: #909399;
  cursor: default;
}

.dropdown-item.loading:hover,
.dropdown-item.no-data:hover {
  background-color: white;
}

.material-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.material-name {
  font-weight: 500;
  color: #303133;
}

.material-details {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #909399;
}

.category {
  background: #f0f9ff;
  color: #1890ff;
  padding: 2px 6px;
  border-radius: 2px;
}

.stock {
  color: #67c23a;
}

.price {
  color: #e6a23c;
}
</style>