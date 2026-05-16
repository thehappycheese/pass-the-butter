
import json
from pathlib import Path
from typing import Any

from fastapi import  FastAPI, Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from langgraph.types import Command
from langgraph.graph import MessagesState
from pydantic import BaseModel


from langchain_core.messages import HumanMessage, AIMessageChunk, AIMessage, ToolMessage
from langchain_core.runnables.config import RunnableConfig
from sse_starlette.sse import EventSourceResponse

from .lifespan import lifespan, DependsAgent

app = FastAPI(title="Butter Agent", lifespan=lifespan)


@app.middleware("http")
async def add_no_cache_header(request: Request, call_next):
    response = await call_next(request)
    # Force browser to not cache and revalidate
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    return response

STATIC_DIR = Path("frontend_dist").resolve()
assert STATIC_DIR.is_dir()

app.mount("/debug", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
async def redirect():
    return RedirectResponse(url="/debug/index.html")


async def _event_gen(
    request: Request,
    inputs: MessagesState | Command,
    session_id: str,
    agent: DependsAgent,
):
    config:RunnableConfig = {
        "configurable": {"thread_id": session_id}
    }
    # try:
    async for ns, mode, payload in agent.astream(
        inputs,
        stream_mode=[
            "messages",
            "updates",
            "custom",
        ],
        subgraphs=True,
        config=config,
    ):
        if await request.is_disconnected():
            break
        match mode:
            case "messages":
                chunk, _meta = payload
                match chunk:
                    case AIMessageChunk(content=str() as text) if text:
                        yield {"event": "token", "data": json.dumps({"text": text})}
                    case AIMessageChunk(content=list() as blocks):
                        for block in blocks:
                            if isinstance(block, dict) and (text := block.get("text")):
                                yield {"event": "token", "data": json.dumps({"text": text})}
                    case ToolMessage(name=name, content=content, tool_call_id=tool_call_id):
                        yield {
                            "event": "tool_result",
                            "data": json.dumps({
                                "name": name,
                                "content": str(content),
                                "id":tool_call_id
                            })
                        }
                    case x:
                        print(f"unhandled messages case {x}")
                # NOTE: no tool_call emission here — handled in `updates`

            case "updates":
                if not ns:  # skip root-graph updates; they replay subgraph output
                    continue
                if isinstance(payload,dict):
                    for node_name, node_output in payload.items():
                        if not isinstance(node_output, dict):
                            continue
                        for m in node_output.get("messages", []):
                            for tc in getattr(m, "tool_calls", None) or []:
                                yield {"event": "tool_call", "data": json.dumps({
                                    "id":tc["id"],
                                    "name": tc["name"],
                                    "args": tc["args"],
                                })}

            case "custom":
                yield {"event": "custom", "data": json.dumps(payload, default=str)}
            case x:
                print(f"unhandled case {x}")


        # "values" intentionally ignored — it's the full state after each step
        # and would duplicate everything else. Re-enable if you want it.
    state = await agent.aget_state(config)
    if state.interrupts:
        for interrupt in state.interrupts:
            interrupt_data = interrupt.value  | {"interrupt_id":interrupt.id}# the dict you passed to interrupt()
            yield {"event": "approval_required", "data": json.dumps(interrupt_data)}
    else:
        yield {"event": "done", "data": "{}"}
    # except Exception as e:
    #     print(e)
    #     yield {"event": "error", "data": json.dumps({"message": "Internal error"})}


class StreamRequest(BaseModel):
    user_message: str
    session_id: str

@app.post("/stream")
async def stream(
    request: Request,
    body: StreamRequest,
    agent: DependsAgent
):
    inputs = MessagesState(messages=[HumanMessage(content=body.user_message)])
    return EventSourceResponse(
        content=_event_gen(request, inputs, body.session_id, agent)
    )


class ApprovalStateResolved(BaseModel):
    tool_call_id:str
    interrupt_id:str
    approved:bool

class ResumeRequest(BaseModel):
    session_id: str
    approvals: dict[str, ApprovalStateResolved]

@app.post("/resume")
async def resume(request: Request, body: ResumeRequest, agent: DependsAgent):
    inputs = Command(resume={
        item.interrupt_id: {"approved": item.approved}
        for item in body.approvals.values()
    })
    return EventSourceResponse(
        content=_event_gen(request, inputs, body.session_id, agent)
    )


class ThreadHistoryRequest(BaseModel):
    session_id: str


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant" | "system" | "tool"
    content: str
    # Optional fields useful for re-rendering tool calls, timestamps, etc.
    name: str | None = None
    tool_call_id: str | None = None
    metadata: dict[str, Any] | None = None


class ThreadHistoryResponse(BaseModel):
    session_id: str
    messages: list[ChatMessage]


@app.post("/thread_history", response_model=ThreadHistoryResponse)
async def thread_history(
    body: ThreadHistoryRequest,
    agent: DependsAgent,
) -> ThreadHistoryResponse:
    """
    Return a snapshot of the conversation history for the given session
    so the client can hydrate its chat log on startup.
    """
    config:RunnableConfig = {"configurable": {"thread_id": body.session_id}}

    # get_state_history returns an iterable of StateSnapshot, newest first.
    # The most recent snapshot holds the full current message list.
    history_iter = agent.aget_state_history(config)
    latest = await anext(aiter(history_iter), None)

    if latest is None:
        return ThreadHistoryResponse(session_id=body.session_id, messages=[])

    raw_messages = latest.values.get("messages", [])

    messages: list[ChatMessage] = []
    for m in raw_messages:
        messages.append(_to_chat_message(m))

    return ThreadHistoryResponse(session_id=body.session_id, messages=messages)


def _to_chat_message(m: Any) -> ChatMessage:
    """Normalize a LangChain/LangGraph message object into our wire format."""
    # LangChain messages expose .type ("human"/"ai"/"system"/"tool") and .content
    role_map = {
        "human": "user",
        "ai": "assistant",
        "system": "system",
        "tool": "tool",
    }
    msg_type = getattr(m, "type", None) or getattr(m, "role", "assistant")
    role = role_map.get(msg_type, msg_type)

    content = getattr(m, "content", "")
    if isinstance(content, list):
        # Some messages have structured content blocks; flatten to text.
        content = "".join(
            block.get("text", "") if isinstance(block, dict) else str(block)
            for block in content
        )

    return ChatMessage(
        role=role,
        content=content,
        name=getattr(m, "name", None),
        tool_call_id=getattr(m, "tool_call_id", None),
        metadata={
            "id": getattr(m, "id", None),
            "tool_calls": getattr(m, "tool_calls", None),
        },
    )