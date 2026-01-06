from fastapi import APIRouter, Request, HTTPException, status
from pydantic import BaseModel
from ..config import get_settings
import httpx


class NotifyRequest(BaseModel):
    path: str
    ip: str | None = None
    referrer: str | None = None


IPDATA_HOST = "https://api.ipdata.co"
PUSHOVER_URL = "https://api.pushover.net/1/messages.json"

router = APIRouter(prefix="/notify", tags=["notify"])
settings = get_settings()


async def _get_ipdata(ip_address: str) -> dict:
    ipdata_url = f"{IPDATA_HOST}/{ip_address}?api-key={settings.ipdata_api_key}"
    async with httpx.AsyncClient() as client:
        resp = await client.get(ipdata_url)
        if resp.status_code == 200:
            return resp.json()
        error_message = resp.json().get("message", "Unknown error")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"IPData error: {error_message}",
        )


async def _notify_pushover(ipdata: dict, path: str, referrer: str):
    message = (
        "Location: "
        + ipdata.get("emoji_flag", "") or ""
        + " "
        + ipdata.get("city", "") or ""
        + ", "
        + ipdata.get("region", "") or ""
        + ", "
        + ipdata.get("country_name", "") or ""
        + "\n"
        + "Path: "
        + path
        + "\n"
        + "ISP: "
        + (ipdata.get("asn", {}) or {}).get("name", "") or ""
        + "\n"
    )
    if referrer:
        message += "Referrer: " + referrer + "\n"
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            PUSHOVER_URL,
            data={
                "token": settings.pushover_token,
                "user": settings.pushover_user,
                "message": message,
            },
        )
        if resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Pushover error: {resp.text}",
            )
        return resp.json()


@router.post("")
async def notify(request: Request, body: NotifyRequest):

    if not settings.ipdata_api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="IPData API key not configured",
        )

    if not settings.pushover_token or not settings.pushover_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Pushover token or user not configured",
        )

    ip_address = body.ip
    if not ip_address:
        ip_address = request.client.host
    ipdata = await _get_ipdata(ip_address)
    await _notify_pushover(ipdata, body.path, body.referrer)

    return {"status": "ok"}
