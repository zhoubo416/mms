<script setup>
import { ref, onMounted } from 'vue'
import { MaterialDB } from '../database.js'
import { ElMessage } from 'element-plus'

const emit = defineEmits(['refresh'])

const statistics = ref({
  totalMaterials: 0,
  lowStockCount: 0,
  totalValue: 0
})

const lowStockMaterials = ref([])
const recentInbound = ref([])
const recentOutbound = ref([])

const loadDashboardData = async () => {
  try {
    // 确保数据库已初始化
    await MaterialDB.init()
    
    const stats = MaterialDB.getStatistics()
    statistics.value = stats
    
    lowStockMaterials.value = MaterialDB.getLowStockMaterials()
    recentInbound.value = MaterialDB.getInboundRecords(5)
    recentOutbound.value = MaterialDB.getOutboundRecords(5)
    
    emit('refresh')
  } catch (error) {
    console.error('加载仪表盘数据失败:', error)
    ElMessage.error('加载仪表盘数据失败')
  }
}

const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleString('zh-CN')
}

const getStockStatus = (current, min) => {
  if (current <= 0) return 'danger'
  if (current <= min) return 'warning'
  return 'success'
}

const getStockStatusText = (current, min) => {
  if (current <= 0) return '缺货'
  if (current <= min) return '库存不足'
  return '正常'
}

onMounted(() => {
  loadDashboardData()
})
</script>

<template>
  <div class="dashboard">
    <div class="page-header">
      <h2>系统概览</h2>
      <el-button type="primary" @click="loadDashboardData">
        <el-icon><Refresh /></el-icon>
        刷新数据
      </el-button>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon primary">
            <el-icon><Box /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-number">{{ statistics.totalMaterials }}</div>
            <div class="stat-label">总物资种类</div>
          </div>
        </div>
      </el-card>

      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon warning">
            <el-icon><Warning /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-number">{{ statistics.lowStockCount }}</div>
            <div class="stat-label">库存预警</div>
          </div>
        </div>
      </el-card>

      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon success">
            <el-icon><Money /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-number">¥{{ statistics.totalValue.toLocaleString() }}</div>
            <div class="stat-label">总库存价值</div>
          </div>
        </div>
      </el-card>

      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon info">
            <el-icon><DataBoard /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-number">{{ recentInbound.length + recentOutbound.length }}</div>
            <div class="stat-label">今日操作</div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 内容区域 -->
    <div class="dashboard-content">
      <!-- 库存预警 -->
      <div class="dashboard-section">
        <el-card>
          <template #header>
            <div class="section-header">
              <h3>库存预警</h3>
              <el-tag v-if="lowStockMaterials.length > 0" type="warning">
                {{ lowStockMaterials.length }} 项需要关注
              </el-tag>
            </div>
          </template>
          
          <div v-if="lowStockMaterials.length === 0" class="empty-state">
            <el-icon class="empty-icon"><SuccessFilled /></el-icon>
            <p>所有物资库存充足</p>
          </div>
          
          <el-table v-else :data="lowStockMaterials" style="width: 100%">
            <el-table-column prop="name" label="物资名称" />
            <el-table-column prop="specification" label="型号" />
            <el-table-column prop="current_stock" label="当前库存" width="100">
              <template #default="{ row }">
                <el-tag :type="getStockStatus(row.current_stock, row.min_stock)">
                  {{ row.current_stock }} {{ row.unit }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="min_stock" label="最低库存" width="100">
              <template #default="{ row }">
                {{ row.min_stock }} {{ row.unit }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="getStockStatus(row.current_stock, row.min_stock)">
                  {{ getStockStatusText(row.current_stock, row.min_stock) }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>

      <!-- 最近操作记录 -->
      <div class="dashboard-grid">
        <!-- 最近入库 -->
        <el-card>
          <template #header>
            <h3>最近入库记录</h3>
          </template>
          
          <div v-if="recentInbound.length === 0" class="empty-state">
            <el-icon class="empty-icon"><Document /></el-icon>
            <p>暂无入库记录</p>
          </div>
          
          <div v-else class="record-list">
            <div v-for="record in recentInbound" :key="record.id" class="record-item">
              <div class="record-info">
                <div class="record-title">{{ record.material_name }}</div>
                <div class="record-detail">
                  数量: {{ record.quantity }} {{ record.unit }} | 操作员: {{ record.operator }}
                </div>
                <div class="record-time">{{ formatDate(record.created_at) }}</div>
              </div>
              <div class="record-action">
                <el-tag type="success">入库</el-tag>
              </div>
            </div>
          </div>
        </el-card>

        <!-- 最近出库 -->
        <el-card>
          <template #header>
            <h3>最近出库记录</h3>
          </template>
          
          <div v-if="recentOutbound.length === 0" class="empty-state">
            <el-icon class="empty-icon"><Document /></el-icon>
            <p>暂无出库记录</p>
          </div>
          
          <div v-else class="record-list">
            <div v-for="record in recentOutbound" :key="record.id" class="record-item">
              <div class="record-info">
                <div class="record-title">{{ record.material_name }}</div>
                <div class="record-detail">
                  数量: {{ record.quantity }} {{ record.unit }} | 领用人: {{ record.recipient }}
                </div>
                <div class="record-time">{{ formatDate(record.created_at) }}</div>
              </div>
              <div class="record-action">
                <el-tag type="warning">出库</el-tag>
              </div>
            </div>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  padding: 0;
  width: 100%;
}

/* 与其他页面统一的页头样式 */
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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}

.stat-card {
  border: none;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: white;
}

.stat-icon.primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stat-icon.warning {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stat-icon.success {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.stat-icon.info {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

.stat-info {
  flex: 1;
}

.stat-number {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.dashboard-section {
  width: 100%;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-header h3 {
  margin: 0;
  color: #303133;
  font-size: 16px;
  font-weight: 600;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #909399;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.record-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.record-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #e4e7ed;
}

.record-info {
  flex: 1;
}

.record-title {
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.record-detail {
  font-size: 12px;
  color: #606266;
  margin-bottom: 4px;
}

.record-time {
  font-size: 11px;
  color: #909399;
}

.record-action {
  margin-left: 12px;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }
}
</style>