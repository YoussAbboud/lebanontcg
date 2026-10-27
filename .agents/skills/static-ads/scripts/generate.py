"""
Static Ads Pipeline — Image Generator
--------------------------------------
Generates static ad creatives (with text overlay) using fal-ai/openai/gpt-image-2/edit.
Chosen for its accurate text rendering.

Modes:
  --setup              Create folder structure only
  --mode generate      Read prompts.json and generate all ads
  --ads a,b,c          Only regenerate ads matching these names (comma-separated)

Usage:
  py -3 .claude/skills/static-ads/scripts/generate.py --campaign {brand}/{product} --setup
  py -3 .claude/skills/static-ads/scripts/generate.py --campaign {brand}/{product} --mode generate
  py -3 .claude/skills/static-ads/scripts/generate.py --campaign {brand}/{product} --mode generate --ads 01-hero-1x1
"""

import argparse
import json
import os
import shutil
import sys
import tempfile
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path.cwd()
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_PRODUCT_IMAGES = 8
MAX_REFERENCES = 14


def get_dirs(campaign: str) -> dict:
    input_dir = BASE_DIR / "input" / "static-ads" / campaign
    output_dir = BASE_DIR / "output" / "static-ads" / campaign
    brand_dir = input_dir / "_brand"
    return {
        "input": input_dir,
        "output": output_dir,
        "products": input_dir / "products",
        "brand_dir": brand_dir,
        "brand_voice_json": brand_dir / "brand_voice.json",
        "brand_references": brand_dir / "references",
        "copy_json": input_dir / "copy.json",
        "layout_json": input_dir / "layout.json",
        "prompts_json": input_dir / "prompts.json",
        "brief_json": input_dir / "brief.json",
        "final": output_dir / "final",
    }


def get_images(folder: Path) -> list[Path]:
    if not folder.exists():
        return []
    return sorted(f for f in folder.iterdir() if f.suffix.lower() in IMAGE_EXTS)


def upload_image(path: Path) -> str:
    import fal_client

    suffix = path.suffix.lower() or ".jpg"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp_path = tmp.name
    shutil.copy2(str(path), tmp_path)
    try:
        return fal_client.upload_file(tmp_path)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def upload_images(paths: list[Path]) -> list[str]:
    urls = []
    for p in paths:
        print(f"    Uploading: {p.name}")
        urls.append(upload_image(p))
    return urls


# --- Mode: setup ---

def setup(dirs: dict):
    for key in ["products", "output", "final", "brand_references"]:
        folder = dirs[key]
        folder.mkdir(parents=True, exist_ok=True)
        print(f"  OK: {folder.relative_to(BASE_DIR)}")

    if dirs["brand_voice_json"].exists():
        print(f"\n  Found cached brand voice: {dirs['brand_voice_json'].relative_to(BASE_DIR)}")
        print("  (Step 1 brand voice analysis can reuse this)")

    print("\n  Drop product images into:")
    print(f"    {dirs['products'].relative_to(BASE_DIR)}")
    print("\n  (Optional) Drop brand reference assets (logo, ad samples, typography samples) into:")
    print(f"    {dirs['brand_references'].relative_to(BASE_DIR)}")


# --- Mode: generate ---

def generate_ads(dirs: dict, name_filter: list[str] | None = None):
    """Read prompts.json and generate each ad via fal-ai/openai/gpt-image-2/edit."""
    import fal_client

    prompts_file = dirs["prompts_json"]
    if not prompts_file.exists():
        print(f"  FAIL: prompts.json not found at {prompts_file.relative_to(BASE_DIR)}")
        sys.exit(1)

    product_paths = get_images(dirs["products"])[:MAX_PRODUCT_IMAGES]
    if not product_paths:
        print(f"  FAIL: No product images in {dirs['products'].relative_to(BASE_DIR)}")
        sys.exit(1)

    final_dir = dirs["final"]
    final_dir.mkdir(parents=True, exist_ok=True)

    with open(prompts_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    ads = data.get("ads", [])
    if not ads:
        print("  FAIL: prompts.json has no ads")
        sys.exit(1)

    # Filter ads if requested
    if name_filter:
        ads = [a for a in ads if a.get("name") in name_filter]
        if not ads:
            print(f"  FAIL: No ads match filter {name_filter}")
            sys.exit(1)

    # Pre-upload references (shared across all ads)
    print("  Uploading reference images...")
    print(f"    Products: {len(product_paths)}")
    product_urls = upload_images(product_paths)

    brand_ref_urls = []
    brand_ref_paths = get_images(dirs["brand_references"])
    if brand_ref_paths:
        print(f"    Brand references: {len(brand_ref_paths)}")
        brand_ref_urls = upload_images(brand_ref_paths)

    print(f"\n  Generating {len(ads)} ad creative(s)...")
    print("-" * 50)

    # Map aspect ratio strings to gpt-image-2/edit's image_size parameter.
    # gpt-image-2 supports named presets or custom {width, height} (multiples of 16).
    aspect_to_image_size = {
        "1:1": "square_hd",                              # 1024x1024
        "4:5": {"width": 1024, "height": 1280},          # 4:5 portrait
        "9:16": "portrait_16_9",                         # ~9:16 portrait
        "16:9": "landscape_16_9",                        # ~16:9 landscape
        "3:4": "portrait_4_3",
        "4:3": "landscape_4_3",
    }

    for i, ad in enumerate(ads, 1):
        name = ad.get("name", f"ad-{i:02d}")
        prompt = ad.get("prompt", "")
        aspect_ratio = ad.get("aspect_ratio", "1:1")
        ref_types = ad.get("reference_images", ["product"])

        if not prompt:
            print(f"  [{i}/{len(ads)}] {name}: SKIP (no prompt)")
            continue

        # Build reference URLs
        image_urls = []
        if "product" in ref_types:
            image_urls.extend(product_urls)
        if "brand_references" in ref_types and brand_ref_urls:
            image_urls.extend(brand_ref_urls)

        # Cap to nano/gpt-image-2 limit (conservative 14)
        if len(image_urls) > MAX_REFERENCES:
            image_urls = image_urls[:MAX_REFERENCES]

        image_size = aspect_to_image_size.get(aspect_ratio, "square_hd")
        print(f"  [{i}/{len(ads)}] {name} ({aspect_ratio} -> {image_size}, refs: {len(image_urls)})")

        try:
            result = fal_client.run(
                "openai/gpt-image-2/edit",
                arguments={
                    "prompt": prompt,
                    "image_urls": image_urls,
                    "image_size": image_size,
                    "quality": "high",
                    "num_images": 1,
                },
            )

            image_url = result["images"][0]["url"]

            # Versioning for re-runs
            base_path = final_dir / f"{name}.png"
            if name_filter and base_path.exists():
                v = 2
                while (final_dir / f"{name}_v{v}.png").exists():
                    v += 1
                output_path = final_dir / f"{name}_v{v}.png"
            else:
                output_path = base_path

            urllib.request.urlretrieve(image_url, str(output_path))
            print(f"    OK: {output_path.relative_to(BASE_DIR)}")

        except Exception as e:
            # Encode safely - error messages may contain non-cp949 chars on Windows
            safe_msg = str(e).encode("ascii", errors="replace").decode("ascii")
            print(f"    FAIL: {safe_msg}")

    print("\n" + "-" * 50)
    print(f"  Done! Images saved to: {final_dir.relative_to(BASE_DIR)}")


# --- Main ---

def main():
    parser = argparse.ArgumentParser(description="Static Ads Pipeline — Image Generator")
    parser.add_argument("--campaign", required=True, help="Campaign path: {brand}/{product}")
    parser.add_argument("--mode", choices=["generate"], help="Generation mode")
    parser.add_argument("--setup", action="store_true", help="Create folder structure only")
    parser.add_argument("--ads", type=str, default=None,
                        help="Comma-separated ad names to regenerate (e.g. 01-hero-1x1,02-benefit-4x5)")
    args = parser.parse_args()

    if not os.getenv("FAL_KEY") and not args.setup:
        print("FAIL: FAL_KEY not set. Add it to .env")
        sys.exit(1)

    dirs = get_dirs(args.campaign)
    print(f"\n[*] Campaign: {args.campaign}")

    if args.setup:
        print("[*] Setting up workspace...")
        setup(dirs)
    elif args.mode == "generate":
        name_filter = [s.strip() for s in args.ads.split(",")] if args.ads else None
        if name_filter:
            print(f"[*] Re-generating ads: {name_filter}")
        else:
            print("[*] Generating all ads from prompts.json...")
        generate_ads(dirs, name_filter=name_filter)
    else:
        print("FAIL: Specify --setup or --mode generate")
        sys.exit(1)

    print("\n[OK] Done.")


if __name__ == "__main__":
    main()
