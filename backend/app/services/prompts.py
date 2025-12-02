describe_prompt = """Describe this image in rich, detailed prose suitable as a creative prompt or comprehensive alt text. 
Include: 
- Main subjects and their positioning 
- Colors, lighting, and atmosphere 
- Style and mood 
- Notable details and textures 
- Any text or symbols visible 
Be vivid and specific, as if helping someone recreate or understand this image without seeing it.
"""

prompts = {
    "expand":
        "Take the following idea and expand it into a more detailed, richer version. " +
        "Maintain the same style, tone, and intent as the original. Add depth, examples, " +
        "or elaboration where appropriate, but don't change the core meaning.",
    "describe": describe_prompt,
}