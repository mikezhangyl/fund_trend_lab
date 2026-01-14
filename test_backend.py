"""
快速测试脚本 - 验证后端功能
"""
import sys
sys.path.insert(0, '/Users/mikezhang/Coding/fund_trend_lab')

from backend.database import init_database, list_instruments
from backend.services.data_fetcher import DataFetcher

print("=== 基金趋势实验室 - 后端测试 ===\n")

# 1. 初始化数据库
print("1. 初始化数据库...")
init_database()
print("   ✅ 数据库初始化完成\n")

# 2. 测试数据抓取
print("2. 测试数据抓取（以沪深300指数为例）...")
fetcher = DataFetcher()

# 同步沪深300指数
success, message = fetcher.sync_to_database("000300", "index")
print(f"   {'✅' if success else '❌'} 同步结果: {message}\n")

# 3. 验证数据
print("3. 验证数据库...")
instruments = list_instruments()
print(f"   ✅ 找到 {len(instruments)} 只基金/指数")

if instruments:
    from backend.database import get_timeseries
    timeseries = get_timeseries("000300")
    print(f"   ✅ 沪深300有 {len(timeseries)} 条数据")
    if timeseries:
        print(f"      最新: {timeseries[-1]['date']} = {timeseries[-1]['value']}")
        print(f"      最旧: {timeseries[0]['date']} = {timeseries[0]['value']}")

print("\n=== 测试完成 ===")
print("\n提示: 如果测试通过，可以启动后端服务：")
print("  cd backend")
print("  python3 -m uvicorn main:app --reload --port 8000")
