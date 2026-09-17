from secrets import token_hex


def new_job_id(prefix: str) -> str:
    return f"{prefix}_{token_hex(6)}"
