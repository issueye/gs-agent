#!/bin/bash
# package-all.sh - 完整打包脚本

set -e

echo "=== GTS 系统完整打包 ==="
echo ""

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

DIST_DIR="dist/release"

# 1. 构建 GoScript
echo -e "${YELLOW}[1/4] 构建 GoScript...${NC}"
cd gts
go build -ldflags="-s -w" -o gs.exe ./cmd/gs
cd ..
echo -e "${GREEN}✓ GoScript 构建完成${NC}"
echo ""

# 2. 打包 Agent
echo -e "${YELLOW}[2/4] 打包 Agent...${NC}"
cd gs-agent
../gts/gs.exe --timeout 60s dist . ../dist/gs-agent.exe
cd ..
echo -e "${GREEN}✓ Agent 打包完成${NC}"
echo ""

# 3. 打包 Gateway
echo -e "${YELLOW}[3/4] 打包 Gateway...${NC}"
cd gs-gateway
../gts/gs.exe --timeout 60s dist . ../dist/gs-gateway.exe
cd ..
echo -e "${GREEN}✓ Gateway 打包完成${NC}"
echo ""

# 4. 构建桌面端
echo -e "${YELLOW}[4/4] 构建桌面端...${NC}"
cd desktop
wails3 build
cd ..
echo -e "${GREEN}✓ 桌面端构建完成${NC}"
echo ""

# 5. 组装发布包
echo -e "${YELLOW}组装发布包...${NC}"
rm -rf $DIST_DIR
mkdir -p $DIST_DIR

# 复制可执行文件
cp dist/gs-agent.exe $DIST_DIR/
cp dist/gs-gateway.exe $DIST_DIR/
cp desktop/build/bin/desktop* $DIST_DIR/ 2>/dev/null || cp desktop/bin/desktop* $DIST_DIR/

# 创建启动脚本
cat > $DIST_DIR/start.sh << 'EOF'
#!/bin/bash
./gs-gateway.exe &
sleep 2
./desktop
EOF
chmod +x $DIST_DIR/start.sh

cat > $DIST_DIR/start.bat << 'EOF'
@echo off
start /B gs-gateway.exe
timeout /t 2 /nobreak >nul
start desktop.exe
EOF

cat > $DIST_DIR/README.txt << 'EOF'
GTS System - Release Package

Files:
- gs-agent.exe      Agent 可执行文件
- gs-gateway.exe    Gateway 可执行文件
- desktop.exe       桌面应用

Usage:
  Windows: start.bat
  Linux:   ./start.sh

Or manually:
  1. ./gs-gateway.exe
  2. ./desktop.exe
EOF

echo -e "${GREEN}=== 打包完成 ===${NC}"
echo ""
echo "发布包位置: $DIST_DIR"
echo ""
ls -lh $DIST_DIR
