from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import redis
import os
from model import predict_deduction

app = FastAPI(title="ML Service for Tax Deductions")

redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "redis"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    decode_responses=True
)

class Transaction(BaseModel):
    id: str
    date: str
    description: str
    amount: float

class PredictRequest(BaseModel):
    transactions: List[Transaction]

class DeductionResult(BaseModel):
    transactionId: str
    deductionType: str
    reason: str
    eligibleAmount: float

@app.post("/predict", response_model=List[DeductionResult])
async def predict(request: PredictRequest):
    results = []
    for tx in request.transactions:
        pred = predict_deduction(tx.description, tx.amount)
        results.append(DeductionResult(
            transactionId=tx.id,
            deductionType=pred["deductionType"],
            reason=pred["reason"],
            eligibleAmount=pred["eligibleAmount"]
        ))
        # Кэширование (опционально)
        redis_client.setex(f"ml:{tx.id}", 3600, pred["deductionType"])
    return results

@app.get("/health")
async def health():
    return {"status": "ok"}