from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from app.models.token import ProToken
from app.core.security import hash_token
from datetime import datetime, timezone


async def get_token_by_session_id(session: AsyncSession, stripe_session_id: str) -> ProToken | None:
    result = await session.exec(
        select(ProToken).where(ProToken.stripe_session_id == stripe_session_id)
    )
    return result.first()


async def create_pro_token(
    session: AsyncSession,
    token: str,
    stripe_session_id: str,
    expires_at: datetime,
) -> ProToken:
    pro_token = ProToken(
        token_hash=hash_token(token),
        stripe_session_id=stripe_session_id,
        expires_at=expires_at,
    )
    session.add(pro_token)
    await session.commit()
    return pro_token


async def validate_pro_token(session: AsyncSession, token: str) -> ProToken | None:
    token_hash = hash_token(token)
    result = await session.exec(
        select(ProToken).where(
            ProToken.token_hash == token_hash,
            ProToken.is_active == True,
            ProToken.expires_at > datetime.now(timezone.utc),
        )
    )
    return result.first()


async def revoke_pro_token(session: AsyncSession, token: str) -> None:
    token_hash = hash_token(token)
    result = await session.exec(
        select(ProToken).where(ProToken.token_hash == token_hash)
    )
    pro_token = result.first()
    if pro_token:
        pro_token.is_active = False
        session.add(pro_token)
        await session.commit()