FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml ./
COPY src ./src
RUN pip install --no-cache-dir . && useradd --system --uid 10001 gridex
USER gridex
ENTRYPOINT ["gridex-data"]
CMD ["run"]
