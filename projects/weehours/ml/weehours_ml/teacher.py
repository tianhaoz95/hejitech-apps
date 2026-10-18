"""The large teacher model, behind any OpenAI-compatible chat server (e.g. `vllm serve` on the
DGX Spark). Requests run concurrently; the server batches them."""

import asyncio
import json
import sys


def extract_json(text):
    """The first "{" to the last "}" of `text`, parsed; None if that isn't a JSON object."""
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        value = json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        return None
    return value if isinstance(value, dict) else None


class Teacher:
    def __init__(self, config):
        from openai import AsyncOpenAI

        self.config = config
        self.client = AsyncOpenAI(base_url=config["base_url"], api_key=config["api_key"])
        self.semaphore = asyncio.Semaphore(config["concurrency"])

    async def json(self, system, user, temperature=None, validate=None):
        """The first JSON object the teacher answers with that passes `validate` (if given),
        retrying up to `retries` times; None if every attempt fails."""
        for attempt in range(self.config["retries"]):
            async with self.semaphore:
                try:
                    response = await self.client.chat.completions.create(
                        model=self.config["model"],
                        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
                        temperature=self.config["temperature"] if temperature is None else temperature,
                        max_tokens=self.config["max_tokens"],
                        # gpt-oss thinks before answering, inside max_tokens; "low" keeps it short.
                        **({"reasoning_effort": self.config["reasoning_effort"]}
                           if self.config.get("reasoning_effort") else {}),
                    )
                except Exception as error:  # server hiccup: retry
                    print(f"teacher request failed (attempt {attempt + 1}): {error}", file=sys.stderr)
                    continue
            text = response.choices[0].message.content or ""
            value = extract_json(text)
            if value is None and text.strip().startswith("["):
                try:
                    value = {"items": json.loads(text.strip())}
                except json.JSONDecodeError:
                    value = None
            if value is not None and (validate is None or validate(value)):
                return value
        return None


async def run_all(items, worker, sink, label):
    """Runs `worker(item)` for every item concurrently, passing each non-None result to `sink`
    as it finishes, with a progress line every 50 items."""
    done = failed = 0

    async def one(item):
        nonlocal done, failed
        result = await worker(item)
        if result is None:
            failed += 1
        else:
            sink(result)
        done += 1
        if done % 50 == 0 or done == len(items):
            print(f"{label}: {done}/{len(items)} ({failed} failed)", flush=True)

    await asyncio.gather(*(one(item) for item in items))
    return failed
