from typing import List, Optional
from pydantic import BaseModel, Field


class Transaction(BaseModel):
    date: Optional[str]
    description: Optional[str]
    amount: Optional[float]
    txn_type: Optional[str]
    balance: Optional[float]


class AIStructuredStatement(BaseModel):
    account_number: Optional[str]
    account_holder: Optional[str]
    bank_name: Optional[str]
    statement_period: Optional[str]
    opening_balance: Optional[float]
    closing_balance: Optional[float]
    total_credits: Optional[float]
    total_debits: Optional[float]
    transactions: List[Transaction] = Field(default_factory=list)
    insights: Optional[list] = Field(default_factory=list)


class RuleBasedExtraction(BaseModel):
    bank_name: Optional[str]
    account_number: Optional[str]
    opening_balance: Optional[float]
    closing_balance: Optional[float]
    ifsc: Optional[str]
    available_balance: Optional[float]
    statement_period: Optional[str]


class ParsedStatement(BaseModel):
    bank_detected: Optional[str]
    rule_based_data: RuleBasedExtraction
    ai_structured_data: AIStructuredStatement
    cleaned_text: Optional[str]
