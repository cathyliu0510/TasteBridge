# TasteBridge API service
FROM python:3.12-slim-bookworm

# uv for dependency management (pinned, copied from the official image)
COPY --from=ghcr.io/astral-sh/uv:0.12.19 /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_NO_CACHE=1 \
    PATH="/app/.venv/bin:$PATH" \
    PORT=9000

# Run as a non-root user
RUN useradd --create-home --uid 1000 app
WORKDIR /app

# Install dependencies first so this layer is cached when only code changes
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-dev --no-install-project

COPY app ./app
COPY sample_artifacts ./sample_artifacts
RUN mkdir -p /app/feedback && chown app:app /app/feedback

USER app
EXPOSE 9000

# Cloud Run sets $PORT; locally it defaults to 9000
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
