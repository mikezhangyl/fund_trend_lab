#!/bin/bash
# 实时查看市场扫描进度

echo "=== 市场扫描进度监控 ==="
echo ""

while true; do
  clear
  echo "=== 市场扫描进度监控 $(date '+%H:%M:%S') ==="
  echo ""

  # 获取扫描状态
  STATUS=$(curl -s "http://localhost:8000/api/market/scan/status")

  # 解析JSON
  IS_SCANNING=$(echo "$STATUS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('is_scanning', False))")
  PROGRESS=$(echo "$STATUS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('progress', 0))")
  TOTAL=$(echo "$STATUS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('total', 0))")
  PERCENTAGE=$(echo "$STATUS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('percentage', 0))")

  if [ "$IS_SCANNING" = "True" ]; then
    # 计算速度
    CURRENT_TIME=$(python3 -c "import time; print(time.time())")
    if [ -n "$LAST_TIME" ] && [ -n "$LAST_PROGRESS" ]; then
      TIME_DIFF=$(python3 -c "print($CURRENT_TIME - $LAST_TIME)")
      PROGRESS_DIFF=$((PROGRESS - LAST_PROGRESS))

      # 只有当时间差大于0.1秒时才更新速度，避免除以零或波动过大
      SPEED=$(python3 -c "if $TIME_DIFF > 0.1: print(int($PROGRESS_DIFF / $TIME_DIFF)); else: print(0)")
    else
      SPEED=0
    fi

    LAST_TIME=$CURRENT_TIME
    LAST_PROGRESS=$PROGRESS

    echo "📊 扫描状态: 进行中"
    echo "📈 进度: $PROGRESS / $TOTAL ($PERCENTAGE%)"
    echo "⚡️ 速度: $SPEED 个/秒"
    echo ""

    # 进度条
    BAR_LENGTH=50
    FILLED=$(python3 -c "print(int(float('$PERCENTAGE') * $BAR_LENGTH / 100))")
    BAR=$(printf "█%.0s" $(seq 1 $FILLED))
    EMPTY=$(printf "░%.0s" $(seq 1 $((BAR_LENGTH - FILLED))))
    echo "[$BAR$EMPTY] $PERCENTAGE%"
  else
    if [ "$TOTAL" -gt 0 ]; then
      echo "✅ 扫描完成"
      echo "📊 总扫描: $TOTAL 只基金"
      echo ""

      # 获取结果数量
      RESULTS=$(curl -s "http://localhost:8000/api/market/scan/results")
      COUNT=$(echo "$RESULTS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('count', 0))")
      echo "🎯 找到符合条件的基金: $COUNT 只"
      echo ""
      echo "按 Ctrl+C 退出"
      break
    else
      echo "⏸️  未开始扫描"
      echo ""
      echo "请在网页上点击\"开始扫描\"按钮"
    fi
  fi

  echo ""
  echo "刷新中...（每0.5秒更新一次）"
  sleep 0.5
done

# 等待一会儿让用户看到结果
sleep 5
