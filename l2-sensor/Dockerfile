FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY sensor.py .

RUN mkdir -p /app/output

EXPOSE 8080

CMD ["python", "sensor.py"]
