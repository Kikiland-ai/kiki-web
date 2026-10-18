FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.13.1 /uv /usr/local/bin/uv
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_PROJECT_ENVIRONMENT=/opt/venv
WORKDIR /app/apps/api
COPY apps/api/pyproject.toml apps/api/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY apps/api/src ./src
COPY data-model/media/cam-contract /app/data-model/media/cam-contract
ENV PATH="/opt/venv/bin:$PATH" PYTHONPATH=/app/apps/api/src
USER 65532:65532
EXPOSE 8080
CMD ["python", "-m", "kiki_api.cloud_entrypoint"]
