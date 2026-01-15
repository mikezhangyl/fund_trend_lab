# 批量添加基金功能使用指南

## 功能概述

批量添加基金功能允许用户一次性添加多只基金到系统中，自动：
1. 从AKShare获取基金信息
2. 添加到本地数据库
3. 启动后台数据同步
4. 可选：自动设置为收藏

## API 端点

**POST** `/api/funds/batch`

### 请求体

```json
{
  "codes": ["005903", "011373", "023394"],
  "set_favorite": false,
  "sync_data": true
}
```

### 参数说明

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `codes` | `string[]` | ✅ | - | 基金代码数组 |
| `set_favorite` | `boolean` | ❌ | `false` | 是否设为收藏 |
| `sync_data` | `boolean` | ❌ | `true` | 是否同步数据 |

### 响应体

```json
{
  "success": true,
  "added": 2,
  "synced": 2,
  "favorites_updated": 0,
  "results": [
    {"code": "005903", "name": "易方达信息行业混合", "status": "added"},
    {"code": "011373", "name": "华宝中证大数据产业ETF", "status": "added"}
  ],
  "errors": [
    {"code": "999999", "error": "无法获取基金信息，请确认基金代码正确"}
  ]
}
```

### 字段说明

| 字段 | 说明 |
|------|------|
| `success` | 是否全部成功（无错误） |
| `added` | 成功添加的数量 |
| `synced` | 启动同步的数量 |
| `favorites_updated` | 更新的收藏数量 |
| `results` | 成功添加的基金列表 |
| `errors` | 失败的基金列表 |

## 前端使用方法

### 1. 单个基金添加

在输入框中输入单个基金代码：
```
005903
```
点击"添加"按钮或按回车键。

### 2. 批量添加（逗号分隔）

输入多个基金代码，用逗号分隔：
```
005903,011373,023394
```

### 3. 批量添加（空格分隔）

输入多个基金代码，用空格分隔：
```
005903 011373 023394
```

### 4. 批量添加（混合分隔）

支持中英文逗号、空格、换行：
```
005903, 011373 023394
```

## 前端调用示例

```typescript
import { batchAddFunds } from './services/api';

// 添加单个基金
const result = await batchAddFunds(['005903']);

// 批量添加多个基金
const result = await batchAddFunds(['005903', '011373', '023394']);

// 批量添加并设为收藏
const result = await batchAddFunds(['005903', '011373'], true);

// 只添加不同步数据
const result = await batchAddFunds(['005903'], false, false);

// 处理结果
if (result.added > 0) {
  console.log(`成功添加 ${result.added} 只基金`);
}

if (result.errors.length > 0) {
  console.warn('部分基金添加失败：', result.errors);
}
```

## 使用 curl 测试

```bash
curl -X POST http://localhost:8000/api/funds/batch \
  -H "Content-Type: application/json" \
  -d '{
    "codes": ["005903", "011373", "023394"],
    "set_favorite": true,
    "sync_data": true
  }'
```

## 错误处理

### 常见错误

1. **基金代码无效**
```json
{
  "code": "999999",
  "error": "无法获取基金信息，请确认基金代码正确"
}
```

2. **部分成功**
```json
{
  "success": false,
  "added": 2,
  "errors": [
    {"code": "999999", "error": "无法获取基金信息，请确认基金代码正确"}
  ]
}
```

### 错误处理建议

```typescript
const result = await batchAddFunds(['005903', '999999']);

// 显示成功消息
if (result.added > 0) {
  alert(`✅ 成功添加 ${result.added} 只基金`);
}

// 显示错误详情
if (result.errors.length > 0) {
  const errorMsg = result.errors
    .map(e => `${e.code}: ${e.error}`)
    .join('\n');
  alert(`❌ 部分基金添加失败：\n${errorMsg}`);
}
```

## 注意事项

1. **异步同步**：数据同步在后台进行，添加后需要等待几秒才能看到图表
2. **代码格式**：6位数字，如"005903"
3. **批量限制**：建议单次添加不超过10只基金
4. **收藏功能**：使用 `set_favorite=true` 会替换现有收藏列表
5. **数据源**：基金信息来自AKShare，确保网络畅通

## 完整流程示例

```typescript
// 用户输入
const userInput = "005903,011373,023394";

// 解析代码
const codes = userInput.split(/[\s,，]+/).map(c => c.trim()).filter(c => c);

// 批量添加
const result = await batchAddFunds(codes, false, true);

// 反馈结果
console.log(`成功添加 ${result.added} 只基金`);
console.log(`${result.synced} 只基金正在同步数据`);

if (result.errors.length > 0) {
  console.warn(`${result.errors.length} 只基金添加失败`);
  result.errors.forEach(err => {
    console.warn(`  ${err.code}: ${err.error}`);
  });
}
```

## 测试建议

1. **测试单个基金**：添加一只已知存在的基金
2. **测试批量添加**：一次添加3-5只基金
3. **测试错误处理**：包含一个无效代码
4. **测试收藏功能**：使用 `set_favorite=true`
5. **验证数据同步**：添加后等待5秒，检查图表是否显示

## 相关文件

- 后端API: `backend/main.py:500-576`
- 前端API: `frontend/src/services/api.ts:22-68`
- 前端UI: `frontend/src/App.tsx:86-134`
