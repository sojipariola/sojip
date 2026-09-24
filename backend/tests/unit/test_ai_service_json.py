"""Unit tests for AIService's JSON parsing."""
import json

import pytest

from app.services.ai_service import AIService, AIServiceError

pytestmark = pytest.mark.unit


@pytest.fixture
def svc():
    return AIService()


@pytest.mark.asyncio
async def test_chat_json_parses_plain_json(monkeypatch, svc):
    async def fake_chat(*a, **k):
        return '{"passed": true, "reasoning": "ok"}'
    monkeypatch.setattr(svc, "chat", fake_chat)

    result = await svc.chat_json("sys", "msg")
    assert result == {"passed": True, "reasoning": "ok"}


@pytest.mark.asyncio
async def test_chat_json_strips_markdown_fences(monkeypatch, svc):
    async def fake_chat(*a, **k):
        return '```json\n{"passed": false}\n```'
    monkeypatch.setattr(svc, "chat", fake_chat)

    result = await svc.chat_json("sys", "msg")
    assert result == {"passed": False}


@pytest.mark.asyncio
async def test_chat_json_rejects_garbage(monkeypatch, svc):
    async def fake_chat(*a, **k):
        return 'this is not JSON at all'
    monkeypatch.setattr(svc, "chat", fake_chat)

    with pytest.raises(AIServiceError):
        await svc.chat_json("sys", "msg")


@pytest.mark.asyncio
async def test_chat_json_recovers_truncated_json(monkeypatch, svc):
    async def fake_chat(*a, **k):
        return '{"passed": true, "reasoning": "ok"'  # missing closing brace
    monkeypatch.setattr(svc, "chat", fake_chat)

    result = await svc.chat_json("sys", "msg")
    # The recovery logic finds the last `}` and tries again
    assert result.get("passed") is True
