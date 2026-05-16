
import os

from langchain_anthropic import ChatAnthropic
from langchain.agents import create_agent
from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.graph.state import CompiledStateGraph
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from pydantic import SecretStr

from .tools.dummy_counter import increment_dummy_counter

from .tools.toy_business import (
    find_employee,
    get_budget,
    get_department,
    list_all_employees,
    update_budget,
)

BuildAgentResult = CompiledStateGraph[MessagesState, None, MessagesState, MessagesState]

def build_agent(checkpointer:AsyncPostgresSaver) -> BuildAgentResult:
    
    llm = ChatAnthropic(
        model_name="claude-opus-4-5",
        api_key=SecretStr(os.environ["ANTHROPIC_API_KEY"]),
        timeout=60*2,
        stop=None,
        streaming=True,
    )

    agent = create_agent(
        model=llm,
        tools=[
            find_employee,
            get_budget,
            get_department,
            update_budget,
            list_all_employees,
            increment_dummy_counter
        ],
        name="agent",
        system_prompt="you are a helpful assistant. You respond in simple plaintext, not markdown. You keep your responses short but complete with brief explanations when tools were used.",
    )

    graph = StateGraph(MessagesState)
    graph.add_node(agent)
    graph.add_edge(START, "agent")
    graph.add_edge("agent", END)
    graph = graph.compile(checkpointer=checkpointer)

    return graph
