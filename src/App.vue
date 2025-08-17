<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import MaterialManagement from './components/MaterialManagement.vue'
import InboundManagement from './components/InboundManagement.vue'
import OutboundManagement from './components/OutboundManagement.vue'
import OrderManagement from './components/OrderManagement.vue'
import Dashboard from './components/Dashboard.vue'
import { MaterialDB } from './database.js'
import { DataBoard, Box, Download, Upload, Document, Lightning } from '@element-plus/icons-vue'

const activeTab = ref('dashboard')
const statistics = ref({
  totalMaterials: 0,
  lowStockCount: 0,
  totalValue: 0
})

const menuItems = [
  { key: 'dashboard', label: '仪表盘', icon: DataBoard },
  { key: 'materials', label: '物资管理', icon: Box },
  { key: 'inbound', label: '入库管理', icon: Download },
  { key: 'outbound', label: '出库管理', icon: Upload },
  { key: 'orders', label: '订单管理', icon: Document }
]

const loadStatistics = async () => {
  try {
    await MaterialDB.init()
    statistics.value = MaterialDB.getStatistics()
  } catch (error) {
    console.error('加载统计数据失败:', error)
    ElMessage.error('加载统计数据失败')
  }
}

const handleTabChange = (tab) => {
  activeTab.value = tab
  if (tab === 'dashboard') {
    loadStatistics()
  }
}

onMounted(async () => {
  await loadStatistics()
})
</script>

<template>
  <div class="app-container">
    <!-- 顶部标题栏 -->
    <div class="header">
      <h1 class="title">
        <el-icon class="title-icon"><Lightning /></el-icon>
        物资管理系统
      </h1>
      <div class="stats-bar">
        <div class="stat-item">
          <span class="stat-label">总物资数:</span>
          <span class="stat-value">{{ statistics.totalMaterials }}</span>
        </div>
        <div class="stat-item warning" v-if="statistics.lowStockCount > 0">
          <span class="stat-label">库存预警:</span>
          <span class="stat-value">{{ statistics.lowStockCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">总价值:</span>
          <span class="stat-value">¥{{ statistics.totalValue.toLocaleString() }}</span>
        </div>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="main-content">
      <!-- 侧边导航 -->
      <div class="sidebar">
        <el-menu
          :default-active="activeTab"
          class="sidebar-menu"
          @select="handleTabChange"
        >
          <el-menu-item
            v-for="item in menuItems"
            :key="item.key"
            :index="item.key"
          >
            <el-icon v-if="item.icon"><component :is="item.icon" /></el-icon>
            <span>{{ item.label }}</span>
          </el-menu-item>
        </el-menu>
      </div>

      <!-- 内容区域 -->
      <div class="content-area">
        <div class="page-container">
          <Dashboard v-if="activeTab === 'dashboard'" @refresh="loadStatistics" />
          <MaterialManagement v-else-if="activeTab === 'materials'" @refresh="loadStatistics" />
          <InboundManagement v-else-if="activeTab === 'inbound'" @refresh="loadStatistics" />
          <OutboundManagement v-else-if="activeTab === 'outbound'" @refresh="loadStatistics" />
          <OrderManagement v-else-if="activeTab === 'orders'" @refresh="loadStatistics" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f5f7fa;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-icon {
  font-size: 28px;
}

.stats-bar {
  display: flex;
  gap: 24px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  backdrop-filter: blur(10px);
}

.stat-item.warning {
  background: rgba(255, 193, 7, 0.2);
  border: 1px solid rgba(255, 193, 7, 0.3);
}

.stat-label {
  font-size: 12px;
  opacity: 0.9;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
}

.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.sidebar {
  width: 200px;
  background: white;
  border-right: 1px solid #e4e7ed;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.05);
}

.sidebar-menu {
  border: none;
  height: 100%;
}

.sidebar-menu .el-menu-item {
  height: 56px;
  line-height: 56px;
  padding-left: 24px;
  border-bottom: 1px solid #f0f2f5;
}

.sidebar-menu .el-menu-item:hover {
  background-color: #f0f9ff;
  color: #1890ff;
}

.sidebar-menu .el-menu-item.is-active {
  background-color: #e6f7ff;
  color: #1890ff;
  border-right: 3px solid #1890ff;
}

.content-area {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  /* 保留滚动条槽位，避免不同页面是否出现滚动条导致宽度变化 */
  scrollbar-gutter: stable;
  background-color: #f5f7fa;
  /* 居中内容，便于固定容器宽度时在大屏保持居中 */
  display: flex;
  justify-content: center;
}

/* 统一页面内容最大宽度，保持各页面一致 */
.page-container {
  width: 60vw;
  margin: 0 auto;
}
</style>
