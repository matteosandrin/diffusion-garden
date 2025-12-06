import os


def _read_prompt_file(filename):
    dir_path = os.path.dirname(os.path.abspath(__file__))
    full_path = os.path.join(dir_path, filename)
    try:
        with open(full_path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError as e:
        raise FileNotFoundError(
            f"Prompt file '{filename}' not found at '{full_path}'."
        ) from e


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

image_to_json_prompt = _read_prompt_file("image_to_json_prompt.txt")
text_block_prompt = _read_prompt_file("text_block_prompt.txt")

prompts = {
    "expand": "Take the following idea and expand it into a more detailed, richer version. "
    + "Maintain the same style, tone, and intent as the original. Add depth, examples, "
    + "or elaboration where appropriate, but don't change the core meaning.",
    "twist": "Take the following idea and add an unexpected twist or surprising new angle to it. "
    + "Keep the core concept recognizable, but subvert expectations, flip a key assumption, "
    + "or introduce an ironic, humorous, or thought-provoking element that transforms the original.",
    "reimagine": reimagine_prompt.replace("\n", " "),
    "describe": describe_prompt,
    "image_to_json": image_to_json_prompt,
    "text_block": text_block_prompt,
}
