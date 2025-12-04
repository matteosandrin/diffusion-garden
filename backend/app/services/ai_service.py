import base64
from openai import AsyncOpenAI
from google import genai
from ..config import get_settings

settings = get_settings()


class AIService:
    """Service for AI operations using OpenAI and Gemini."""
    
    def __init__(self):
        # Initialize OpenAI client
        self.openai_client = AsyncOpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None
        
        # Initialize Gemini client
        self.gemini_client = genai.Client(api_key=settings.google_api_key) if settings.google_api_key else None
    
    async def expand_text(self, text: str, model: str = "gpt-5.1") -> str:
        """
        Expand a text idea into a more detailed version.
        
        Args:
            text: The input text to expand
            model: The OpenAI model to use (gpt-5.1, gpt-4o, or gpt-4o-mini)
            
        Returns:
            Expanded text
        """
        if not self.openai_client:
            raise ValueError("OpenAI API key not configured")
        
        prompt = f"""Take the following idea and expand it into a more detailed, richer version. 
Maintain the same style, tone, and intent as the original. Add depth, examples, 
or elaboration where appropriate, but don't change the core meaning.

Original idea:
{text}

Expanded version:"""

        response = await self.openai_client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a creative writing assistant that helps expand and develop ideas while preserving their original voice and intent."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ]
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
    
    async def generate_image(self, prompt: str) -> bytes:
        """
        Generate an image from a text prompt using Gemini.
        
        Args:
            prompt: Text description of the image to generate
            
        Returns:
            Image bytes (PNG format)
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

        print(response)
        print("--------------------------------")
        print(response.candidates)
        print("--------------------------------")
        # Extract image data from response
        for part in response.candidates[0].content.parts:
            if part.inline_data is not None:
                return base64.b64decode(part.inline_data.data)
        
        raise ValueError("No image generated in response")


# Singleton instance
_ai_service: AIService | None = None


def get_ai_service() -> AIService:
    """Get or create the AI service singleton."""
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service

