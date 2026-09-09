# Optional: deploy as an Azure App Service "custom container" (or any container host).
# For a plain "code" deployment to App Service Linux you do NOT need this file —
# just set the Startup Command to `python apps/api/main.py` (see README).
FROM python:3.12-slim

WORKDIR /app
COPY . /app

# No third-party dependencies, but keep the step for future-proofing.
RUN pip install --no-cache-dir -r requirements.txt || true

# App Service for Containers sets WEBSITES_PORT; default to 8025 locally.
ENV PORT=8025
EXPOSE 8025

CMD ["python", "apps/api/main.py"]
