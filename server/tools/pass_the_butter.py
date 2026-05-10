import asyncio
import random

from langchain_core.tools import tool

@tool
async def pass_the_butter() -> str:
    """Attempt to pass the butter. Slow and unreliable — succeeds ~50% of the time.
    If it fails, call this tool again until it succeeds."""
    # simulate I/O latency
    await asyncio.sleep(1.0)
    if random.random() < 0.5:
        return "SUCCESS: 🧈 The butter has been passed."
    return "FAILURE: I dropped the butter. Try calling pass_the_butter again."
