from datetime import datetime, timedelta, UTC
import io
import uuid
import boto3
from fastapi import UploadFile
from sqlalchemy.orm import Session
from ..config import get_settings
from ..models import Image

settings = get_settings()

r2_client = boto3.client(
    service_name="s3",
    endpoint_url=settings.r2_url,
    aws_access_key_id=settings.r2_access_key,
    aws_secret_access_key=settings.r2_secret_key,
    region_name="auto",
)


async def upload_image_and_record(content: bytes, content_type: str, db: Session):
    image_id = str(uuid.uuid4())
    r2_key = f"{image_id}.{content_type.split('/')[1]}"
    # upload image to r2
    r2_client.upload_fileobj(
        Fileobj=io.BytesIO(content),
        Bucket=settings.r2_bucket,
        Key=r2_key,
        ExtraArgs={
            "ContentType": content_type,
            # images are immutable, so we can cache them for a year
            "CacheControl": "public, max-age=31536000",
            "Expires": datetime.now(UTC) + timedelta(days=365),
        },
    )
    image_url = f"{settings.r2_public_url}/{r2_key}"
    # create image record in db
    image_record = Image(
        id=image_id,
        filename=r2_key,
        original_filename="",
        content_type=content_type,
        source="r2",
    )
    db.add(image_record)
    db.commit()
    return image_id, image_url


def delete_image(image_filename: str, db: Session):
    record = db.query(Image).filter(Image.filename == image_filename).first()
    if not record:
        return
    r2_client.delete_object(Bucket=settings.r2_bucket, Key=image_filename)
    db.delete(record)
    db.commit()
