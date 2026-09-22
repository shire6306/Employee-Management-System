import { useEffect, useState } from "react";
import { client } from "../api/client";
import { useAuth } from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";

const EMPTY = {
  title: "",
  description: "",
  department: "",
  priority: "medium",
  due_date: "",
};

const STATUS_LABEL = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
};

const PRIORITY_LABEL = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export default function Tasks() {
  const { user, hasPermission } = useAuth();

  const canCreate = hasPermission("add_task");
  const canEdit = hasPermission("edit_task");
  const canDelete = hasPermission("delete_task");
  const canAssign = hasPermission("assign_task");
  const isEmployee = user?.role === "employee";
  const isDepartmentManager = user?.role === "department_manager";
  const isDepartmentUser = isEmployee || isDepartmentManager;

  const [tasks, setTasks] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [search, setSearch] = useState("");
  const [todoFilter, setTodoFilter] = useState("all");

  async function load() {
    setLoading(true);

    try {
      const { data } = await client.get("/tasks/", {
        params: {
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
        },
      });

      setTasks(data.results ?? data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, priorityFilter, user?.role]);

  useEffect(() => {
    if (canCreate) {
      client
        .get("/departments/", {
          params: { page_size: 200, ordering: "name" },
        })
        .then(({ data }) => {
          setDepartments(data.results ?? data);
        });
    }
  }, [canCreate]);

  function openCreate() {
    setForm(EMPTY);
    setError("");
    setOpen(true);
  }

  async function create(e) {
    e.preventDefault();
    setError("");

    try {
      await client.post("/tasks/", {
        ...form,
        due_date: form.due_date || null,
      });

      setOpen(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      setError(
        Object.values(err.response?.data || {})
          .flat()
          .join(" ") || "Could not create task"
      );
    }
  }

  async function setStatus(id, status) {
    try {
      await client.post(`/tasks/${id}/set-status/`, { status });
      load();
    } catch (err) {
      alert(
        err.response?.data?.detail ||
          "Could not update task status."
      );
    }
  }

  const pendingCount = tasks.filter(
    (t) => t.status === "pending"
  ).length;

  const inProgressCount = tasks.filter(
    (t) => t.status === "in_progress"
  ).length;

  const completedCount = tasks.filter(
    (t) => t.status === "completed"
  ).length;

  const normalizedSearch = search.trim().toLowerCase();

  const visibleTasks = tasks.filter((task) => {
    const matchesSearch =
      !normalizedSearch ||
      task.title?.toLowerCase().includes(normalizedSearch) ||
      task.description?.toLowerCase().includes(normalizedSearch) ||
      task.department_name?.toLowerCase().includes(normalizedSearch);

    const matchesTodoFilter =
      todoFilter === "all" ||
      task.status === todoFilter;

    return matchesSearch && matchesTodoFilter;
  });

  function formatDueDate(value) {
    if (!value) return "No due date";

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function nextStatus(task) {
    if (task.status === "completed") {
      return "pending";
    }

    return "completed";
  }

  return (
    <div className="tasks-todo-page">
      <style>{`
        .tasks-todo-page {
          display: flex;
          flex-direction: column;
          gap: 1.2rem;
        }

        .tasks-todo-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .tasks-todo-header h1 {
          margin: 0;
          font-size: 1.65rem;
        }

        .tasks-todo-header p {
          margin: 5px 0 0;
          color: var(--ink-soft);
        }

        .tasks-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: .8rem;
        }

        .tasks-stat-card {
          padding: 1rem 1.1rem;
          border-radius: 16px;
        }

        .tasks-stat-label {
          font-size: 12px;
          color: var(--ink-soft);
          margin-bottom: 6px;
        }

        .tasks-stat-value {
          font-size: 1.45rem;
          font-weight: 800;
        }

        .tasks-toolbar {
          display: grid;
          grid-template-columns: minmax(220px, 1fr) auto auto;
          gap: .7rem;
          align-items: center;
        }

        .tasks-search {
          position: relative;
        }

        .tasks-search span {
          position: absolute;
          left: 13px;
          top: 50%;
          transform: translateY(-50%);
          opacity: .55;
          pointer-events: none;
        }

        .tasks-search input {
          width: 100%;
          padding-left: 38px;
        }

        .tasks-tabs {
          display: flex;
          gap: .5rem;
          flex-wrap: wrap;
          padding-bottom: .1rem;
        }

        .tasks-tab {
          border: 1px solid var(--line, #e5e7eb);
          background: var(--surface, #fff);
          color: var(--ink-soft);
          border-radius: 999px;
          padding: .55rem .9rem;
          cursor: pointer;
          font: inherit;
          font-size: 13px;
          font-weight: 700;
        }

        .tasks-tab.active {
          background: var(--ink, #111827);
          color: white;
          border-color: var(--ink, #111827);
        }

        .tasks-list {
          display: flex;
          flex-direction: column;
          gap: .75rem;
        }

        .todo-task {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: .9rem;
          align-items: start;
          padding: 1rem 1.05rem;
          border: 1px solid var(--line, #e5e7eb);
          border-radius: 16px;
          background: var(--surface, #fff);
          transition: transform .15s ease, box-shadow .15s ease;
        }

        .todo-task:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(15, 23, 42, .06);
        }

        .todo-check {
          width: 24px;
          height: 24px;
          margin-top: 2px;
          border: 2px solid var(--line, #cbd5e1);
          border-radius: 7px;
          background: transparent;
          cursor: pointer;
          display: grid;
          place-items: center;
          font-weight: 900;
          line-height: 1;
        }

        .todo-check.done {
          background: var(--ink, #111827);
          color: white;
          border-color: var(--ink, #111827);
        }

        .todo-main {
          min-width: 0;
        }

        .todo-title-row {
          display: flex;
          gap: .65rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .todo-title {
          font-size: 15px;
          font-weight: 800;
          margin: 0;
        }

        .todo-task.completed .todo-title {
          text-decoration: line-through;
          opacity: .62;
        }

        .todo-description {
          margin: 5px 0 0;
          font-size: 13px;
          color: var(--ink-soft);
          line-height: 1.5;
        }

        .todo-meta {
          display: flex;
          flex-wrap: wrap;
          gap: .55rem 1rem;
          margin-top: .75rem;
          color: var(--ink-soft);
          font-size: 12px;
        }

        .todo-status {
          min-width: 145px;
        }

        .todo-status select {
          width: 100%;
          font-size: 12px;
        }

        .todo-empty {
          padding: 2.5rem 1rem;
          text-align: center;
          color: var(--ink-soft);
        }

        @media (max-width: 900px) {
          .tasks-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .tasks-toolbar {
            grid-template-columns: 1fr 1fr;
          }

          .tasks-search {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 620px) {
          .tasks-stats {
            grid-template-columns: 1fr 1fr;
          }

          .tasks-toolbar {
            grid-template-columns: 1fr;
          }

          .tasks-search {
            grid-column: auto;
          }

          .todo-task {
            grid-template-columns: auto minmax(0, 1fr);
          }

          .todo-status {
            grid-column: 2;
            min-width: 0;
          }
        }
      `}</style>

      <div className="tasks-todo-header">
        <div>
          <h1>
            {isEmployee
              ? "Tasks"
              : isDepartmentManager
                ? "Department Tasks"
                : "Tasks"}
          </h1>

          <p>
            {isEmployee
              ? "View and update tasks assigned to your department."
              : isDepartmentManager
                ? "Track work and progress for your department."
                : "Organize, assign and track department work."}
          </p>
        </div>

        {canCreate && (
          <button
            className="btn btn-primary"
            onClick={openCreate}
          >
            + Add Task
          </button>
        )}
      </div>

      <div className="tasks-stats">
        <TaskStat label="All Tasks" value={tasks.length} />
        <TaskStat label="To Do" value={pendingCount} />
        <TaskStat label="In Progress" value={inProgressCount} />
        <TaskStat label="Completed" value={completedCount} />
      </div>

      <div className="tasks-toolbar">
        <div className="tasks-search">
          <span>⌕</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
        >
          <option value="">All priorities</option>
          {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="tasks-tabs">
        {[
          ["all", `All (${tasks.length})`],
          ["pending", `To Do (${pendingCount})`],
          ["in_progress", `In Progress (${inProgressCount})`],
          ["completed", `Completed (${completedCount})`],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`tasks-tab ${
              todoFilter === key ? "active" : ""
            }`}
            onClick={() => setTodoFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="tasks-list">
        {loading && (
          <div className="card todo-empty">
            Loading tasks...
          </div>
        )}

        {!loading &&
          visibleTasks.map((task) => {
            const completed = task.status === "completed";

            return (
              <div
                className={`todo-task ${
                  completed ? "completed" : ""
                }`}
                key={task.id}
              >
                <button
                  type="button"
                  className={`todo-check ${
                    completed ? "done" : ""
                  }`}
                  onClick={() =>
                    setStatus(task.id, nextStatus(task))
                  }
                  title={
                    completed
                      ? "Move back to To Do"
                      : "Mark as completed"
                  }
                  aria-label={
                    completed
                      ? "Move task back to To Do"
                      : "Mark task as completed"
                  }
                >
                  {completed ? "✓" : ""}
                </button>

                <div className="todo-main">
                  <div className="todo-title-row">
                    <h3 className="todo-title">
                      {task.title}
                    </h3>

                    <span
                      className={`badge priority-${task.priority}`}
                    >
                      {PRIORITY_LABEL[task.priority] ||
                        task.priority}
                    </span>

                    {task.status === "in_progress" && (
                      <span className="badge">
                        In Progress
                      </span>
                    )}
                  </div>

                  <p className="todo-description">
                    {task.description || "No description"}
                  </p>

                  <div className="todo-meta">
                    {!isDepartmentUser && (
                      <span>
                        🏢 {task.department_name || "No department"}
                      </span>
                    )}

                    <span>
                      📅 {formatDueDate(task.due_date)}
                    </span>

                    {task.created_by_name && (
                      <span>
                        👤 {task.created_by_name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="todo-status">
                  <select
                    value={task.status}
                    onChange={(e) =>
                      setStatus(task.id, e.target.value)
                    }
                  >
                    {Object.entries(STATUS_LABEL).map(
                      ([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>
            );
          })}

        {!loading && visibleTasks.length === 0 && (
          <div className="card todo-empty">
            {search
              ? "No tasks match your search."
              : isEmployee
                ? "No tasks are currently assigned to your department."
                : "No tasks found."}
          </div>
        )}
      </div>

      {open && canCreate && (
        <Modal
          title="New department task"
          onClose={() => setOpen(false)}
          width={540}
        >
          <form
            onSubmit={create}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div className="field">
              <label>Title</label>

              <input
                required
                autoFocus
                value={form.title}
                onChange={(e) =>
                  setForm({
                    ...form,
                    title: e.target.value,
                  })
                }
              />
            </div>

            <div className="field">
              <label>Description</label>

              <textarea
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({
                    ...form,
                    description: e.target.value,
                  })
                }
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
              }}
            >
              <div
                className="field"
                style={{ flex: 1 }}
              >
                <label>Department</label>

                <select
                  required
                  value={form.department}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      department: e.target.value,
                    })
                  }
                >
                  <option value="">
                    Select…
                  </option>

                  {departments.map((d) => (
                    <option
                      key={d.id}
                      value={d.id}
                    >
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div
                className="field"
                style={{ flex: 1 }}
              >
                <label>Priority</label>

                <select
                  value={form.priority}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      priority: e.target.value,
                    })
                  }
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label>Due date</label>

              <input
                type="date"
                value={form.due_date}
                onChange={(e) =>
                  setForm({
                    ...form,
                    due_date: e.target.value,
                  })
                }
              />
            </div>

            {error && (
              <div style={{ color: "var(--rust)" }}>
                {error}
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>

              <button
                className="btn btn-primary"
                type="submit"
              >
                Create task
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function TaskStat({ label, value }) {
  return (
    <div className="card tasks-stat-card">
      <div className="tasks-stat-label">
        {label}
      </div>

      <div className="tasks-stat-value">
        {value}
      </div>
    </div>
  );
}
