import re


def validate_base64(value, field_name, min_len=1, max_len=10240):
    if len(value) < min_len:
        raise ValueError(f"'{field_name}' is too short")
    if len(value) > max_len:
        raise ValueError(f"'{field_name}' is too long")
    if not re.match(r"^[A-Za-z0-9+/=]+$", value):
        raise ValueError(f"'{field_name}' is invalid")
    return value