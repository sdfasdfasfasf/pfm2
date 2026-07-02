import os

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
ML_SERVICE_URL = os.getenv("ML_SERVICE_URL", "http://ml-service:8000")
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REQUEST_TOPIC = "tax-requests"
RESPONSE_TOPIC = "tax-responses"