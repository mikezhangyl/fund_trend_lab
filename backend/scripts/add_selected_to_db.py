#!/usr/bin/env python3
"""
将筛选出的基金添加到数据库
从 selected_funds.json 读取基金列表
"""
import sys
sys.path.insert(0, '.')

import json
from database import upsert_instrument

# 读取筛选结果
with open('../docs/selected_funds.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

funds = data['funds']
print(f"共 {len(funds)} 只基金需要添加到数据库")

# 添加到数据库
added = 0
errors = 0

for i, fund in enumerate(funds, 1):
    code = fund['code']
    name = fund['name']
    
    try:
        upsert_instrument(code, name, 'fund', source='akshare')
        added += 1
        
        if i % 50 == 0:
            print(f"进度: {i}/{len(funds)} - 已添加 {added} 只")
            
    except Exception as e:
        errors += 1
        print(f"错误 {code}: {e}")

print(f"\n完成! 添加 {added} 只基金, 错误 {errors} 个")

# 输出收藏代码列表供前端使用
favorites = [f['code'] for f in funds]
print(f"\n=== 复制以下代码到浏览器控制台设置收藏 ===")
print(f"localStorage.setItem('fund_favorites', JSON.stringify({json.dumps(favorites)}));")
print(f"location.reload();")
print(f"===========================================")

