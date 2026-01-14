"""
数据同步服务 - 负责后台异步增量同步
遵循PRD v1.1第9章节：后台触发增量同步，完成后刷新该行
"""
import asyncio
from datetime import datetime
from typing import List, Dict, Optional, Callable
from services.data_fetcher import DataFetcher
from database import get_instrument_info, list_instruments


class SyncService:
    """后台数据同步服务"""

    def __init__(self):
        self.fetcher = DataFetcher()
        self.syncing: set = set()  # 正在同步的代码集合

    def is_syncing(self, code: str) -> bool:
        """检查是否正在同步"""
        return code in self.syncing

    async def sync_single(
        self,
        code: str,
        on_progress: Optional[Callable] = None
    ) -> Dict:
        """
        同步单个基金/指数

        Args:
            code: 基金/指数代码
            on_progress: 进度回调函数

        Returns:
            同步结果字典
        """
        if code in self.syncing:
            return {
                "code": code,
                "success": False,
                "message": "Already syncing",
                "timestamp": datetime.now().isoformat()
            }

        self.syncing.add(code)

        try:
            # 获取基金类型
            info = get_instrument_info(code)

            if not info:
                # 首次同步，默认为fund类型
                instrument_type = "fund"
            else:
                instrument_type = info["type"]

            # 执行增量同步
            success, message = self.fetcher.incremental_sync(code, instrument_type)

            result = {
                "code": code,
                "success": success,
                "message": message,
                "timestamp": datetime.now().isoformat()
            }

            if on_progress:
                await on_progress(result)

            return result

        except Exception as e:
            result = {
                "code": code,
                "success": False,
                "message": str(e),
                "timestamp": datetime.now().isoformat()
            }

            if on_progress:
                await on_progress(result)

            return result

        finally:
            self.syncing.discard(code)

    async def sync_multiple(
        self,
        codes: List[str],
        on_progress: Optional[Callable] = None
    ) -> List[Dict]:
        """
        并发同步多个基金/指数

        Args:
            codes: 基金/指数代码列表
            on_progress: 进度回调函数

        Returns:
            同步结果列表
        """
        tasks = [self.sync_single(code, on_progress) for code in codes]
        return await asyncio.gather(*tasks)

    async def sync_all(
        self,
        on_progress: Optional[Callable] = None
    ) -> List[Dict]:
        """
        同步所有已保存的基金/指数

        Args:
            on_progress: 进度回调函数

        Returns:
            同步结果列表
        """
        instruments = list_instruments()
        codes = [inst["code"] for inst in instruments]

        if not codes:
            return []

        return await self.sync_multiple(codes, on_progress)


# 全局同步服务实例
sync_service = SyncService()


async def background_sync_task(
    codes: List[str],
    interval_seconds: int = 3600
):
    """
    后台定时同步任务

    Args:
        codes: 需要同步的代码列表
        interval_seconds: 同步间隔（秒）
    """
    while True:
        try:
            print(f"[{datetime.now()}] Starting background sync...")

            results = await sync_service.sync_multiple(codes)

            success_count = sum(1 for r in results if r["success"])
            print(f"Background sync completed: {success_count}/{len(results)} succeeded")

        except Exception as e:
            print(f"Background sync error: {e}")

        # 等待下一次同步
        await asyncio.sleep(interval_seconds)


if __name__ == "__main__":
    # 测试同步服务
    from backend.database import init_database

    init_database()

    async def test_sync():
        # 测试单个同步
        result = await sync_service.sync_single("000001")
        print(f"Sync result: {result}")

        # 测试批量同步
        results = await sync_service.sync_multiple(["000001", "000300"])
        for r in results:
            print(f"Sync result: {r}")

    asyncio.run(test_sync())
