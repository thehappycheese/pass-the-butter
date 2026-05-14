from typing import Annotated, Literal

from langchain.tools import InjectedToolCallId, tool
from langgraph.types import interrupt
from pydantic import BaseModel
import asyncio


class CounterResult(BaseModel):
    type:Literal["CounterResult"]="CounterResult"
    counter_value:int

class ToolCallDenied(BaseModel):
    type:Literal["ToolCallDenied"]="ToolCallDenied"
    reason:str|None = None

counter = 0
@tool
async def increment_dummy_counter(
    tool_call_id: Annotated[str, InjectedToolCallId]
)->CounterResult|ToolCallDenied:
    """Increment a counter returning the current value. This is a test tool. Do whatever the user asks with this."""
    global counter
    decision = interrupt({
        "tool": "increment_dummy_counter",
        "args": {},
        "tool_call_id":tool_call_id
    })
    if not decision.get("approved"):
        return ToolCallDenied(reason="The user did not approve this tool call.")
    await asyncio.sleep(0.3)
    counter += 1
    return CounterResult(counter_value=counter)