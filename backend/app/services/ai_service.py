import base64
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
                image_base64 = await self._fetch_image_as_base64(image_url)
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
    
    async def _fetch_image_as_base64(self, image_url: str) -> str:
        """
        Fetch an image from a URL and convert it to base64 data URL format.
        
        Args:
            image_url: URL of the image to fetch (can be a regular URL or already a data URL)
            
        Returns:
            Base64 encoded image in data URL format (e.g., "data:image/jpeg;base64,...")
        """
        # If already a data URL, return as-is
        if image_url.startswith("data:"):
            return image_url
        
        try:
            # Fetch the image
            response = await self.http_client.get(image_url)
            response.raise_for_status()
            
            # Determine content type from response headers or URL
            content_type = response.headers.get("content-type", "image/jpeg")
            if not content_type.startswith("image/"):
                # Try to infer from URL extension
                if image_url.lower().endswith((".png",)):
                    content_type = "image/png"
                elif image_url.lower().endswith((".gif",)):
                    content_type = "image/gif"
                elif image_url.lower().endswith((".webp",)):
                    content_type = "image/webp"
                else:
                    content_type = "image/jpeg"
            
            # Convert to base64
            image_bytes = response.content
            image_base64 = base64.b64encode(image_bytes).decode("utf-8")
            
            return f"data:{content_type};base64,{image_base64}"
        except httpx.HTTPError as e:
            raise ValueError(f"Failed to fetch image from URL {image_url}: {str(e)}")
        except Exception as e:
            raise ValueError(f"Error processing image from URL {image_url}: {str(e)}")


# Singleton instance
_ai_service: AIService | None = None


def get_ai_service() -> AIService:
    """Get or create the AI service singleton."""
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service

