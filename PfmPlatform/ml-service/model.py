def predict_deduction(description: str, amount: float) -> dict:
    print(f"DEBUG model: desc='{description}', amount={amount}")
    desc_lower = description.lower()
    # Медицина – все слова в нижнем регистре
    if any(word in desc_lower for word in ["стоматология", "стоматолог", "лечение", "больница", "анализ", "мед"]):
        return {"deductionType": "social", "reason": "Медицинские услуги", "eligibleAmount": amount}
    # Образование
    if any(word in desc_lower for word in ["курсы", "курс", "обучение", "университет", "школа", "образование"]):
        return {"deductionType": "social", "reason": "Образование", "eligibleAmount": amount}
    # Ипотека / недвижимость
    if any(word in desc_lower for word in ["ипотек", "процент", "квартир", "жильё", "покупка квартиры"]):
        return {"deductionType": "property", "reason": "Имущественный вычет", "eligibleAmount": amount}
    # Инвестиции
    if any(word in desc_lower for word in ["иис", "брокер", "инвестиц", "акции"]):
        return {"deductionType": "investment", "reason": "Инвестиционный вычет (ИИС)", "eligibleAmount": amount}
    return {"deductionType": "none", "reason": "Не подходит под вычет", "eligibleAmount": 0}