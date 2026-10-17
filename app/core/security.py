import jwt
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from app.core.config import settings

ALGORITHM = "HS256"


def create_access_token(data: dict, expires_days: int = 7) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(days=expires_days)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def create_pro_token(stripe_session_id: str, days: int = 30) -> str:
    payload = {
        "tier": "pro",
        "stripe_session": stripe_session_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=days),
        "jti": secrets.token_hex(16),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
