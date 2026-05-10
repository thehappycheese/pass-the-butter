
from langchain_core.language_models import BaseChatModel
from langchain.agents import create_agent
from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.graph.state import CompiledStateGraph
from langgraph.checkpoint.memory import InMemorySaver

from .tools.toy_business import (
    find_employee,
    get_budget,
    get_department,
)

BuildAgentResult = CompiledStateGraph[MessagesState, None, MessagesState, MessagesState]

# TODO place this on the API of the function below.
checkpointer = InMemorySaver()

def build_agent(llm:BaseChatModel) -> BuildAgentResult:
    agent = create_agent(
        model=llm,
        tools=[
            find_employee,
            get_budget,
            get_department,
        ],
        name="agent",
    )

    graph = StateGraph(MessagesState)
    graph.add_node(agent)
    graph.add_edge(START, "agent")
    graph.add_edge("agent", END)
    graph = graph.compile(checkpointer=checkpointer)

    return graph
