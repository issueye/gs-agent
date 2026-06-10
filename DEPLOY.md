# GTS 系统部署指南

## 快速开始

### 方式 1: 使用构建脚本（推荐）

**Linux/Mac:**
```bash
chmod +x build.sh
./build.sh
```

**Windows:**
```cmd
build.bat
```

### 方式 2: 使用 Makefile

```bash
make build
```

---

## 构建产物

构建完成后，目录结构如下：

```
dist/
├── bin/
│   └── gs.exe           # GoScript 可执行文件
├── start-gateway.sh     # Gateway 启动脚本
└── start-agent.sh       # Agent 启动脚本
```

---

## 启动服务

### Gateway

```bash
# Linux/Mac
./dist/start-gateway.sh

# Windows
dist\start-gateway.bat

# 或使用 Makefile
make run-gateway
```

### Agent

```bash
# Linux/Mac
./dist/start-agent.sh

# Windows
dist\start-agent.bat

# 或使用 Makefile
make run-agent
```

---

## 环境变量配置

### Gateway 配置

```bash
# 端口配置
export GATEWAY_HOST=0.0.0.0
export GATEWAY_PORT=18878

# 超时配置（毫秒）
export TASK_TIMEOUT=30000

# 启动
./dist/start-gateway.sh
```

### Agent 配置

```bash
# Agent Bridge 地址
export AGENT_BRIDGE=http://localhost:8080

# 启动
./dist/start-agent.sh
```

---

## Docker 部署（可选）

### 构建镜像

```bash
docker build -t gts-gateway -f docker/gateway.Dockerfile .
docker build -t gts-agent -f docker/agent.Dockerfile .
```

### 运行容器

```bash
# Gateway
docker run -d -p 18878:18878 \
  -e GATEWAY_PORT=18878 \
  -e TASK_TIMEOUT=30000 \
  gts-gateway

# Agent
docker run -d \
  -e AGENT_BRIDGE=http://gateway:8080 \
  gts-agent
```

---

## 开发模式

### 直接运行（无需构建）

**Gateway:**
```bash
cd gs-gateway
gs main.gs
```

**Agent:**
```bash
cd gs-agent
gs main.gs
```

### 热重载开发

使用 `nodemon` 或 `entr` 监控文件变化：

```bash
# 安装 entr
apt install entr  # Linux
brew install entr  # Mac

# 监控运行
ls gs-gateway/**/*.gs | entr -r gs gs-gateway/main.gs
```

---

## 常用命令

### Makefile 命令

```bash
make help       # 显示帮助
make build      # 构建所有
make gts        # 只构建 GoScript
make desktop    # 只构建桌面端
make clean      # 清理产物
make test       # 运行测试
make install    # 安装依赖
```

---

## 故障排查

### Go 未找到

```bash
# 安装 Go
# Linux: apt install golang
# Mac: brew install go
# Windows: 从 golang.org 下载

# 验证
go version
```

### npm 未找到

```bash
# 安装 Node.js
# Linux: apt install nodejs npm
# Mac: brew install node
# Windows: 从 nodejs.org 下载

# 验证
npm -v
```

### 权限问题

```bash
# Linux/Mac
chmod +x build.sh
chmod +x dist/*.sh

# Windows
# 以管理员身份运行 cmd
```

---

## 性能优化

### 生产环境构建

```bash
# 优化编译
cd gts
go build -ldflags="-s -w" -o gs.exe ./cmd/gs

# 前端压缩
cd desktop/frontend
npm run build -- --mode production
```

### 资源限制

```bash
# 设置内存限制
export GOGC=50  # Go GC 触发阈值

# 限制 CPU
taskset -c 0-3 ./dist/start-gateway.sh
```

---

## 监控和日志

### 日志位置

```
gs-gateway/logs/gateway.log
gs-agent/logs/agent.log
```

### 实时查看

```bash
tail -f gs-gateway/logs/gateway.log
```

---

## 更新升级

### 更新代码

```bash
git pull
make clean
make build
```

### 重启服务

```bash
# 停止服务
pkill -f "gs.exe main.gs"

# 重新启动
./dist/start-gateway.sh
./dist/start-agent.sh
```

---

## 备份和恢复

### 备份数据

```bash
tar -czf backup-$(date +%Y%m%d).tar.gz \
  gs-gateway/data \
  gs-agent/.agent
```

### 恢复数据

```bash
tar -xzf backup-20260610.tar.gz
```

---

**部署完成！** 🎉
