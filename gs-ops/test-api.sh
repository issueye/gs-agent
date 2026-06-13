#!/bin/bash
# GS-OPS API 测试脚本

API_BASE="http://127.0.0.1:7310/api"

echo "========================================="
echo "GS-OPS API 完整测试"
echo "========================================="
echo ""

echo "1. 健康检查"
curl -s $API_BASE/health | grep -q "\"success\":true" && echo "   ✅ 通过" || echo "   ❌ 失败"
echo ""

echo "2. 获取服务列表"
SERVICES=$(curl -s $API_BASE/services)
echo "$SERVICES" | grep -q "\"success\":true" && echo "   ✅ 通过" || echo "   ❌ 失败"
SERVICE_COUNT=$(echo "$SERVICES" | grep -o '"id":"[^"]*"' | wc -l)
echo "   服务数量: $SERVICE_COUNT"
echo ""

echo "3. 获取服务详情 (gateway)"
curl -s $API_BASE/services/gateway | grep -q "\"id\":\"gateway\"" && echo "   ✅ 通过" || echo "   ❌ 失败"
echo ""

echo "4. 获取操作日志"
curl -s $API_BASE/services/gateway/logs | grep -q "\"success\":true" && echo "   ✅ 通过" || echo "   ❌ 失败"
echo ""

echo "5. 获取版本历史"
curl -s $API_BASE/services/gateway/versions | grep -q "\"success\":true" && echo "   ✅ 通过" || echo "   ❌ 失败"
echo ""

echo "6. 获取服务模板"
TEMPLATES=$(curl -s $API_BASE/service-templates)
echo "$TEMPLATES" | grep -q "\"success\":true" && echo "   ✅ 通过" || echo "   ❌ 失败"
TEMPLATE_COUNT=$(echo "$TEMPLATES" | grep -o '"id":"[^"]*"' | wc -l)
echo "   模板数量: $TEMPLATE_COUNT"
echo ""

echo "7. 测试服务操作 - 停止服务"
curl -s -X POST $API_BASE/services/gateway/stop | grep -q "\"status\":\"stopped\"" && echo "   ✅ 通过" || echo "   ❌ 失败"
echo ""

echo "8. 测试服务操作 - 启动服务"
curl -s -X POST $API_BASE/services/gateway/start | grep -q "\"status\":\"running\"" && echo "   ✅ 通过" || echo "   ❌ 失败"
echo ""

echo "9. 获取服务状态"
curl -s $API_BASE/services/gateway/status | grep -q "\"success\":true" && echo "   ✅ 通过" || echo "   ❌ 失败"
echo ""

echo "10. 检查数据库文件"
if [ -f "storage/gs-ops.db" ]; then
    SIZE=$(du -h storage/gs-ops.db | cut -f1)
    echo "   ✅ 数据库文件存在: $SIZE"
else
    echo "   ❌ 数据库文件不存在"
fi
echo ""

echo "========================================="
echo "测试完成！"
echo "========================================="
