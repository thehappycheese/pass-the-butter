from contextlib import asynccontextmanager
from typing import Annotated
from fastapi import Depends, FastAPI, Request
from .build_agent import BuildAgentResult, build_agent

@asynccontextmanager
async def lifespan(app:FastAPI):
    agent = build_agent() # compiled state graph
    app.state["agent"] = agent

    yield

async def get_agent(request:Request) -> BuildAgentResult:
    return request.app.state["agent"]

type DependsAgent = Annotated[BuildAgentResult, Depends(get_agent)]