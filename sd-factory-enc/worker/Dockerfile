FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y --no-install-recommends openjdk-17-jre-headless unzip zip file && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/sdfactory
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY inspect_apk.py .
RUN useradd --create-home --uid 10001 worker
USER worker
ENTRYPOINT ["python", "/opt/sdfactory/inspect_apk.py"]
