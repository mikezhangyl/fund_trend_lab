"""
FastAPI后端主应用
提供基金数据查询、同步、状态管理API

架构原则：
1. UI仅读取本地数据库（Single Source of Truth）
2. 后台异步同步外部数据（AKShare）
3. 所有查询操作快速返回，不调用外部API
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime, timedelta
import asyncio

from database import (
    init_database,
    get_instrument_info,
    list_instruments,
    get_timeseries,
    upsert_instrument,
    delete_instrument,
    save_user_state,
    load_user_state,
    get_sync_state,
    get_surge_events
)
from services.data_fetcher import DataFetcher
from services.sync_service import sync_service
from services.indicators import indicator_service
from services.backtester import UptrendPhaseDetector


app = FastAPI(
    title="Fund Trend Lab API",
    description="基金多时间区间趋势可视化工具 - 后端API",
    version="1.1.0"
)

# 添加CORS支持（允许前端跨域访问）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 启动时初始化数据库
@app.on_event("startup")
async def startup_event():
    """应用启动时初始化数据库"""
    init_database()
    print("Database initialized.")


# ==================== Pydantic模型 ====================

class Instrument(BaseModel):
    """基金/指数信息"""
    code: str
    name: str
    type: str  # 'fund', 'etf', 'index'


class TimeRange(BaseModel):
    """时间区间"""
    days: int
    label: Optional[str] = None


class TimeseriesRequest(BaseModel):
    """时间序列查询请求"""
    code: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class SyncRequest(BaseModel):
    """同步请求"""
    codes: List[str]


class UserState(BaseModel):
    """用户状态"""
    key: str
    value: str


class BatchFundRequest(BaseModel):
    """批量添加基金请求"""
    codes: List[str]
    set_favorite: bool = False
    sync_data: bool = True


class FavoritesRequest(BaseModel):
    """收藏设置请求"""
    codes: List[str]
    mode: str = "replace"  # "replace" 替换, "add" 追加, "remove" 移除


# ==================== 基金/指数管理 ====================

@app.get("/api/instruments")
async def get_instruments(instrument_type: Optional[str] = None) -> List[Instrument]:
    """
    获取所有基金/指数列表

    Args:
        instrument_type: 筛选类型 (fund/etf/index)

    Returns:
        基金/指数列表
    """
    try:
        instruments = list_instruments(instrument_type)
        return [
            Instrument(
                code=inst["code"],
                name=inst["name"],
                type=inst["type"]
            )
            for inst in instruments
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/instruments/{code}")
async def get_instrument_detail(code: str) -> Instrument:
    """
    获取单个基金/指数详情

    Args:
        code: 基金/指数代码

    Returns:
        基金/指数信息

    Raises:
        404: 基金/指数不存在
    """
    try:
        info = get_instrument_info(code)

        if not info:
            raise HTTPException(
                status_code=404,
                detail=f"Instrument {code} not found. Please add it first via /api/funds/batch"
            )

        return Instrument(
            code=info["code"],
            name=info["name"],
            type=info["type"]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/indicators/{code}")
async def get_indicators(code: str, days: int = 20) -> Dict:
    """
    获取基金技术指标
    
    用于识别潜在急涨信号，包含：
    - momentum: 动量（涨跌幅%）
    - relative_strength: 相对强度（vs沪深300）
    - volatility: 波动率
    - vol_ratio: 波动率压缩比
    - warning_level: 预警等级 (HIGH/MEDIUM/LOW)
    
    Args:
        code: 基金代码
        days: 计算周期天数（默认20）
    """
    try:
        result = indicator_service.calculate_indicators(code, days)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/surge_events/{code}")
async def get_surge_events_api(code: str) -> List[Dict]:
    """
    获取某只基金的急涨事件
    
    用于在图表上标注急涨区间
    """
    try:
        events = get_surge_events(code)
        return events
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/uptrend_phases/{code}")
async def get_uptrend_phases(
    code: str,
    max_drawdown: float = 5.0,
    min_gain: float = 10.0,
    min_duration: int = 5
) -> List[Dict]:
    """
    获取基金的连续上涨阶段
    
    新算法：捕捉连续上涨阶段，允许期间有小幅回撤
    - 期间回撤超过阈值则认为是新的上涨阶段
    
    Args:
        code: 基金代码
        max_drawdown: 最大允许回撤% (默认5%)
        min_gain: 最小涨幅% (默认10%)
        min_duration: 最少持续天数 (默认5天)
    
    Returns:
        上涨阶段列表
    """
    try:
        info = get_instrument_info(code)
        name = info["name"] if info else ""
        
        detector = UptrendPhaseDetector(
            max_drawdown_tolerance=max_drawdown,
            min_gain=min_gain,
            min_duration=min_duration
        )
        
        phases = detector.detect_phases(code, name)
        
        return [
            {
                "start_date": p.start_date,
                "end_date": p.end_date,
                "duration_days": p.duration_days,
                "total_gain": p.total_gain,
                "max_drawdown": p.max_drawdown,
                "avg_daily_gain": p.avg_daily_gain,
                "slope_first": p.slope_first,
                "slope_second": p.slope_second,
                "is_accelerating": p.is_accelerating,
            }
            for p in phases
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/instruments")
async def add_instrument(instrument: Instrument) -> Dict:
    """
    添加基金/指数

    Args:
        instrument: 基金/指数信息

    Returns:
        操作结果
    """
    try:
        upsert_instrument(
            code=instrument.code,
            name=instrument.name,
            instrument_type=instrument.type
        )

        return {
            "success": True,
            "message": f"Instrument {instrument.code} added successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/instruments/{code}")
async def remove_instrument(code: str) -> Dict:
    """
    删除基金/指数及其所有数据

    Args:
        code: 基金/指数代码

    Returns:
        删除结果
    """
    try:
        # 检查基金是否存在
        info = get_instrument_info(code)
        if not info:
            raise HTTPException(status_code=404, detail=f"Instrument {code} not found")

        # 执行删除
        result = delete_instrument(code)

        if result["instrument_deleted"] == 0:
            raise HTTPException(status_code=404, detail=f"Instrument {code} not found")

        return {
            "success": True,
            "message": f"Instrument {code} deleted successfully",
            "details": result
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 时间序列数据 ====================

@app.post("/api/timeseries")
async def get_timeseries_data(request: TimeseriesRequest) -> List[Dict]:
    """
    获取时间序列数据

    Args:
        request: 包含code、start_date、end_date的请求

    Returns:
        时间序列数据列表 [{date, value}]
    """
    try:
        data = get_timeseries(
            code=request.code,
            start_date=request.start_date,
            end_date=request.end_date
        )

        return [
            {
                "date": item["date"],
                "value": item["value"]
            }
            for item in data
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/timeseries/{code}/range/{days}")
async def get_timeseries_by_range(
    code: str,
    days: int,
    end_date: Optional[str] = None
) -> List[Dict]:
    """
    按天数范围获取时间序列数据

    Args:
        code: 基金/指数代码
        days: 天数（如365表示1年）
        end_date: 结束日期，默认为今天

    Returns:
        时间序列数据列表
    """
    try:
        if not end_date:
            end_date = datetime.now().strftime("%Y-%m-%d")

        start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

        data = get_timeseries(code, start_date, end_date)

        return [
            {
                "date": item["date"],
                "value": item["value"]
            }
            for item in data
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 数据同步 ====================

@app.post("/api/sync")
async def sync_instruments(request: SyncRequest, background_tasks: BackgroundTasks) -> Dict:
    """
    同步基金/指数数据（后台异步）

    Args:
        request: 包含codes列表的请求
        background_tasks: FastAPI后台任务

    Returns:
        同步任务信息
    """
    try:
        # 启动后台同步任务
        async def sync_task():
            results = await sync_service.sync_multiple(request.codes)
            print(f"Sync completed: {len([r for r in results if r['success']])}/{len(results)} succeeded")

        background_tasks.add_task(sync_task)

        return {
            "success": True,
            "message": f"Sync task started for {len(request.codes)} instruments",
            "codes": request.codes
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sync/status/{code}")
async def get_sync_status(code: str) -> Dict:
    """
    获取同步状态

    Args:
        code: 基金/指数代码

    Returns:
        同步状态信息
    """
    try:
        status = get_sync_state(code)
        if not status:
            return {
                "code": code,
                "synced": False,
                "message": "Not synced yet"
            }

        return {
            "code": code,
            "synced": True,
            "last_success_date": status["last_success_date"],
            "last_sync_at": status["last_sync_at"],
            "status": status["status"],
            "message": status["message"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sync/syncing")
async def get_syncing_list() -> List[str]:
    """
    获取正在同步的代码列表

    Returns:
        正在同步的代码列表
    """
    return list(sync_service.syncing)


# ==================== 用户状态管理 ====================

@app.post("/api/state")
async def save_state(state: UserState) -> Dict:
    """
    保存用户状态

    Args:
        state: 包含key和value的状态

    Returns:
        操作结果
    """
    try:
        save_user_state(state.key, state.value)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/state/{key}")
async def load_state(key: str) -> Dict:
    """
    加载用户状态

    Args:
        key: 状态键

    Returns:
        状态值
    """
    try:
        value = load_user_state(key)
        if value is None:
            raise HTTPException(status_code=404, detail=f"State {key} not found")

        return {"key": key, "value": value}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 批量基金管理 ====================

@app.post("/api/funds/batch")
async def batch_add_funds(
    request: BatchFundRequest,
    background_tasks: BackgroundTasks
) -> Dict:
    """
    批量添加基金到数据库
    
    Args:
        request: 包含基金代码列表和选项的请求体
        
    Returns:
        添加结果统计
    """
    import json
    
    results = []
    errors = []
    added_count = 0
    synced_count = 0
    
    fetcher = DataFetcher()
    
    for code in request.codes:
        try:
            # 获取基金信息
            info = fetcher.get_fund_info(code)

            # 如果无法获取基金信息，记录错误并跳过
            if not info:
                errors.append({
                    "code": code,
                    "error": "无法获取基金信息，请确认基金代码正确"
                })
                continue

            name = info.get('name', f'基金{code}')
            fund_type = 'fund'

            # 添加到数据库
            upsert_instrument(code, name, fund_type, source='akshare')
            added_count += 1
            results.append({
                "code": code,
                "name": name,
                "status": "added"
            })

            # 异步同步数据
            if request.sync_data:
                background_tasks.add_task(sync_service.sync_single, code)
                synced_count += 1

        except Exception as e:
            errors.append({
                "code": code,
                "error": str(e)
            })
    
    # 处理收藏
    favorites_updated = 0
    if request.set_favorite:
        existing = load_user_state("favorites")
        existing_list = json.loads(existing) if existing else []
        new_favorites = list(set(existing_list + request.codes))
        save_user_state("favorites", json.dumps(new_favorites))
        favorites_updated = len(request.codes)
    
    return {
        "success": len(errors) == 0,
        "added": added_count,
        "synced": synced_count,
        "favorites_updated": favorites_updated,
        "results": results,
        "errors": errors
    }


# ==================== 收藏管理 ====================

@app.get("/api/favorites")
async def get_favorites() -> Dict:
    """
    获取收藏的基金列表
    
    Returns:
        收藏的基金代码列表
    """
    import json
    
    favorites_str = load_user_state("favorites")
    favorites = json.loads(favorites_str) if favorites_str else []
    
    return {
        "count": len(favorites),
        "codes": favorites
    }


@app.post("/api/favorites")
async def set_favorites(request: FavoritesRequest) -> Dict:
    """
    设置/更新收藏列表
    
    Args:
        request: 收藏设置请求
            - codes: 基金代码列表
            - mode: "replace" 替换, "add" 追加, "remove" 移除
            
    Returns:
        更新后的收藏列表
    """
    import json
    
    existing_str = load_user_state("favorites")
    existing = json.loads(existing_str) if existing_str else []
    
    if request.mode == "replace":
        new_favorites = request.codes
    elif request.mode == "add":
        new_favorites = list(set(existing + request.codes))
    elif request.mode == "remove":
        new_favorites = [c for c in existing if c not in request.codes]
    else:
        raise HTTPException(status_code=400, detail=f"Invalid mode: {request.mode}")
    
    save_user_state("favorites", json.dumps(new_favorites))
    
    return {
        "success": True,
        "count": len(new_favorites),
        "codes": new_favorites,
        "mode": request.mode
    }


# ==================== 健康检查 ====================

@app.get("/api/health")
async def health_check():
    """健康检查接口"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }


if __name__ == "__main__":
    import uvicorn

    # 运行服务器
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
