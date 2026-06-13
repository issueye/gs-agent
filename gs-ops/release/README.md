# GS-OPS 服务管理系统

一个基于 GTS + Vue 3 的现代化服务管理平台

## 特性

- 🚀 服务生命周期管理（安装、启动、停止、重启、卸载）
- 📊 实时监控（CPU、内存、进程状态）
- 📝 日志管理（实时查看、搜索、下载）
- ⚙️  配置管理（在线编辑、备份、恢复）
- 🔄 版本管理（升级、回滚）
- 👥 权限管理（用户认证、操作审计）

## 技术栈

### 后端
- GTS（GoScript）
- MVC 架构
- RESTful API
- WebSocket

### 前端
- Vue 3
- Vite
- Tailwind CSS
- Pinia
- Vue Router

## 快速开始

### 后端

```powershell
cd backend
..\..\gts\gs.exe --timeout 0 run
```

后端默认监听 `http://127.0.0.1:7310`。`--timeout 0` 用于关闭 GTS CLI 的默认 10 秒脚本超时，服务进程需要保持常驻。

### 前端

```powershell
cd frontend
npm install
npm run dev
```

前端默认监听 `http://127.0.0.1:7311`，开发环境会把 `/api` 代理到后端。

## 项目结构

```
gs-ops/
├── backend/     # GTS 后端
├── frontend/    # Vue 前端
├── services/    # 服务定义
└── docs/        # 文档
```

## 开发进度

- [x] 项目初始化
- [x] 开发计划制定
- [x] 后端架构搭建
- [x] 前端架构搭建
- [x] 核心服务列表、状态、操作审计的基础实现
- [ ] 测试和优化

## 当前能力

- GTS 后端 MVC 目录结构和 REST API 路由
- JSON 文件存储的服务清单和操作日志
- 服务启动、停止、重启、安装、卸载的安全模拟操作
- Vue 3 运维控制台，包含 Dashboard、服务列表、详情、日志和设置页面
- Pinia 状态管理、Axios API 封装、Vite 代理、Tailwind 样式系统

## License

MIT
