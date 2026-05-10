from contextlib import asynccontextmanager
import os
from typing import Annotated

from fastapi import Depends, FastAPI, Request
from pydantic import SecretStr
from langchain_anthropic import ChatAnthropic

from .build_agent import BuildAgentResult, build_agent

@asynccontextmanager
async def lifespan(app:FastAPI):
    llm = ChatAnthropic(
        model_name="claude-opus-4-5",
        api_key=SecretStr(os.environ["ANTHROPIC_API_KEY"]),
        timeout=60*2,
        stop=None,
        streaming=True,
    )
    app.state["llm"] = llm

    agent = build_agent(llm) # compiled state graph
    app.state["agent"] = agent

    yield

async def get_agent(request:Request) -> BuildAgentResult:
    return request.app.state["agent"]

type DependsAgent = Annotated[BuildAgentResult, Depends(get_agent)]