FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev curl && \
    rm -rf /var/lib/apt/lists/*

COPY pyproject.toml /app/
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir .

COPY app /app/app
COPY alembic.ini /app/
COPY migrations /app/migrations

CMD ["python", "-m", "app.bootstrap"]
