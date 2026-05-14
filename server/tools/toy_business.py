from typing import Annotated

from langgraph.types import interrupt
from langchain_core.tools import tool, InjectedToolCallId
import asyncio

# ---- Toy data (hardcoded) -----------------------------------------------

_EMPLOYEES = {
    "alice":   {"employee_id": "E001", "department_id": "D-ENG"},
    "bob":     {"employee_id": "E002", "department_id": "D-ENG"},
    "carol":   {"employee_id": "E003", "department_id": "D-SAL"},
    "dana":    {"employee_id": "E004", "department_id": "D-SAL"},
    "eric":    {"employee_id": "E005", "department_id": "D-MKT"},
    "fiona":   {"employee_id": "E006", "department_id": "D-MKT"},
    "george":  {"employee_id": "E007", "department_id": "D-OPS"},
    "hannah":  {"employee_id": "E008", "department_id": "D-OPS"},
}

_DEPARTMENTS = {
    "D-ENG": {"name": "Engineering",  "budget_id": "B-2026-01", "head": "Bob"},
    "D-SAL": {"name": "Sales",        "budget_id": "B-2026-02", "head": "Carol"},
    "D-MKT": {"name": "Marketing",    "budget_id": "B-2026-03", "head": "Fiona"},
    "D-OPS": {"name": "Operations",   "budget_id": "B-2026-04", "head": "George"},
}

_BUDGETS = {
    "B-2026-01": {"allocated": 2_400_000, "spent": 1_650_000, "remaining":   750_000, "fiscal_year": 2026},
    "B-2026-02": {"allocated": 1_800_000, "spent":   900_000, "remaining":   900_000, "fiscal_year": 2026},
    "B-2026-03": {"allocated": 1_200_000, "spent":   400_000, "remaining":   800_000, "fiscal_year": 2026},
    "B-2026-04": {"allocated":   950_000, "spent":   720_000, "remaining":   230_000, "fiscal_year": 2026},
}

# ---- Tools --------------------------------------------------------------


@tool
async def list_all_employees() -> list[str]:
    """Lists all employees"""
    await asyncio.sleep(0.3)
    return list(_EMPLOYEES.keys())

@tool
async def find_employee(name: str) -> dict:
    """Look up an employee by first name (case-insensitive).
    Returns the employee_id and the department_id they belong to."""
    await asyncio.sleep(0.3)
    record = _EMPLOYEES.get(name.strip().lower())
    if not record:
        return {"error": f"No employee found with name '{name}'."}
    return record

@tool
async def get_department(department_id: str) -> dict:
    """
    Look up a department by its department_id (e.g. 'D-ENG').
    Returns the department's name, the id of its budget, and the name of its head.
    """
    await asyncio.sleep(0.3)
    record = _DEPARTMENTS.get(department_id.strip().upper())
    if not record:
        return {"error": f"No department found with id '{department_id}'."}
    return record

@tool
async def get_budget(budget_id: str) -> dict:
    """Look up a budget by its budget_id (e.g. 'B-2026-01').
    Returns allocated, spent, and remaining amounts in USD, plus fiscal_year."""
    await asyncio.sleep(0.3)
    record = _BUDGETS.get(budget_id.strip().upper())
    if not record:
        return {"error": f"No budget found with id '{budget_id}'."}
    return record

@tool
async def update_budget(
    budget_id:str,
    new_allocated_amount:int,
    tool_call_id: Annotated[str, InjectedToolCallId]
)->dict:
    """set the specified budget's allocated amount field. returns the updated record if successful, or an error otherwise."""
    decision = interrupt({
        "tool": "update_budget",
        "args": {"budget_id": budget_id, "new_allocated_amount": new_allocated_amount},
        "tool_call_id":tool_call_id
    })
    if not decision.get("approved"):
        return {"error": "Update rejected by user.", "reason": decision.get("reason")}
    await asyncio.sleep(0.3)
    record = _BUDGETS.get(budget_id.strip().upper())
    if not record:
        return {"error": f"No budget found with id '{budget_id}'."}
    record["allocated"] = new_allocated_amount
    return record


