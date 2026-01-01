from typing import List
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, cast, Date
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import AnalyticsLog

router = APIRouter(prefix="/analytics", tags=["analytics"])


class DailyStats(BaseModel):
    date: str
    request_type: str
    request_count: int
    input_tokens: int
    output_tokens: int
    total_tokens: int


class DailyStatsResponse(BaseModel):
    stats: List[DailyStats]


@router.get("/daily", response_model=DailyStatsResponse)
async def get_daily_stats(db: Session = Depends(get_db)):
    """
    Get daily aggregated analytics stats.
    Returns request counts and token usage grouped by date and request type.
    """
    results = (
        db.query(
            cast(AnalyticsLog.created_at, Date).label("date"),
            AnalyticsLog.request_type,
            func.count(AnalyticsLog.id).label("request_count"),
            func.sum(AnalyticsLog.input_tokens).label("input_tokens"),
            func.sum(AnalyticsLog.output_tokens).label("output_tokens"),
            func.sum(AnalyticsLog.total_tokens).label("total_tokens"),
        )
        .group_by(cast(AnalyticsLog.created_at, Date), AnalyticsLog.request_type)
        .order_by(cast(AnalyticsLog.created_at, Date).desc())
        .all()
    )

    stats = [
        DailyStats(
            date=str(row.date),
            request_type=row.request_type,
            request_count=row.request_count,
            input_tokens=row.input_tokens or 0,
            output_tokens=row.output_tokens or 0,
            total_tokens=row.total_tokens or 0,
        )
        for row in results
    ]

    return DailyStatsResponse(stats=stats)
