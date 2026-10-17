import stripe
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from datetime import datetime, timedelta, timezone
from app.core.config import settings
from app.core.security import create_pro_token
from app.core.database import get_session
from app.crud.token import create_pro_token as db_create_pro_token, validate_pro_token
from app.schemas.token import TokenActivate, TokenRead

router = APIRouter(prefix="/api/payments", tags=["Payments"])

stripe.api_key = settings.STRIPE_SECRET_KEY


@router.post("/create-checkout")
async def create_checkout():
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(501, "Payments not configured")
    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{"price": settings.STRIPE_PRO_PRICE_ID, "quantity": 1}],
        mode="payment",
        success_url="http://localhost:8000/api/payments/success?session_id={CHECKOUT_SESSION_ID}",
        cancel_url="http://localhost:8000/",
    )
    return {"checkout_url": session.url}


@router.post("/webhook")
async def stripe_webhook(request: Request, session: AsyncSession = Depends(get_session)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(400, "Invalid webhook signature")

    if event["type"] == "checkout.session.completed":
        # Token creation is handled by /success — webhook just acknowledges the event
        pass

    return {"status": "ok"}


@router.get("/success")
async def payment_success(session_id: str, session: AsyncSession = Depends(get_session)):
    stripe_session = stripe.checkout.Session.retrieve(session_id)
    if stripe_session.payment_status != "paid":
        raise HTTPException(400, "Payment not completed")

    token = create_pro_token(session_id, days=30)
    expires_at = datetime.now(timezone.utc) + timedelta(days=30)
    await db_create_pro_token(session, token, session_id, expires_at)

    return {
        "pro_token": token,
        "message": "Save this token — paste it on the site to activate Pro.",
        "expires_days": 30,
    }


@router.post("/activate-token", response_model=TokenRead)
async def activate_token(body: TokenActivate, session: AsyncSession = Depends(get_session)):
    pro_token = await validate_pro_token(session, body.token)
    if not pro_token:
        return TokenRead(is_valid=False, message="Token is invalid or expired")
    return TokenRead(is_valid=True, expires_at=pro_token.expires_at, message="Pro activated")
