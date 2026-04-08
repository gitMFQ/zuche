#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$SCRIPT_DIR/.pids"

if [ ! -f "$PID_FILE" ]; then
    echo "没有找到正在运行的服务"
    exit 0
fi

echo "正在停止服务..."

# 读取并终止所有 PID 及其子进程
while IFS= read -r pid; do
    if [ -n "$pid" ]; then
        # 先终止所有子进程
        children=$(pgrep -P "$pid" 2>/dev/null)
        for child in $children; do
            # 递归终止子进程的子进程
            grandchildren=$(pgrep -P "$child" 2>/dev/null)
            for gc in $grandchildren; do
                kill "$gc" 2>/dev/null
            done
            kill "$child" 2>/dev/null
        done
        # 再终止主进程
        kill "$pid" 2>/dev/null
        if [ $? -eq 0 ]; then
            echo "   已停止进程: $pid 及其子进程"
        else
            echo "   进程不存在或已停止: $pid"
        fi
    fi
done < "$PID_FILE"

# 额外清理：终止可能残留的 tsx/node dev 进程
pkill -f "tsx watch" 2>/dev/null
pkill -f "vite" 2>/dev/null

# 清理 PID 文件
rm -f "$PID_FILE"

echo ""
echo "✅ 所有服务已停止"
