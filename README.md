# 物资管理系统（Vue 3 + Vite + Electron）

一个支持离线使用的桌面端物资管理应用，包含入库、出库、物资管理、订单管理、库存预警与统计面板等功能。前端由 Vue 3 + Element Plus 构建，通过 Electron 打包为 Windows 客户端，数据库采用 SQL.js（WASM），数据保存在本地。

## 功能特性
- 仪表盘统计（总物资、入库/出库统计、低库存概览）
- 物资管理：新增/编辑/删除、库存数量与阈值维护
- 入库管理：入库记录、查询与导出
- 出库管理：出库记录、查询与导出
- 订单管理：订单新增、编辑与状态更新
- 库存预警：低于阈值的物资列表
- 数据导出：在相关模块提供导出按钮
- 离线可用：内置 SQL.js，首次启动自动初始化数据库

## 技术栈
- Vue 3 + `<script setup>`
- Element Plus
- Vite
- Electron（主进程入口：dist-electron/main.cjs）
- SQL.js（WASM，静态资源内置到 dist/）

## 开发与调试
```bash
# 安装依赖
npm install

# 前端 + Electron 开发调试（推荐）
npm run electron:dev

# 仅前端（浏览器）开发调试
npm run dev

# 构建前端产物（生成 dist/）
npm run build
```

## 打包发布（Windows）
已配置国内镜像以提升下载稳定性，可直接执行：
```bash
# 生成 Windows x64 安装包与便携版
npm run dist:win
```
生成的产物默认位于 release/ 目录：
- 便携版（免安装）：`release/win-unpacked/物资管理系统.exe`
- 安装包（NSIS 安装程序）：`release/物资管理系统 Setup 0.0.0.exe`

在 Windows 上使用：
- 便携版：将整个 `win-unpacked/` 文件夹复制到目标机器，双击 `物资管理系统.exe` 即可运行
- 安装包：将 `物资管理系统 Setup 0.0.0.exe` 复制到目标机器，双击按向导安装

## 离线与数据存储说明
- SQL.js 的 `sql-wasm.wasm` 已随应用打包在本地，生产环境通过 `file://` 路径加载，可完全离线使用
- 应用数据使用浏览器本地存储（localStorage）进行持久化，卸载应用不会自动删除数据；可通过导出功能进行备份

## 自定义与配置
- 应用图标：在 `package.json` 的 `build.win.icon` 指向 `public/icon.ico`；将你的图标文件放置为该路径即可在打包时使用（当前如未提供，将使用 Electron 默认图标）
- 应用信息：建议在 `package.json` 中补充 `description` 与 `author`
- 开发端口：默认使用 5173；如需修改，请同步调整 `dist-electron/main.cjs` 中开发模式的 `loadURL`

## 常见问题
- 开发模式白屏：确保 Vite 成功启动在 5173 端口；项目脚本已使用 `wait-on` 确保 Electron 在前端可用后再启动
- wasm 加载失败：项目已设置 `vite.config.js` 的 `base: './'` 以及主进程关闭 `webSecurity` 以允许本地 `file://` 资源；若仍有问题，可改用主进程注入绝对路径的方案

---
如需进一步定制（自动更新、签名证书、品牌图标、安装向导文案等），告诉我你的需求，我可以继续完善。
