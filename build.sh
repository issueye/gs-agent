#!/bin/bash
# build.sh - GTS 系统一键构建脚本

set -e

echo "=== GTS 系统构建脚本 ==="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 检查依赖
check_deps() {
    echo -e "${YELLOW}检查依赖...${NC}"

    if ! command -v go &> /dev/null; then
        echo -e "${RED}✗ Go 未安装${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Go $(go version | awk '{print $3}')${NC}"

    if ! command -v npm &> /dev/null; then
        echo -e "${RED}✗ npm 未安装${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ npm $(npm -v)${NC}"

    echo ""
}

# 构建 GoScript
build_gts() {
    echo -e "${YELLOW}构建 GoScript...${NC}"
    cd gts
    go build -o gs.exe ./cmd/gs
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ GoScript 构建成功${NC}"
    else
        echo -e "${RED}✗ GoScript 构建失败${NC}"
        exit 1
    fi
    cd ..
    echo ""
}

# 构建桌面端
build_desktop() {
    echo -e "${YELLOW}构建桌面端...${NC}"
    cd desktop/frontend
    npm install
    npm run build
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ 桌面端构建成功${NC}"
    else
        echo -e "${RED}✗ 桌面端构建失败${NC}"
        exit 1
    fi
    cd ../..
    echo ""
}

# 复制可执行文件
copy_binaries() {
    echo -e "${YELLOW}复制可执行文件...${NC}"

    mkdir -p dist/bin
    cp gts/gs.exe dist/bin/

    echo -e "${GREEN}✓ 文件复制完成${NC}"
    echo ""
}

# 创建启动脚本
create_scripts() {
    echo -e "${YELLOW}创建启动脚本...${NC}"

    # Gateway 启动脚本
    cat > dist/start-gateway.sh << 'EOF'
#!/bin/bash
cd gs-gateway
../dist/bin/gs.exe main.gs
EOF
    chmod +x dist/start-gateway.sh

    # Agent 启动脚本
    cat > dist/start-agent.sh << 'EOF'
#!/bin/bash
cd gs-agent
../dist/bin/gs.exe main.gs
EOF
    chmod +x dist/start-agent.sh

    echo -e "${GREEN}✓ 启动脚本创建完成${NC}"
    echo ""
}

# 主流程
main() {
    check_deps
    build_gts
    build_desktop
    copy_binaries
    create_scripts

    echo -e "${GREEN}=== 构建完成 ===${NC}"
    echo ""
    echo "可执行文件位置:"
    echo "  - dist/bin/gs.exe"
    echo ""
    echo "启动方式:"
    echo "  - Gateway: ./dist/start-gateway.sh"
    echo "  - Agent:   ./dist/start-agent.sh"
    echo ""
}

main
