"""
Utility to update imageUrl fields in canvas records:
1. Adds file extension from the image database record
2. Changes path from "/api/images" to "/images"
"""

import re
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from ..models import Canvas, Image


def extract_image_id_from_url(url: str) -> str | None:
    """Extract image ID from URL like '/api/images/{image_id}' or '/images/{image_id}'."""
    if not url:
        return None

    # Match pattern: /api/images/{id} or /images/{id} or /api/images/{id}.{ext} or /images/{id}.{ext}
    match = re.search(r"/(?:api/)?images/([a-f0-9-]+)", url)
    if match:
        return match.group(1)
    return None


def get_extension_from_filename(filename: str) -> str:
    """Extract file extension from filename."""
    if not filename:
        return "png"  # default

    parts = filename.split(".")
    if len(parts) > 1:
        return parts[-1]
    return "png"  # default


def update_canvas_image_urls(db: Session) -> dict:
    """Update all imageUrl fields in all canvas records.

    Returns:
        dict: Summary of the update operation with keys:
            - total_canvases: Total number of canvases processed
            - total_updates: Total number of image URLs updated
            - updated_canvases: Number of canvases that had updates
    """
    canvases = db.query(Canvas).all()
    total_canvases = len(canvases)
    total_updates = 0
    updated_canvases = 0

    print(f"[Image URL Updater] Found {total_canvases} canvas(es) to process...")

    for canvas_idx, canvas in enumerate(canvases, 1):
        if not canvas.nodes:
            continue

        updated = False
        canvas_updates = 0
        nodes = canvas.nodes.copy() if canvas.nodes else []

        for node in nodes:
            data = node.get("data", {})
            if data.get("type") != "image":
                continue

            image_url = data.get("imageUrl")
            if not image_url:
                continue

            # Extract image ID from URL (handles both /api/images/{id} and /images/{id})
            image_id = extract_image_id_from_url(image_url)
            if not image_id:
                print(
                    f"[Image URL Updater] Warning: Could not extract image ID from URL: {image_url}"
                )
                continue

            # Look up image in database
            image_record = db.query(Image).filter(Image.id == image_id).first()
            if not image_record:
                print(
                    f"[Image URL Updater] Warning: Image not found in database: {image_id}"
                )
                continue

            # Get extension from filename
            extension = get_extension_from_filename(image_record.filename)

            # Build new URL: /images/{image_id}.{extension}
            new_url = f"/images/{image_id}.{extension}"

            # Skip if URL is already correct
            if image_url == new_url:
                continue

            # Update the imageUrl
            data["imageUrl"] = new_url
            node["data"] = data
            updated = True
            canvas_updates += 1
            total_updates += 1

            print(f"[Image URL Updater] Updated: {image_url} -> {new_url}")

        # Save updated nodes back to canvas
        if updated:
            canvas.nodes = nodes
            # Mark the JSON column as modified so SQLAlchemy detects the change
            flag_modified(canvas, "nodes")
            db.commit()
            updated_canvases += 1
            print(
                f"[Image URL Updater] Canvas {canvas_idx}/{total_canvases} (ID: {canvas.id}): Saved {canvas_updates} update(s)"
            )
        else:
            print(
                f"[Image URL Updater] Canvas {canvas_idx}/{total_canvases} (ID: {canvas.id}): No updates needed"
            )

    if total_updates > 0:
        print(
            f"[Image URL Updater] Completed! Updated {total_updates} image URL(s) across {updated_canvases} canvas(es)."
        )
    else:
        print(f"[Image URL Updater] Completed! No updates needed.")

    return {
        "total_canvases": total_canvases,
        "total_updates": total_updates,
        "updated_canvases": updated_canvases,
    }
