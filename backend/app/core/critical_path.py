"""
Critical path computation for a task graph.

Computes:
- The longest path through the graph (the critical path)
- The total duration if the critical path is followed
- The earliest start day for each task (forward pass)
- The latest start day for each task (backward pass)
- Whether the graph has a cycle

Uses topological sort + dynamic programming. O(V + E) time.
"""
from uuid import UUID

from app.schemas.plan import Task, TaskGraph


class TaskGraphError(Exception):
    """Raised when the task graph is malformed."""


def _build_adjacency(
    tasks: list[Task],
) -> tuple[dict[UUID, list[UUID]], dict[UUID, int]]:
    """
    Returns (adjacency, in_degree).

    adjacency[t.id] = list of task IDs that depend on t
    in_degree[t.id]  = number of tasks t depends on
    """
    task_ids = {t.id for t in tasks}
    adjacency: dict[UUID, list[UUID]] = {t.id: [] for t in tasks}
    in_degree: dict[UUID, int] = {t.id: 0 for t in tasks}

    for t in tasks:
        for dep_id in t.dependencies:
            if dep_id not in task_ids:
                raise TaskGraphError(
                    f"Task '{t.name}' depends on unknown task {dep_id}"
                )
            adjacency[dep_id].append(t.id)
            in_degree[t.id] += 1

    return adjacency, in_degree


def _topological_sort(
    tasks: list[Task],
    adjacency: dict[UUID, list[UUID]],
    in_degree: dict[UUID, int],
) -> list[UUID]:
    from collections import deque

    queue = deque([t.id for t in tasks if in_degree[t.id] == 0])
    order: list[UUID] = []

    while queue:
        node = queue.popleft()
        order.append(node)
        for neighbor in adjacency[node]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    if len(order) != len(tasks):
        raise TaskGraphError("Task graph contains a cycle")

    return order


def compute_critical_path(graph: TaskGraph) -> tuple[list[UUID], int]:
    """
    Returns (path, total_days) for the longest dependency chain.
    """
    if not graph.tasks:
        return [], 0

    tasks_by_id = {t.id: t for t in graph.tasks}
    adjacency, in_degree = _build_adjacency(graph.tasks)
    order = _topological_sort(graph.tasks, adjacency, in_degree)

    longest_to: dict[UUID, tuple[int, UUID | None]] = {}

    for task_id in order:
        task = tasks_by_id[task_id]
        if not task.dependencies:
            longest_to[task_id] = (task.estimate_days, None)
        else:
            best_days = 0
            best_prev: UUID | None = None
            for dep_id in task.dependencies:
                dep_days, _ = longest_to[dep_id]
                if dep_days > best_days:
                    best_days = dep_days
                    best_prev = dep_id
            longest_to[task_id] = (best_days + task.estimate_days, best_prev)

    terminal_id = max(longest_to.keys(), key=lambda k: longest_to[k][0])
    total_days = longest_to[terminal_id][0]

    path: list[UUID] = []
    current: UUID | None = terminal_id
    while current is not None:
        path.append(current)
        _, current = longest_to[current]
    path.reverse()

    return path, total_days


def compute_schedule(
    graph: TaskGraph,
) -> tuple[
    dict[UUID, int],  # earliest start day (0-indexed from project start)
    dict[UUID, int],  # latest start day
    int,              # total project duration
]:
    """
    Forward pass for earliest starts, backward pass for latest starts.

    Both are relative to day 0 = project start. Durations are counted
    in days. A task's "end day" is earliest_start + estimate.
    """
    if not graph.tasks:
        return {}, {}, 0

    tasks_by_id = {t.id: t for t in graph.tasks}
    adjacency, in_degree = _build_adjacency(graph.tasks)
    order = _topological_sort(graph.tasks, adjacency, in_degree)

    # Forward pass
    earliest: dict[UUID, int] = {}
    for task_id in order:
        task = tasks_by_id[task_id]
        if not task.dependencies:
            earliest[task_id] = 0
        else:
            earliest[task_id] = max(
                earliest[dep_id] + tasks_by_id[dep_id].estimate_days
                for dep_id in task.dependencies
            )

    total_duration = max(
        earliest[t.id] + t.estimate_days for t in graph.tasks
    )

    # Backward pass — process in reverse topological order
    latest: dict[UUID, int] = {}
    for task_id in reversed(order):
        task = tasks_by_id[task_id]
        successors = adjacency[task_id]
        if not successors:
            latest[task_id] = total_duration - task.estimate_days
        else:
            latest[task_id] = min(
                latest[succ_id] - task.estimate_days for succ_id in successors
            )

    return earliest, latest, total_duration


def has_cycle(graph: TaskGraph) -> bool:
    """Returns True if the graph contains a cycle."""
    try:
        _, in_degree = _build_adjacency(graph.tasks)
        _topological_sort(graph.tasks, _build_adjacency(graph.tasks)[0], in_degree)
        return False
    except TaskGraphError:
        return True
