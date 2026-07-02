from confluent_kafka import Consumer, Producer, KafkaError
import json
import requests
import redis
import sys
from config import *

# Kafka Consumer
conf = {
    'bootstrap.servers': KAFKA_BOOTSTRAP_SERVERS,
    'group.id': 'tax-service-group',
    'auto.offset.reset': 'earliest',
}
consumer = Consumer(conf)
consumer.subscribe([REQUEST_TOPIC])

# Kafka Producer
producer = Producer({'bootstrap.servers': KAFKA_BOOTSTRAP_SERVERS})

# Redis (для кэширования, опционально)
redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

def delivery_report(err, msg):
    if err is not None:
        print(f'Message delivery failed: {err}')

def process_request(request_data):
    request_id = request_data.get("RequestId")
    transactions = request_data.get("Transactions", [])
    
    # ПРЕОБРАЗУЕМ ПОЛЯ В НИЖНИЙ РЕГИСТР ДЛЯ ML-СЕРВИСА
    transactions_for_ml = []
    for tx in transactions:
        transactions_for_ml.append({
            "id": tx["Id"],               # было Id -> стало id
            "date": tx["Date"],           # Date -> date
            "description": tx["Description"],
            "amount": float(tx["Amount"]) # Amount -> amount
        })
    
    # Вызов ML-сервиса
    try:
        resp = requests.post(f"{ML_SERVICE_URL}/predict", 
                             json={"transactions": transactions_for_ml}, 
                             timeout=10)
        resp.raise_for_status()
        predictions = resp.json()
    except Exception as e:
        print(f"ML error: {e}")
        return
    
    print(f"ML predictions: {predictions}") 

    # # Формирование ответа (сохраняем исходные имена полей с заглавными буквами для контракта с .NET)
    # total_eligible = sum(p.get("eligibleAmount", 0) for p in predictions)
    # estimated_refund = round(total_eligible * 0.13, 2)
    # response = {
    #     "RequestId": request_id,
    #     "Deductions": predictions,      # predictions уже содержит transactionId, deductionType, reason, eligibleAmount
    #     "Summary": {
    #         "TotalEligible": total_eligible,
    #         "EstimatedRefund": estimated_refund
    #     }
    # }

    # Преобразование camelCase -> PascalCase
    def to_pascal_case(d: dict) -> dict:
        return {
            "TransactionId": d.get("transactionId", ""),
            "DeductionType": d.get("deductionType", "none"),
            "Reason": d.get("reason", ""),
            "EligibleAmount": d.get("eligibleAmount", 0)
        }

    deductions_pascal = [to_pascal_case(p) for p in predictions]

    total_eligible = sum(d["EligibleAmount"] for d in deductions_pascal)
    estimated_refund = round(total_eligible * 0.13, 2)

    response = {
        "RequestId": request_id,
        "Deductions": deductions_pascal,
        "Summary": {
            "TotalEligible": total_eligible,
            "EstimatedRefund": estimated_refund
        }
    }
    
    # Сохраняем в Redis
    redis_client.setex(f"result:{request_id}", 3600, json.dumps(response))
    
    # Отправляем в Kafka
    producer.produce(RESPONSE_TOPIC, key=request_id, value=json.dumps(response), callback=delivery_report)
    producer.flush()
    print(f"Processed {request_id}")

def main():
    print("Tax service started")
    while True:
        msg = consumer.poll(1.0)
        if msg is None:
            continue
        if msg.error():
            if msg.error().code() != KafkaError._PARTITION_EOF:
                print(f"Consumer error: {msg.error()}")
            continue
        try:
            request_data = json.loads(msg.value().decode('utf-8'))
            process_request(request_data)
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        consumer.close()