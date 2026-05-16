from contextlib import asynccontextmanager
from typing import Annotated
from fastapi import Depends, FastAPI, Request
from .build_agent import BuildAgentResult, build_agent
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

write_config = {"configurable": {"thread_id": "1", "checkpoint_ns": ""}}
read_config = {"configurable": {"thread_id": "1"}}

DB_URI = "postgres://langgraph:langgraph@postgres:5432/langgraph?sslmode=disable"


@asynccontextmanager
async def lifespan(app:FastAPI):
    async with AsyncPostgresSaver.from_conn_string(DB_URI) as checkpointer:
        # call .setup() the first time you're using the checkpointer
        #checkpointer.setup()

        agent = build_agent(checkpointer) # compiled state graph
        app.state["agent"] = agent
        yield

async def get_agent(request:Request) -> BuildAgentResult:
    return request.app.state["agent"]

type DependsAgent = Annotated[BuildAgentResult, Depends(get_agent)]
