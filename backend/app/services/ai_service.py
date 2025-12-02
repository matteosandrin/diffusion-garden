import base64
import re
import asyncio
from pathlib import Path
from PIL import Image
from openai import AsyncOpenAI
from google import genai
import httpx
from ..config import get_settings

settings = get_settings()


class AIService:
    """Service for AI operations using OpenAI and Gemini."""
    
    def __init__(self):
        # Initialize OpenAI client
        self.openai_client = AsyncOpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None
        
        # Initialize Gemini client
        self.gemini_client = genai.Client(api_key=settings.google_api_key) if settings.google_api_key else None
        
        # Initialize HTTP client for fetching images
        self.http_client = httpx.AsyncClient(timeout=30.0)
    
    async def execute_prompt(self, prompt: str, input_text: str | None = None, image_urls: list[str] | None = None, model: str = "gpt-5.1") -> str:
        """
        Execute a prompt with optional input text and/or images integrated into it.
        Images are fetched from URLs and converted to base64 before sending to the API.
        
        Args:
            prompt: The prompt/instruction to execute
            input_text: Optional input text to integrate into the prompt
            image_urls: Optional list of image URLs (will be fetched and converted to base64)
            model: The OpenAI model to use (gpt-5.1, gpt-4o, or gpt-4o-mini)
            
        Returns:
            Result of executing the prompt with the integrated input (if provided)
        """
        if not self.openai_client:
            raise ValueError("OpenAI API key not configured")
        

        messages = [
            {
                "role": "system",
                "content": prompt
            }
        ]

        # Build user message content
        if image_urls:
            # When images are provided, use array format for content
            content = []
            
            # Add text if provided
            if input_text:
                content.append({
                    "type": "text",
                    "text": input_text
                })
            
            # Fetch and convert all images to base64
            for image_url in image_urls:
                image_base64 = await self._load_image_as_base64(image_url)
                content.append({
                    "type": "image_url",
                    "image_url": {
                        "url": image_base64
                    }
                })
            
            messages.append({
                "role": "user",
                "content": content
            })
        elif input_text:
            # When only text is provided, use simple string format
            messages.append({
                "role": "user",
                "content": input_text
            })

        response = await self.openai_client.chat.completions.create(
            model=model,
            messages=messages
        )
        
        return response.choices[0].message.content or ""
    
    async def describe_image(self, image_base64: str) -> str:
        """
        Generate a detailed description of an image using GPT-4o Vision.
        
        Args:
            image_base64: Base64 encoded image data
            
        Returns:
            Detailed text description of the image
        """
        if not self.openai_client:
            raise ValueError("OpenAI API key not configured")
        
        # Ensure proper data URL format
        if not image_base64.startswith("data:"):
            image_base64 = f"data:image/jpeg;base64,{image_base64}"
        
        response = await self.openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": """Describe this image in rich, detailed prose suitable as a creative prompt or comprehensive alt text. 
Include:
- Main subjects and their positioning
- Colors, lighting, and atmosphere
- Style and mood
- Notable details and textures
- Any text or symbols visible

Be vivid and specific, as if helping someone recreate or understand this image without seeing it."""
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": image_base64
                            }
                        }
                    ]
                }
            ]
        )
        
        return response.choices[0].message.content or ""
    
    async def generate_image(self, prompt: str) -> tuple[Image.Image, str]:
        """
        Generate an image from a text prompt using Gemini.
        
        Args:
            prompt: Text description of the image to generate
            
        Returns:
            Tuple of (PIL Image object, mime_type)
        """
        if not self.gemini_client:
            raise ValueError("Google API key not configured")
        
        response = await self.gemini_client.aio.models.generate_content(
            model="gemini-3-pro-image-preview",
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                response_modalities=["IMAGE"],
            ),
        )
        for part in response.candidates[0].content.parts:
            try:
                # Check if part has inline_data with mime_type
                mime_type = "image/png"  # Default to PNG
                if hasattr(part, 'inline_data') and part.inline_data is not None:
                    if hasattr(part.inline_data, 'mime_type') and part.inline_data.mime_type:
                        mime_type = part.inline_data.mime_type
                
                image = part.as_image()
                if image is not None:
                    return image, mime_type
            except (AttributeError, ValueError):
                continue
        
        raise ValueError("No image generated in response")
    
    async def _load_image_as_base64(self, image_url: str) -> str:
        """
        Fetch an image from disk and convert it to base64 data URL format.
        
        Args:
            image_url: Path or URL of the image to fetch (can be a data URL, file path, or API URL)
            
        Returns:
            Base64 encoded image in data URL format (e.g., "data:image/jpeg;base64,...")
        """
        # If already a data URL, return as-is
        if image_url.startswith("data:"):
            return image_url
        
        try:
            # Determine the file path
            filepath = None
            
            # Check if it's an API URL (e.g., /api/images/{image_id} or http://.../api/images/{image_id})
            api_match = re.search(r'/api/images/([^/?]+)', image_url)
            if api_match:
                image_id = api_match.group(1)
                # Try to find the file by image_id (filename is {image_id}.{ext})
                images_dir = Path(settings.images_dir)
                # Look for files matching the image_id pattern
                for ext in ['jpg', 'jpeg', 'png', 'gif', 'webp']:
                    potential_path = images_dir / f"{image_id}.{ext}"
                    if potential_path.exists():
                        filepath = potential_path
                        break
                
                if filepath is None:
                    # Try without extension (in case filename is just the image_id)
                    potential_path = images_dir / image_id
                    if potential_path.exists():
                        filepath = potential_path
            else:
                # Treat as a file path
                filepath = Path(image_url)
                # If relative path, resolve relative to images directory
                if not filepath.is_absolute():
                    filepath = Path(settings.images_dir) / filepath
            
            if filepath is None or not filepath.exists():
                raise FileNotFoundError(f"Image file not found: {image_url}")
            
            # Read the file from disk (using asyncio.to_thread for async file I/O)
            def read_file():
                with open(filepath, "rb") as f:
                    return f.read()
            
            image_bytes = await asyncio.to_thread(read_file)
            
            # Determine content type from file extension
            ext = filepath.suffix.lower()
            if ext in ['.png']:
                content_type = "image/png"
            elif ext in ['.gif']:
                content_type = "image/gif"
            elif ext in ['.webp']:
                content_type = "image/webp"
            elif ext in ['.jpg', '.jpeg']:
                content_type = "image/jpeg"
            else:
                # Try to detect from file content using PIL
                try:
                    img = Image.open(filepath)
                    content_type = f"image/{img.format.lower()}" if img.format else "image/jpeg"
                except Exception:
                    content_type = "image/jpeg"
            
            # Convert to base64
            image_base64 = base64.b64encode(image_bytes).decode("utf-8")
            
            return f"data:{content_type};base64,{image_base64}"
        except FileNotFoundError as e:
            raise ValueError(f"Image file not found: {str(e)}")
        except Exception as e:
            raise ValueError(f"Error processing image from {image_url}: {str(e)}")


# Singleton instance
_ai_service: AIService | None = None


def get_ai_service() -> AIService:
    """Get or create the AI service singleton."""
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service

