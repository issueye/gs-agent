# GS-OPS 服务管理系统 - 开发计划

## 项目概述

**项目名称**：GS-OPS（GoScript Operations Management System）  
**技术栈**：
- **后端**：GTS (GoScript) + MVC 架构
- **前端**：Vue 3 + Tailwind CSS + Vite + JavaScript + Pinia
- **通信**：RESTful API / WebSocket

**核心功能**：提供统一的服务管理平台，支持服务的安装、启动、停止、重启、升级、监控等操作。

---

## 一、项目架构

### 1.1 整体架构

```
gs-ops/
├── backend/              # GTS 后端
│   ├── main.gs          # 入口文件
│   ├── config/          # 配置
│   ├── controllers/     # 控制器层
│   ├── services/        # 服务层
│   ├── models/          # 模型层
│   ├── middlewares/     # 中间件
│   ├── routes/          # 路由定义
│   └── utils/           # 工具函数
│
├── frontend/            # Vue 前端
│   ├── src/
│   │   ├── assets/      # 静态资源
│   │   ├── components/  # 组件
│   │   ├── views/       # 页面
│   │   ├── stores/      # Pinia 状态管理
│   │   ├── router/      # 路由
│   │   ├── api/         # API 调用
│   │   └── utils/       # 工具函数
│   ├── public/
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── services/            # 服务定义
│   └── *.service.json   # 服务配置文件
│
├── docs/                # 文档
│   ├── API.md
│   └── DEPLOYMENT.md
│
└── README.md
```

### 1.2 技术架构

```
┌─────────────────────────────────────────┐
│           前端 (Vue 3)                   │
│  ┌──────────┬──────────┬──────────┐    │
│  │  Views   │  Stores  │  Router  │    │
│  └──────────┴──────────┴──────────┘    │
│           ▼ HTTP/WS ▼                   │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│         后端 (GTS MVC)                   │
│  ┌──────────────────────────────────┐  │
│  │         Routes (路由)             │  │
│  └──────────────┬───────────────────┘  │
│                 ▼                       │
│  ┌──────────────────────────────────┐  │
│  │      Controllers (控制器)         │  │
│  └──────────────┬───────────────────┘  │
│                 ▼                       │
│  ┌──────────────────────────────────┐  │
│  │       Services (业务逻辑)         │  │
│  └──────────────┬───────────────────┘  │
│                 ▼                       │
│  ┌──────────────────────────────────┐  │
│  │        Models (数据模型)          │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│          系统服务层                      │
│  ┌──────┬──────┬──────┬──────┐         │
│  │ 安装 │ 启动 │ 监控 │ 日志 │         │
│  └──────┴──────┴──────┴──────┘         │
└─────────────────────────────────────────┘
```

---

## 二、功能模块

### 2.1 核心功能

#### 服务管理
- ✅ 服务列表展示
- ✅ 服务安装
- ✅ 服务启动 / 停止
- ✅ 服务重启
- ✅ 服务卸载
- ✅ 服务配置管理

#### 服务监控
- ✅ 服务状态监控（运行/停止）
- ✅ CPU/内存使用率
- ✅ 进程 PID 信息
- ✅ 运行时长统计
- ✅ 实时日志查看

#### 版本管理
- ✅ 服务版本查看
- ✅ 版本升级
- ✅ 版本回滚
- ✅ 版本历史记录

#### 日志管理
- ✅ 实时日志流
- ✅ 日志搜索
- ✅ 日志下载
- ✅ 日志清理

#### 配置管理
- ✅ 配置文件编辑
- ✅ 配置验证
- ✅ 配置备份
- ✅ 配置恢复

#### 用户管理
- ✅ 用户登录/登出
- ✅ 权限控制
- ✅ 操作日志审计

---

## 三、数据模型

### 3.1 服务模型 (Service)

```javascript
{
  "id": "service-001",
  "name": "nginx",
  "displayName": "Nginx Web Server",
  "description": "高性能 Web 服务器",
  "version": "1.21.0",
  "status": "running",  // running, stopped, error
  "type": "systemd",    // systemd, supervisor, docker, binary
  "installPath": "/usr/local/nginx",
  "configPath": "/etc/nginx/nginx.conf",
  "logPath": "/var/log/nginx",
  "port": 80,
  "pid": 12345,
  "uptime": 86400,      // 秒
  "autoStart": true,
  "dependencies": ["mysql", "redis"],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### 3.2 服务配置 (ServiceConfig)

```javascript
{
  "serviceId": "service-001",
  "name": "nginx",
  "commands": {
    "install": "apt install nginx",
    "start": "systemctl start nginx",
    "stop": "systemctl stop nginx",
    "restart": "systemctl restart nginx",
    "status": "systemctl status nginx",
    "uninstall": "apt remove nginx"
  },
  "environment": {
    "NGINX_PORT": "80",
    "NGINX_USER": "www-data"
  },
  "healthCheck": {
    "enabled": true,
    "interval": 30,
    "url": "http://localhost/health"
  }
}
```

### 3.3 操作日志 (OperationLog)

```javascript
{
  "id": "log-001",
  "serviceId": "service-001",
  "operation": "start",
  "status": "success",
  "message": "服务启动成功",
  "operator": "admin",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

---

## 四、API 设计

### 4.1 服务管理 API

```
# 获取服务列表
GET    /api/services

# 获取服务详情
GET    /api/services/:id

# 安装服务
POST   /api/services/:id/install

# 启动服务
POST   /api/services/:id/start

# 停止服务
POST   /api/services/:id/stop

# 重启服务
POST   /api/services/:id/restart

# 卸载服务
DELETE /api/services/:id/uninstall

# 获取服务状态
GET    /api/services/:id/status

# 更新服务配置
PUT    /api/services/:id/config
```

### 4.2 监控 API

```
# 获取服务监控数据
GET    /api/services/:id/metrics

# 获取服务日志
GET    /api/services/:id/logs

# 实时日志流 (WebSocket)
WS     /ws/services/:id/logs
```

### 4.3 版本管理 API

```
# 获取版本列表
GET    /api/services/:id/versions

# 升级服务
POST   /api/services/:id/upgrade

# 回滚服务
POST   /api/services/:id/rollback
```

---

## 五、开发计划

### 第一阶段：基础架构（Week 1-2）

#### 后端开发
- [x] 项目初始化
- [x] MVC 架构搭建
  - [x] 路由系统
  - [x] 控制器基类
  - [x] 服务层基类
  - [x] 模型层基类
- [x] 中间件系统
  - [x] 日志中间件
  - [ ] 认证中间件（占位放行，待实装）
  - [x] CORS 中间件
  - [x] 错误处理中间件
- [x] 数据存储（SQLite + std/orm，JSON 自动迁移）
- [x] 配置管理系统

#### 前端开发
- [x] 项目初始化（Vite + Vue 3）
- [x] Tailwind CSS 配置
- [x] 路由配置
- [x] Pinia 状态管理
- [x] API 封装
- [x] 通用组件开发
  - [x] 布局组件
  - [x] 表格组件
  - [x] 表单组件
  - [x] 弹窗组件

### 第二阶段：核心功能（Week 3-4）

#### 服务管理
- [x] 服务列表展示
- [x] 服务启动/停止/重启（真实进程托管）
- [x] 服务状态查询（含 PID 存活校验）
- [x] 服务配置编辑

#### 服务监控
- [x] 实时状态监控（按需采集 + 存活校验）
- [x] 资源使用监控（实测 CPU/内存）
- [x] 进程信息展示（真实 PID / uptime）
- [x] 日志实时查看（进程 stdout/stderr，轮询刷新；实时流待 WebSocket）

#### 用户界面
- [ ] Dashboard 页面
- [ ] 服务列表页面
- [ ] 服务详情页面
- [ ] 日志查看页面
- [ ] 配置管理页面

### 第三阶段：高级功能（Week 5-6）

#### 服务安装
- [x] 服务模板管理
- [x] 安装向导（基于模板创建 + 目录准备 + install 命令）
- [ ] 依赖检查
- [ ] 安装进度展示

#### 版本管理
- [x] 版本列表
- [x] 版本升级（快照备份 + 部署包 + 失败自动回滚）
- [x] 版本回滚（从固定路径快照恢复安装目录）
- [ ] 版本对比

#### 批量操作
- [ ] 批量启动/停止
- [ ] 批量升级
- [ ] 批量配置

### 第四阶段：优化和测试（Week 7-8）

#### 性能优化
- [ ] 接口性能优化
- [ ] 前端性能优化
- [ ] WebSocket 优化

#### 测试
- [ ] 单元测试
- [ ] 集成测试
- [ ] E2E 测试
- [ ] 压力测试

#### 文档
- [ ] API 文档
- [ ] 用户手册
- [ ] 部署文档

---

## 六、技术选型

### 6.1 后端技术栈

| 技术 | 说明 |
|------|------|
| GTS | 脚本语言，主要业务逻辑 |
| @std/web | HTTP 服务框架 |
| @std/fs | 文件系统操作 |
| @std/exec | 进程执行 |
| @std/json | JSON 处理 |
| @std/validation | 数据验证 |
| @std/jwt | 认证 |

### 6.2 前端技术栈

| 技术 | 说明 |
|------|------|
| Vue 3 | 前端框架 |
| Vite | 构建工具 |
| Pinia | 状态管理 |
| Vue Router | 路由管理 |
| Tailwind CSS | CSS 框架 |
| Axios | HTTP 客户端 |
| Chart.js | 数据可视化 |
| xterm.js | 终端模拟器 |

---

## 七、目录结构详细设计

### 7.1 后端目录

```
backend/
├── main.gs                  # 入口文件
├── project.toml             # 项目配置
├── config.toml              # 运行配置
│
├── app/
│   ├── bootstrap.gs         # 应用启动
│   └── kernel.gs            # 核心内核
│
├── config/
│   ├── app.gs              # 应用配置
│   ├── database.gs         # 数据库配置
│   └── routes.gs           # 路由配置
│
├── controllers/
│   ├── BaseController.gs
│   ├── ServiceController.gs
│   ├── MonitorController.gs
│   ├── LogController.gs
│   └── ConfigController.gs
│
├── services/
│   ├── ServiceManager.gs    # 服务管理
│   ├── ProcessManager.gs    # 进程管理
│   ├── LogManager.gs        # 日志管理
│   └── ConfigManager.gs     # 配置管理
│
├── models/
│   ├── Service.gs
│   ├── ServiceConfig.gs
│   └── OperationLog.gs
│
├── middlewares/
│   ├── auth.gs              # 认证
│   ├── logger.gs            # 日志
│   ├── cors.gs              # CORS
│   └── errorHandler.gs      # 错误处理
│
├── routes/
│   ├── api.gs               # API 路由
│   └── ws.gs                # WebSocket 路由
│
└── utils/
    ├── response.gs          # 响应封装
    ├── validator.gs         # 验证工具
    └── system.gs            # 系统工具
```

### 7.2 前端目录

```
frontend/
├── src/
│   ├── main.js              # 入口文件
│   ├── App.vue              # 根组件
│   │
│   ├── assets/
│   │   ├── styles/
│   │   │   └── main.css     # 全局样式
│   │   └── images/
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.vue
│   │   │   ├── Sidebar.vue
│   │   │   └── Footer.vue
│   │   ├── service/
│   │   │   ├── ServiceCard.vue
│   │   │   ├── ServiceTable.vue
│   │   │   └── ServiceStatus.vue
│   │   └── common/
│   │       ├── Button.vue
│   │       ├── Modal.vue
│   │       └── Loading.vue
│   │
│   ├── views/
│   │   ├── Dashboard.vue    # 仪表盘
│   │   ├── ServiceList.vue  # 服务列表
│   │   ├── ServiceDetail.vue # 服务详情
│   │   ├── Logs.vue         # 日志查看
│   │   └── Settings.vue     # 设置
│   │
│   ├── stores/
│   │   ├── service.js       # 服务状态
│   │   ├── monitor.js       # 监控状态
│   │   └── user.js          # 用户状态
│   │
│   ├── router/
│   │   └── index.js         # 路由配置
│   │
│   ├── api/
│   │   ├── service.js       # 服务 API
│   │   ├── monitor.js       # 监控 API
│   │   └── log.js           # 日志 API
│   │
│   └── utils/
│       ├── request.js       # HTTP 封装
│       ├── websocket.js     # WebSocket 封装
│       └── format.js        # 格式化工具
│
├── public/
│   └── favicon.ico
│
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

---

## 八、关键技术实现

### 8.1 服务管理核心逻辑

```javascript
// ServiceManager.gs
class ServiceManager {
  // 启动服务
  start(serviceId) {
    let service = this.getService(serviceId);
    let cmd = service.commands.start;
    let result = exec(cmd);
    return result;
  }
  
  // 停止服务
  stop(serviceId) {
    let service = this.getService(serviceId);
    let cmd = service.commands.stop;
    let result = exec(cmd);
    return result;
  }
  
  // 获取服务状态
  getStatus(serviceId) {
    // 检查进程是否存在
    // 检查端口是否监听
    // 检查健康检查接口
    return {
      status: "running",
      pid: 12345,
      uptime: 86400
    };
  }
}
```

### 8.2 实时日志流

```javascript
// 后端 WebSocket
ws.on("/services/:id/logs", (conn, params) => {
  let serviceId = params.id;
  let logStream = createLogStream(serviceId);
  
  logStream.on("data", (line) => {
    conn.send({ type: "log", data: line });
  });
});

// 前端
const ws = new WebSocket(`ws://localhost:3000/ws/services/${id}/logs`);
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  logs.value.push(data.data);
};
```

### 8.3 服务监控

```javascript
// 定期采集监控数据
setInterval(() => {
  services.forEach((service) => {
    let metrics = collectMetrics(service);
    broadcastMetrics(service.id, metrics);
  });
}, 5000);

function collectMetrics(service) {
  return {
    cpu: getCpuUsage(service.pid),
    memory: getMemoryUsage(service.pid),
    connections: getConnectionCount(service.port)
  };
}
```

---

## 九、部署方案

### 9.1 开发环境

```bash
# 后端
cd backend
gs run

# 前端
cd frontend
npm install
npm run dev
```

### 9.2 生产环境

```bash
# 后端打包
cd backend
gs dist

# 前端打包
cd frontend
npm run build

# 部署
./deploy.sh
```

---

## 十、风险和挑战

### 10.1 技术风险

| 风险 | 影响 | 应对方案 |
|------|------|----------|
| GTS 稳定性 | 高 | 充分测试，准备降级方案 |
| 进程管理复杂性 | 中 | 使用成熟的进程管理库 |
| 跨平台兼容性 | 中 | 针对不同平台适配 |
| 实时性能 | 中 | WebSocket 优化，限流 |

### 10.2 业务风险

| 风险 | 影响 | 应对方案 |
|------|------|----------|
| 权限管理 | 高 | 严格的权限验证 |
| 服务误操作 | 高 | 操作确认，操作日志 |
| 数据丢失 | 中 | 定期备份 |

---

## 十一、后续规划

### Phase 2 功能
- [ ] Docker 容器管理
- [ ] Kubernetes 集成
- [ ] 自动化部署
- [ ] 告警系统
- [ ] 性能分析

### Phase 3 功能
- [ ] 多节点管理
- [ ] 集群管理
- [ ] 负载均衡
- [ ] 服务编排

---

## 十二、总结

GS-OPS 是一个功能完整的服务管理系统，通过 GTS 后端和 Vue 3 前端的结合，提供了强大的服务管理能力。

**核心优势**：
- ✅ 统一管理多种类型服务
- ✅ 实时监控和日志
- ✅ 简单易用的 Web 界面
- ✅ 灵活的配置管理
- ✅ 完整的操作审计

**开发周期**：预计 8 周

**团队要求**：
- 1 名后端开发（GTS）
- 1 名前端开发（Vue）
- 1 名 UI/UX 设计师（可选）

---

**文档版本**：v1.0  
**创建日期**：2026-06-12  
**最后更新**：2026-06-12
