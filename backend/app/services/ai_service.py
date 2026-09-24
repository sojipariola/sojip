"""
Thin wrapper around Ollama's OpenAI-compatible API.

All AI calls in SOJIP flow through this module. When we migrate from
Ollama to vLLM (or to an external provider), only this file changes.
"""
import json
from typing import Any

import httpx

from app.config import settings


class AIServiceError(Exception):
    """Raised when the AI backend is unreachable or returns invalid data."""


# Qwen3 emits a separate `reasoning` field for its chain-of-thought when
# thinking mode is on. We want clean JSON output, not deliberation, so we
# prepend /no_think to every system prompt. See:
# https://qwen.readthedocs.io/en/latest/deployment/llama.cpp.html
NO_THINK = "/no_think"


class AIService:
    def __init__(self) -> None:
        if settings.ai_backend == "vllm":
            self.base_url = settings.vllm_url
            self.model = settings.vllm_model
        else:
            self.base_url = settings.ollama_url
            self.model = settings.ollama_model

    async def chat(
        self,
        system_prompt: str,
        user_message: str,
        *,
        json_mode: bool = False,
        timeout: float = 300.0,
    ) -> str:
        """
        Send a chat request and return the assistant's text response.

        If json_mode is True, requests structured JSON output. Note:
        Ollama's `response_format` support depends on the model.
        """
        # Prepend /no_think so Qwen3 skips its reasoning preamble.
        effective_system = f"{NO_THINK}\n\n{system_prompt}"

        messages = [
            {"role": "system", "content": effective_system},
            {"role": "user", "content": user_message},
        ]

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": settings.ai_temperature,
            "max_tokens": max(settings.ai_max_tokens, 2048),
        }

        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
        except httpx.HTTPStatusError as e:
            raise AIServiceError(
                f"AI backend returned HTTP {e.response.status_code}: {e.response.text[:200]}"
            ) from e
        except httpx.TimeoutException as e:
            raise AIServiceError(
                f"AI backend timed out after {timeout}s — model may be too slow on CPU"
            ) from e
        except httpx.HTTPError as e:
            raise AIServiceError(
                f"AI backend unreachable ({type(e).__name__}): {e!r}"
            ) from e

        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as e:
            raise AIServiceError(f"Unexpected AI response shape: {data}") from e

        if not content:
            raise AIServiceError(
                f"AI returned empty content. Full response: {json.dumps(data)[:500]}"
            )

        return content

    async def chat_json(
        self,
        system_prompt: str,
        user_message: str,
        *,
        timeout: float = 300.0,
    ) -> dict:
        """
        Send a chat request and parse the response as JSON.

        Strips markdown fences if the model wraps its output in
        ```json ... ```. Also tries to recover from truncated JSON by
        finding the last complete closing brace.
        """
        raw = await self.chat(
            system_prompt, user_message, json_mode=False, timeout=timeout
        )

        # Strip markdown fences
        text = raw.strip()
        if text.startswith("```"):
            # Remove leading ```json or ```
            if "\n" in text:
                text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

        # Try direct parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try to recover truncated JSON by finding the last balanced brace
        last_brace = text.rfind("}")
        if last_brace > 0:
            candidate = text[: last_brace + 1]
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                pass

        raise AIServiceError(
            f"AI returned non-JSON content (first 300 chars): {raw[:300]}"
        )


    async def critique_field(
        self,
        *,
        field_name: str,
        field_prompt: str,
        field_value: str,
        timeout: float = 180.0,
    ) -> dict:
        """
        Ask the AI Mentor for a per-field critique.

        Returns {"severity": str, "body": str}.
        Falls back to a safe default if the AI is unreachable.
        """
        from pathlib import Path as _Path

        prompt_path = (
            _Path(__file__).parent.parent / "prompts" / "field_critique.txt"
        )
        system_prompt = prompt_path.read_text(encoding="utf-8").strip()

        user_message = (
            f"Field: {field_name}\n"
            f"Question this field must answer: {field_prompt}\n\n"
            f"Student's current answer:\n{field_value or '(empty)'}\n"
        )

        try:
            return await self.chat_json(
                system_prompt=system_prompt,
                user_message=user_message,
                timeout=timeout,
            )
        except AIServiceError:
            return {
                "severity": "info",
                "body": "AI critique unavailable right now. Please try again later.",
            }


_ai_service: AIService | None = None


def get_ai_service() -> AIService:
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service
