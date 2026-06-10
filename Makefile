# Makefile - GTS 系统构建

.PHONY: all build clean install test help package

# 变量
GO=go
NPM=npm
GTS_BIN=dist/bin/gs.exe
DESKTOP_DIR=desktop

# 默认目标
all: build

# 帮助信息
help:
	@echo "GTS 系统构建命令:"
	@echo "  make build    - 构建所有组件"
	@echo "  make package  - 打包为可分发程序"
	@echo "  make gts      - 只构建 GoScript"
	@echo "  make desktop  - 只构建桌面端"
	@echo "  make clean    - 清理构建产物"
	@echo "  make test     - 运行测试"
	@echo "  make install  - 安装依赖"

# 完整打包
package:
	@bash package-all.sh

# 构建所有
build: gts desktop scripts
	@echo "✓ 构建完成"

# 构建 GoScript
gts:
	@echo "构建 GoScript..."
	@cd gts && $(GO) build -ldflags="-s -w" -o gs.exe ./cmd/gs
	@mkdir -p dist/bin
	@cp gts/gs.exe $(GTS_BIN)
	@echo "✓ GoScript 构建完成"

# 构建桌面端
desktop:
	@echo "构建桌面端..."
	@cd $(DESKTOP_DIR) && wails3 build
	@echo "✓ 桌面端构建完成"

# 创建启动脚本
scripts:
	@echo "创建启动脚本..."
	@mkdir -p dist
	@echo "#!/bin/bash" > dist/start-gateway.sh
	@echo "cd gs-gateway && ../$(GTS_BIN) main.gs" >> dist/start-gateway.sh
	@chmod +x dist/start-gateway.sh
	@echo "#!/bin/bash" > dist/start-agent.sh
	@echo "cd gs-agent && ../$(GTS_BIN) main.gs" >> dist/start-agent.sh
	@chmod +x dist/start-agent.sh
	@echo "✓ 启动脚本创建完成"

# 清理
clean:
	@echo "清理构建产物..."
	@rm -rf dist
	@rm -f gts/gs.exe
	@rm -rf $(DESKTOP_DIR)/build
	@echo "✓ 清理完成"

# 安装依赖
install:
	@echo "安装依赖..."
	@cd $(DESKTOP_DIR)/frontend && $(NPM) install
	@echo "✓ 依赖安装完成"

# 测试
test:
	@echo "运行测试..."
	@cd gts && $(GO) test ./...
	@echo "✓ 测试完成"

# 快速启动
run-gateway:
	@cd gs-gateway && ../$(GTS_BIN) main.gs

run-agent:
	@cd gs-agent && ../$(GTS_BIN) main.gs
