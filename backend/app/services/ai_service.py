import base64
import re
import asyncio
import random
import requests
from dataclasses import dataclass
from pathlib import Path
from typing import AsyncIterator
from PIL import Image
from openai import AsyncOpenAI
from google import genai
from ..prompts import get_text_system_prompt
from ..config import get_settings

settings = get_settings()


@dataclass
class TokenUsage:
    """Token usage information from an AI request."""

    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0


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
    ) -> AsyncIterator[str | TokenUsage]:
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
            Text chunks as they are generated, then TokenUsage at the end
        """
        if not self.openai_client:
            raise ValueError("OpenAI API key not configured")
        messages = [
            {"role": "system", "content": get_text_system_prompt()},
            {"role": "user", "content": prompt},
        ]
        if input_text:
            messages.append({"role": "user", "content": input_text})
        if image_urls:
            content = []
            for image_url in image_urls:
                content.append({"type": "image_url", "image_url": {"url": image_url}})
            messages.append({"role": "user", "content": content})
        stream = await self.openai_client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.7,
            stream=True,
            stream_options={"include_usage": True},
        )
        usage = TokenUsage()
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
            # Capture usage from the final chunk
            if chunk.usage:
                usage = TokenUsage(
                    input_tokens=chunk.usage.prompt_tokens or 0,
                    output_tokens=chunk.usage.completion_tokens or 0,
                    total_tokens=chunk.usage.total_tokens or 0,
                )
        yield usage

    async def generate_image(
        self,
        prompt: str,
        input: str | None = None,
        image_urls: list[str] | None = None,
        model: str = "gemini-3-pro-image-preview",
        is_variation: bool = False,
    ) -> tuple[bytes, str, TokenUsage]:
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
            Tuple of (PIL Image object, mime_type, TokenUsage)
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
                response = requests.get(image_url)
                response.raise_for_status()
                img_bytes = response.content
                mime_type = response.headers.get("Content-Type", "image/png")
                contents.append(
                    genai.types.Part.from_bytes(
                        data=img_bytes,
                        mime_type=mime_type,
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
        # Extract token usage from response
        usage = TokenUsage()
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            usage = TokenUsage(
                input_tokens=getattr(response.usage_metadata, "prompt_token_count", 0)
                or 0,
                output_tokens=getattr(
                    response.usage_metadata, "candidates_token_count", 0
                )
                or 0,
                total_tokens=getattr(response.usage_metadata, "total_token_count", 0)
                or 0,
            )
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
                image = part.inline_data.data
                if image is not None:
                    return image, mime_type, usage
            except (AttributeError, ValueError):
                continue
        raise ValueError("No image generated in response")


# Singleton instance
_ai_service: AIService | None = None


def get_ai_service() -> AIService:
    """Get or create the AI service singleton."""
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service
