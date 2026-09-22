import logging
import traceback

logger = logging.getLogger("core")


class ErrorLoggingMiddleware:
    """Persists unhandled exceptions that occur outside DRF views (e.g. in
    Django admin) to the ErrorLog table. DRF views are covered separately by
    core.exceptions.custom_exception_handler.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)

    def process_exception(self, request, exception):
        from .models import ErrorLog

        logger.error("Unhandled exception at %s", request.path, exc_info=True)
        try:
            user = getattr(request, "user", None)
            ErrorLog.objects.create(
                level=ErrorLog.Level.ERROR,
                message=str(exception)[:500] or exception.__class__.__name__,
                path=request.path,
                method=request.method,
                user=user if user is not None and getattr(user, "is_authenticated", False) else None,
                traceback=traceback.format_exc()[:5000],
            )
        except Exception:
            logger.exception("Failed to persist ErrorLog")
        return None
