class RateLimitedError(Exception):
        """Provider hit a rate limit (HTTP 429 or similar)."""
        pass

