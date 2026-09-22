import logging
import traceback

from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger("core")


def custom_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    request = context.get("request")

    # DRF only produces a response for handled exceptions (validation errors,
    # 404s, permission errors, etc). Anything it returns None for is an
    # unhandled server error - those, plus any 5xx, get persisted.
    if response is None or response.status_code >= 500:
        _persist_error(exc, request)

    return response


def _persist_error(exc, request):
    from .models import ErrorLog

    logger.error("Unhandled exception: %s", exc, exc_info=True)
    try:
        user = getattr(request, "user", None)
        ErrorLog.objects.create(
            level=ErrorLog.Level.ERROR,
            message=str(exc)[:500] or exc.__class__.__name__,
            path=getattr(request, "path", "") if request else "",
            method=getattr(request, "method", "") if request else "",
            user=user if user is not None and user.is_authenticated else None,
            traceback=traceback.format_exc()[:5000],
        )
    except Exception:
        # Never let logging itself take down the request.
        logger.exception("Failed to persist ErrorLog")
