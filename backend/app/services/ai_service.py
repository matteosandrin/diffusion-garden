import base64
import re
import asyncio
import random
from pathlib import Path
from typing import AsyncIterator
from PIL import Image
from openai import AsyncOpenAI
from google import genai
from ..prompts import prompts
from ..config import get_settings

settings = get_settings()


class AIService:
    """Service for AI operations using OpenAI and Gemini."""

    def __init__(self):
        self.openai_client = (
            AsyncOpenAI(api_key=settings.openai_api_key)
            if settings.openai_api_key
            else None
        )

        self.gemini_client = (
            genai.Client(api_key=settings.google_api_key)
            if settings.google_api_key
            else None
        )

    async def generate_text(
        self,
        prompt: str,
        input_text: str | None = None,
        image_urls: list[str] | None = None,
        model: str = "gpt-5.1",
    ) -> AsyncIterator[str]:
        """
        Run a prompt with optional input text and/or images integrated into it.
        Streams the response as text chunks.
        Images are fetched from URLs and converted to base64 before sending to the API.

        Args:
            prompt: The prompt/instruction to run
            input_text: Optional input text to integrate into the prompt
            image_urls: Optional list of image URLs (will be fetched and converted to base64)
            model: The OpenAI model to use (gpt-5.1, gpt-4o, or gpt-4o-mini)

        Yields:
            Text chunks as they are generated
        """
        if not self.openai_client:
            raise ValueError("OpenAI API key not configured")

        messages = [
            {"role": "system", "content": prompts["text_block"]},
            {"role": "user", "content": prompt},
        ]

        if image_urls:
            content = []

            if input_text:
                content.append({"type": "text", "text": input_text})

            for image_url in image_urls:
                image_base64 = await self._load_image_as_base64(image_url)
                content.append(
                    {"type": "image_url", "image_url": {"url": image_base64}}
                )

            messages.append({"role": "user", "content": content})
        elif input_text:
            messages.append({"role": "user", "content": input_text})

        stream = await self.openai_client.chat.completions.create(
            model=model, messages=messages, temperature=0.7, stream=True
        )

        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def generate_image(
        self,
        prompt: str,
        input: str | None = None,
        image_urls: list[str] | None = None,
        model: str = "gemini-3-pro-image-preview",
        is_variation: bool = False,
    ) -> tuple[Image.Image, str]:
        """
        Generate an image from a text prompt with optional input text and/or images.
        Images can be provided as input to guide the generation.

        Args:
            prompt: Text description of the image to generate
            input: Optional input text to integrate into the prompt
            image_urls: Optional list of image URLs (will be fetched and converted to base64)
            model: The Gemini model to use for image generation
            is_variation: If True, randomize the seed to generate variations

        Returns:
            Tuple of (PIL Image object, mime_type)
        """
        if not self.gemini_client:
            raise ValueError("Google API key not configured")

        contents = []

        if prompt:
            contents.append(genai.types.Part.from_text(text=prompt))
        if input:
            contents.append(genai.types.Part.from_text(text=input))

        if image_urls:
            for image_url in image_urls:
                image_bytes, content_type = await self._load_image_as_bytes(image_url)
                contents.append(
                    genai.types.Part.from_bytes(
                        data=image_bytes,
                        mime_type=content_type,
                    )
                )

        config_kwargs = {"response_modalities": ["IMAGE"]}
        if is_variation:
            config_kwargs["seed"] = random.randint(0, 2147483647)

        response = await self.gemini_client.aio.models.generate_content(
            model=model,
            contents=contents,
            config=genai.types.GenerateContentConfig(**config_kwargs),
        )

        print(response)

        if len(response.candidates) == 0:
            raise ValueError("No image in response")

        if response.candidates[0].finish_reason == "NO_IMAGE":
            raise ValueError("No image in response")

        for part in response.candidates[0].content.parts:
            try:
                mime_type = "image/png"
                if hasattr(part, "inline_data") and part.inline_data is not None:
                    if (
                        hasattr(part.inline_data, "mime_type")
                        and part.inline_data.mime_type
                    ):
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
        image_bytes, content_type = await self._load_image_as_bytes(image_url)
        image_base64 = base64.b64encode(image_bytes).decode("utf-8")
        return f"data:{content_type};base64,{image_base64}"

    async def _load_image_as_bytes(self, image_url: str) -> tuple[bytes, str]:
        """
        Fetch an image from disk and convert it to bytes.

        Args:
            image_url: Path or URL of the image to fetch (can be a data URL, file path, or API URL)

        Returns:
            Bytes of the image
        """
        try:
            filepath = None

            # Check if it's an API URL (e.g., /api/images/{image_id} or http://.../api/images/{image_id})
            api_match = re.search(r"/api/images/([^/?]+)", image_url)
            if api_match:
                image_id = api_match.group(1)
                images_dir = Path(settings.images_dir)
                for ext in ["jpg", "jpeg", "png", "gif", "webp"]:
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
                filepath = Path(image_url)
                # If relative path, resolve relative to images directory
                if not filepath.is_absolute():
                    filepath = Path(settings.images_dir) / filepath

            if filepath is None or not filepath.exists():
                raise FileNotFoundError(f"Image file not found: {image_url}")

            def read_file():
                with open(filepath, "rb") as f:
                    return f.read()

            image_bytes = await asyncio.to_thread(read_file)

            ext = filepath.suffix.lower()
            if ext in [".png"]:
                content_type = "image/png"
            elif ext in [".gif"]:
                content_type = "image/gif"
            elif ext in [".webp"]:
                content_type = "image/webp"
            elif ext in [".jpg", ".jpeg"]:
                content_type = "image/jpeg"
            else:
                try:
                    img = Image.open(filepath)
                    content_type = (
                        f"image/{img.format.lower()}" if img.format else "image/jpeg"
                    )
                except Exception:
                    content_type = "image/jpeg"

            return image_bytes, content_type
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
