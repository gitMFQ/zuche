#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$SCRIPT_DIR/.pids"

# 检查是否已有服务在运行
if [ -f "$PID_FILE" ]; then
    echo "检测到服务可能已在运行，先执行停止..."
    bash "$SCRIPT_DIR/stop.sh"
    sleep 1
fi

# 启动后端
echo "正在启动后端服务..."
cd "$SCRIPT_DIR/backend" && npm run dev > /dev/null 2>&1 &
BACKEND_PID=$!

# 启动前端
echo "正在启动前端服务..."
cd "$SCRIPT_DIR/frontend" && npm run dev > /dev/null 2>&1 &
FRONTEND_PID=$!

# 保存 PID
echo "$BACKEND_PID" > "$PID_FILE"
echo "$FRONTEND_PID" >> "$PID_FILE"

# 等待服务启动
sleep 3

# 检查服务是否成功启动
BACKEND_RUNNING=$(ps -p $BACKEND_PID -o pid= 2>/dev/null)
FRONTEND_RUNNING=$(ps -p $FRONTEND_PID -o pid= 2>/dev/null)

if [ -z "$BACKEND_RUNNING" ] || [ -z "$FRONTEND_RUNNING" ]; then
    echo "❌ 服务启动失败，请检查日志"
    if [ -z "$BACKEND_RUNNING" ]; then
        echo "   后端启动失败"
    fi
    if [ -z "$FRONTEND_RUNNING" ]; then
        echo "   前端启动失败"
    fi
    bash "$SCRIPT_DIR/stop.sh" 2>/dev/null
    exit 1
fi

echo ""
echo "✅ 服务启动成功！"
echo "   后端: http://localhost:3001"
echo "   前端: http://localhost:5173"
echo ""
echo "📋 停止服务请执行: ./stop.sh"
echo ""
