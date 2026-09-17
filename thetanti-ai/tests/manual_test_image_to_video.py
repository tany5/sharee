import argparse
import sys
import time
from pathlib import Path

import httpx


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("image", type=Path)
    parser.add_argument("--api", default="http://localhost:8000")
    parser.add_argument("--key", default="change-me")
    parser.add_argument("--prompt", default="The saree fabric moves naturally in a cinematic fashion reel")
    args = parser.parse_args()

    print("Uploading image...")
    with args.image.open("rb") as image_file:
        res = httpx.post(
            f"{args.api}/api/v1/videos/from-image",
            headers={"Authorization": f"Bearer {args.key}"},
            data={"prompt": args.prompt, "duration": "5", "fps": "24"},
            files={"image": (args.image.name, image_file, "image/png")},
            timeout=60,
        )
    res.raise_for_status()
    job_id = res.json()["job_id"]
    print(f"Job: {job_id}")

    while True:
        job = httpx.get(f"{args.api}/api/v1/jobs/{job_id}", headers={"Authorization": f"Bearer {args.key}"}).json()
        progress = int(job.get("progress", 0))
        bar = "█" * (progress // 5) + "░" * (20 - progress // 5)
        print(f"\rProcessing: [{bar}] {progress}%", end="")
        if job["status"] in {"completed", "failed", "cancelled"}:
            print()
            break
        time.sleep(2)

    if job["status"] != "completed":
        print(f"Failed: {job.get('error', 'unknown error')}")
        return 1
    print("Completed.")
    print("Output:", job["result"]["url"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
