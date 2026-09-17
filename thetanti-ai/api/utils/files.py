from pathlib import Path


def safe_child(base: Path, *parts: str) -> Path:
    base_resolved = base.resolve()
    target = base_resolved.joinpath(*parts).resolve()
    if base_resolved != target and base_resolved not in target.parents:
        raise ValueError("Path escapes storage root")
    return target
