describe_prompt = """Describe this image in rich, detailed prose suitable as a creative prompt or comprehensive alt text. 
Include: 
- Main subjects and their positioning 
- Colors, lighting, and atmosphere 
- Style and mood 
- Notable details and textures 
- Any text or symbols visible 
Be vivid and specific, as if helping someone recreate or understand this image without seeing it.
"""

reimagine_prompt = """Take the essential elements of the original prompt—the
core subjects, actions, and themes—and transplant them into a dramatically
different universe. Reimagine them in a new setting such as prehistoric times,
mythic antiquity (Greek, Roman, Egyptian), medieval kingdoms, Renaissance courts,
industrial-revolution cities, 19th-century frontiers, 1920s noir streets, Cold
War intrigue, contemporary slice-of-life, steampunk empires, dieselpunk or
atompunk worlds, cyberpunk megacities, sleek near-future societies, far-future
space operas, post-apocalyptic wastelands, virtual or simulated realities,
dreamlike surreal landscapes, or any other distinct reality. Rewrite the
scenario so that the technology, culture, and atmosphere fully reflect the
chosen universe, while preserving the original's emotional stakes and narrative
logic. The result should feel like a parallel-universe version of the same
idea—clearly related, but fresh, surprising, and self-contained."""

prompts = {
    "expand": "Take the following idea and expand it into a more detailed, richer version. "
    + "Maintain the same style, tone, and intent as the original. Add depth, examples, "
    + "or elaboration where appropriate, but don't change the core meaning.",
    "twist": "Take the following idea and add an unexpected twist or surprising new angle to it. "
    + "Keep the core concept recognizable, but subvert expectations, flip a key assumption, "
    + "or introduce an ironic, humorous, or thought-provoking element that transforms the original.",
    "reimagine": reimagine_prompt.replace("\n", " "),
    "describe": describe_prompt,
}
