"""
Utility to migrate local images to R2:
1. Goes through all canvases in the database
2. Finds image nodes with local URLs (/images/{id}.{ext} or /api/images/{id})
3. Uploads the images to R2
4. Updates the imageUrl in the canvas record to the R2 public URL
5. Updates the Image database record to reflect R2 storage
"""

import io
import re
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from ..models import Canvas, Image
from ..config import get_settings

settings = get_settings()

# Lazy-load boto3 client to avoid import errors when R2 isn't configured
_r2_client = None


def get_r2_client():
    """Get or create the R2 client."""
    global _r2_client
    if _r2_client is None:
        import boto3

        _r2_client = boto3.client(
            service_name="s3",
            endpoint_url=settings.r2_url,
            aws_access_key_id=settings.r2_access_key,
            aws_secret_access_key=settings.r2_secret_key,
            region_name="auto",
        )
    return _r2_client


def is_local_url(url: str) -> bool:
    """Check if a URL is a local image URL (not already on R2)."""
    if not url:
        return False

    # R2 URLs contain the public URL domain
    if settings.r2_public_url and settings.r2_public_url in url:
        return False

    # Local URLs start with /images/ or /api/images/
    return url.startswith("/images/") or url.startswith("/api/images/")


def extract_filename_from_url(url: str) -> str | None:
    """Extract filename from URL like '/images/{id}.{ext}' or '/api/images/{id}'."""
    if not url:
        return None

    # Match pattern: /api/images/{id}.{ext} or /images/{id}.{ext}
    match = re.search(r"/(?:api/)?images/([a-f0-9-]+(?:\.[a-z]+)?)", url)
    if match:
        return match.group(1)
    return None


def extract_image_id_from_filename(filename: str) -> str:
    """Extract image ID from filename (remove extension if present)."""
    if "." in filename:
        return filename.rsplit(".", 1)[0]
    return filename


def get_content_type_from_extension(ext: str) -> str:
    """Get content type from file extension."""
    content_types = {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "gif": "image/gif",
        "webp": "image/webp",
    }
    return content_types.get(ext.lower(), "image/png")


def upload_to_r2(file_path: Path, r2_key: str, content_type: str) -> bool:
    """Upload a file to R2. Returns True on success, False on failure."""
    try:
        r2_client = get_r2_client()
        with open(file_path, "rb") as f:
            r2_client.upload_fileobj(
                Fileobj=f,
                Bucket=settings.r2_bucket,
                Key=r2_key,
                ExtraArgs={"ContentType": content_type},
            )
        return True
    except Exception as e:
        print(f"[R2 Migration] Error uploading {file_path} to R2: {e}")
        return False


def migrate_canvas_images_to_r2(db: Session, dry_run: bool = False) -> dict:
    """Migrate all local images in canvases to R2.

    Args:
        db: Database session
        dry_run: If True, only report what would be done without making changes

    Returns:
        dict: Summary of the migration operation with keys:
            - total_canvases: Total number of canvases processed
            - total_images_found: Total number of local images found
            - total_uploaded: Total number of images successfully uploaded to R2
            - total_updated: Total number of canvas records updated
            - errors: List of error messages
    """
    images_dir = Path(settings.images_dir)

    if not images_dir.exists():
        print(f"[R2 Migration] Error: Images directory not found: {images_dir}")
        return {
            "total_canvases": 0,
            "total_images_found": 0,
            "total_uploaded": 0,
            "total_updated": 0,
            "errors": [f"Images directory not found: {images_dir}"],
        }

    canvases = db.query(Canvas).all()
    total_canvases = len(canvases)
    total_images_found = 0
    total_uploaded = 0
    total_updated = 0
    errors = []

    # Track which images have been uploaded to avoid duplicates
    uploaded_images = {}  # image_id -> r2_url

    print(f"[R2 Migration] Found {total_canvases} canvas(es) to process...")
    if dry_run:
        print("[R2 Migration] DRY RUN MODE - No changes will be made")

    for canvas_idx, canvas in enumerate(canvases, 1):
        if not canvas.nodes:
            continue

        canvas_updated = False
        nodes = canvas.nodes.copy() if canvas.nodes else []

        for node in nodes:
            data = node.get("data", {})
            if data.get("type") != "image":
                continue

            image_url = data.get("imageUrl")
            if not image_url or not is_local_url(image_url):
                continue

            total_images_found += 1

            # Extract filename from URL
            filename = extract_filename_from_url(image_url)
            if not filename:
                error_msg = f"Could not extract filename from URL: {image_url}"
                print(f"[R2 Migration] Warning: {error_msg}")
                errors.append(error_msg)
                continue

            # Get image ID
            image_id = extract_image_id_from_filename(filename)

            # Check if already uploaded in this run
            if image_id in uploaded_images:
                new_url = uploaded_images[image_id]
                print(
                    f"[R2 Migration] Reusing already uploaded image: {image_url} -> {new_url}"
                )
                if not dry_run:
                    data["imageUrl"] = new_url
                    node["data"] = data
                    canvas_updated = True
                continue

            # Look up image in database
            image_record = db.query(Image).filter(Image.id == image_id).first()
            if not image_record:
                error_msg = f"Image not found in database: {image_id}"
                print(f"[R2 Migration] Warning: {error_msg}")
                errors.append(error_msg)
                continue

            # Check if image is already on R2
            if image_record.source == "r2":
                new_url = f"{settings.r2_public_url}/{image_record.filename}"
                print(f"[R2 Migration] Image already on R2: {image_url} -> {new_url}")
                if not dry_run:
                    data["imageUrl"] = new_url
                    node["data"] = data
                    canvas_updated = True
                uploaded_images[image_id] = new_url
                continue

            # Determine the local file path
            # Try with extension from database record first
            local_filename = image_record.filename
            local_path = images_dir / local_filename

            # If not found, try common extensions
            if not local_path.exists():
                for ext in ["png", "jpg", "jpeg", "gif", "webp"]:
                    test_path = images_dir / f"{image_id}.{ext}"
                    if test_path.exists():
                        local_path = test_path
                        local_filename = f"{image_id}.{ext}"
                        break

            if not local_path.exists():
                error_msg = f"Local file not found: {local_path}"
                print(f"[R2 Migration] Warning: {error_msg}")
                errors.append(error_msg)
                continue

            # Determine extension and content type
            extension = (
                local_filename.rsplit(".", 1)[-1] if "." in local_filename else "png"
            )
            r2_key = f"{image_id}.{extension}"
            content_type = get_content_type_from_extension(extension)

            print(f"[R2 Migration] Uploading: {local_path} -> R2:{r2_key}")

            if not dry_run:
                # Upload to R2
                if not upload_to_r2(local_path, r2_key, content_type):
                    errors.append(f"Failed to upload {local_path} to R2")
                    continue

                total_uploaded += 1

                # Update image record
                image_record.filename = r2_key
                image_record.source = "r2"
                image_record.content_type = content_type

                # Update canvas node
                new_url = f"{settings.r2_public_url}/{r2_key}"
                data["imageUrl"] = new_url
                node["data"] = data
                canvas_updated = True

                # Track uploaded image
                uploaded_images[image_id] = new_url

                print(f"[R2 Migration] Uploaded: {image_url} -> {new_url}")
            else:
                new_url = f"{settings.r2_public_url}/{r2_key}"
                print(f"[R2 Migration] Would upload: {image_url} -> {new_url}")
                uploaded_images[image_id] = new_url

        # Save updated canvas
        if canvas_updated and not dry_run:
            canvas.nodes = nodes
            flag_modified(canvas, "nodes")
            db.commit()
            total_updated += 1
            print(
                f"[R2 Migration] Canvas {canvas_idx}/{total_canvases} (ID: {canvas.id}): Updated"
            )
        else:
            print(
                f"[R2 Migration] Canvas {canvas_idx}/{total_canvases} (ID: {canvas.id}): {'No changes needed' if not canvas_updated else 'Would update (dry run)'}"
            )

    # Summary
    print("\n" + "=" * 60)
    print("[R2 Migration] SUMMARY")
    print("=" * 60)
    print(f"Total canvases processed: {total_canvases}")
    print(f"Total local images found: {total_images_found}")
    if dry_run:
        print(f"Would upload to R2: {len(uploaded_images)} unique images")
    else:
        print(f"Successfully uploaded to R2: {total_uploaded}")
        print(f"Canvas records updated: {total_updated}")
    if errors:
        print(f"Errors encountered: {len(errors)}")
        for error in errors[:10]:  # Show first 10 errors
            print(f"  - {error}")
        if len(errors) > 10:
            print(f"  ... and {len(errors) - 10} more errors")
    print("=" * 60)

    return {
        "total_canvases": total_canvases,
        "total_images_found": total_images_found,
        "total_uploaded": total_uploaded,
        "total_updated": total_updated,
        "errors": errors,
    }
