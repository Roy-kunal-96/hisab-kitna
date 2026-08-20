"""
Data models and dataclasses for Hisab Kitab Python backend.
"""

from dataclasses import dataclass, asdict
from typing import Optional, List, Dict, Any


@dataclass
class ParsedVoiceIntent:
    intent: str
    person: Optional[str] = None
    amount: Optional[float] = None
    transaction_type: Optional[str] = None
    description: Optional[str] = None
    period: Optional[str] = None
    confirmation_prompt: str = ""
    speech_response: str = ""
    clarification_needed: bool = False
    clarification_question: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Person:
    id: int
    user_id: int
    name: str
    phone: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    status: str = "ACTIVE"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Transaction:
    id: int
    person_id: int
    amount: float
    type: str
    description: Optional[str] = None
    transaction_date: str = ""
    created_at: Optional[str] = None
    reference_id: Optional[int] = None
    status: str = "ACTIVE"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class BalanceInfo:
    netBalance: float
    rawBalance: float
    balanceType: str  # 'LENA_HAI' | 'DENA_HAI' | 'SETTLED'
    totalGiven: float
    totalReceived: float
    totalPayable: float
    totalPaid: float
    transactionCount: int

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
