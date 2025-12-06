// pages/dashboard/today.tsx

import React, { useMemo } from "react";
import type { CSSProperties } from "react";
import type { NextPage } from "next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient, SupabaseClient } from "@supabase/supabase-js";


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);


type TaskStatus = "open" | "completed" | "cancelled";

interface Task {
  id: string;
  tenant_id: string;
  related_id: string; // application_id
  type: "call" | "email" | "review";
  title: string;
  description: string | null;
  status: TaskStatus;
  due_at: string; // ISO string
  created_at: string;
}

function getTodayRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}


async function fetchTasksDueToday(): Promise<Task[]> {
  const { start, end } = getTodayRange();

  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, tenant_id, related_id, type, title, description, status, due_at, created_at"
    )
    .gte("due_at", start)
    .lt("due_at", end)
    .order("due_at", { ascending: true });

  if (error) {
    console.error("[fetchTasksDueToday] Error:", error);
    throw new Error(error.message);
  }

  return (data ?? []) as Task[];
}


async function markTaskComplete(taskId: string): Promise<void> {
  const { error } = await supabase
    .from("tasks")
    .update({ status: "completed" })
    .eq("id", taskId);

  if (error) {
    console.error("[markTaskComplete] Error:", error);
    throw new Error(error.message);
  }
}


const TodayTasksPage: NextPage = () => {
  const queryClient = useQueryClient();


  const {
    data: tasks,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Task[], Error>({
    queryKey: ["tasks", "today"],
    queryFn: fetchTasksDueToday,
  });


  const markCompleteMutation = useMutation<void, Error, string>({
    mutationFn: (taskId: string) => markTaskComplete(taskId),
    onSuccess: async () => {
      
      await queryClient.invalidateQueries({ queryKey: ["tasks", "today"] });
    },
  });

  const hasTasks = useMemo(() => (tasks?.length ?? 0) > 0, [tasks]);

  const handleMarkComplete = (taskId: string) => {
    markCompleteMutation.mutate(taskId);
  };

  return (
    <div style={{ padding: "1.5rem" }}>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 600, marginBottom: "0.5rem" }}>
        Tasks Due Today
      </h1>
      <p style={{ color: "#555", marginBottom: "1rem" }}>
        View and complete all tasks scheduled for today.
      </p>

      {/* Loading state */}
      {isLoading && (
        <div style={{ marginTop: "1rem" }}>
          <p>Loading tasks...</p>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div
          style={{
            marginTop: "1rem",
            padding: "0.75rem 1rem",
            borderRadius: "0.5rem",
            backgroundColor: "#ffe5e5",
            color: "#b00020",
          }}
        >
          <strong>Failed to load tasks:</strong>{" "}
          <span>{error?.message ?? "Unknown error"}</span>
          <button
            onClick={() => refetch()}
            style={{
              marginLeft: "1rem",
              padding: "0.3rem 0.7rem",
              borderRadius: "0.4rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* No tasks */}
      {!isLoading && !isError && !hasTasks && (
        <div style={{ marginTop: "1rem" }}>
          <p>No tasks due today 🎉</p>
        </div>
      )}

      {/* Tasks table */}
      {hasTasks && (
        <div style={{ marginTop: "1.5rem", overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: "640px",
            }}
          >
            <thead>
              <tr>
                <th style={thStyle}>Title</th>
                <th style={thStyle}>Application ID</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Due At</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks!.map((task) => {
                const isCompleting =
                  markCompleteMutation.isPending &&
                  markCompleteMutation.variables === task.id;

                return (
                  <tr key={task.id}>
                    <td style={tdStyle}>{task.title}</td>
                    <td style={tdStyle}>{task.related_id}</td>
                    <td style={tdStyle}>{task.type}</td>
                    <td style={tdStyle}>
                      {new Date(task.due_at).toLocaleString()}
                    </td>
                    <td style={tdStyle}>{task.status}</td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => handleMarkComplete(task.id)}
                        disabled={task.status === "completed" || isCompleting}
                        style={{
                          padding: "0.35rem 0.75rem",
                          borderRadius: "0.4rem",
                          border: "none",
                          cursor:
                            task.status === "completed" || isCompleting
                              ? "not-allowed"
                              : "pointer",
                          opacity:
                            task.status === "completed" || isCompleting
                              ? 0.6
                              : 1,
                        }}
                      >
                        {task.status === "completed"
                          ? "Completed"
                          : isCompleting
                          ? "Marking..."
                          : "Mark Complete"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Mutation error */}
          {markCompleteMutation.isError && (
            <p
              style={{
                marginTop: "0.75rem",
                color: "#b00020",
              }}
            >
              Failed to update task: {markCompleteMutation.error?.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
};


const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.5rem 0.75rem",
  borderBottom: "1px solid #ddd",
  backgroundColor: "#f9fafb",
  fontWeight: 600,
  fontSize: "0.9rem",
};

const tdStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  borderBottom: "1px solid #eee",
  fontSize: "0.9rem",
};

export default TodayTasksPage;


// const thStyle: CSSProperties = { ... };
// const tdStyle: CSSProperties = { ... };
