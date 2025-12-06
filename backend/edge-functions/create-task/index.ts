// @ts-nocheck

// LearnLynk Tech Test - Task 3: Edge Function create-task

// Deno + Supabase Edge Functions style
// Docs reference: https://supabase.com/docs/guides/functions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});


type AllowedTaskType = "call" | "email" | "review";


interface CreateTaskPayload {
  application_id?: string;
  task_type?: string;
  due_at?: string;
  title?: string;
  description?: string;
}

const VALID_TYPES = ["call", "email", "review"];

serve(async (req: Request): Promise<Response> => {
  // Only allow POST
  if (req.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed" },
      405
    );
  }

  let body: CreateTaskPayload;

  // Parse JSON body
  try {
    body = await req.json();
  } catch (_err) {
    return jsonResponse(
      { error: "Invalid JSON body" },
      400
    );
  }

  const { application_id, task_type, due_at, title, description } = body;



  if (!application_id || typeof application_id !== "string") {
    return jsonResponse(
      { error: "application_id is required and must be a string" },
      400
    );
  }

  if (!task_type || typeof task_type !== "string") {
    return jsonResponse(
      { error: "task_type is required and must be a string" },
      400
    );
  }

  const allowedTypes: AllowedTaskType[] = ["call", "email", "review"];

  if (!allowedTypes.includes(task_type as AllowedTaskType)) {
    return jsonResponse(
      {
        error: "Invalid task_type. Must be one of: call, email, review",
      },
      400
    );
  }

  if (!due_at || typeof due_at !== "string") {
    return jsonResponse(
      { error: "due_at is required and must be an ISO timestamp string" },
      400
    );
  }

  const dueDate = new Date(due_at);
  const now = new Date();

  if (isNaN(dueDate.getTime())) {
    return jsonResponse(
      { error: "due_at must be a valid ISO date string" },
      400
    );
  }


  if (dueDate <= now) {
    return jsonResponse(
      { error: "due_at must be in the future" },
      400
    );
  }

 
  const safeTitle = title && title.trim().length > 0
    ? title.trim()
    : `Follow-up ${task_type}`;

  const {
    data: application,
    error: appError,
  } = await supabase
    .from("applications")
    .select("id, tenant_id")
    .eq("id", application_id)
    .single();

  if (appError) {
    console.error("Error fetching application:", appError);
    return jsonResponse(
      { error: "Application not found or DB error" },
      404
    );
  }



  const { data: task, error: insertError } = await supabase
    .from("tasks")
    .insert({
      tenant_id: application.tenant_id,
      related_id: application.id,
      type: task_type,
      title: safeTitle,
      description: description ?? null,
      due_at, 
    })
    .select(
      "id, tenant_id, related_id, type, title, description, status, due_at, created_at"
    )
    .single();

  if (insertError || !task) {
    console.error("Error inserting task:", insertError);
    return jsonResponse(
      { error: "Failed to create task" },
      500
    );
  }


  try {

    const channel = supabase.channel("tasks-broadcast");


    await channel.subscribe((status) => {
      console.log("Realtime channel status:", status);
    });


    await channel.send({
      type: "broadcast",
      event: "task.created",
      payload: {
        task_id: task.id,
        application_id: task.related_id,
        type: task.type,
        due_at: task.due_at,
        status: task.status,
      },
    });


    await channel.unsubscribe();
  } catch (err) {

    console.error("Error broadcasting Realtime event:", err);
  }


  return jsonResponse(
    {
      success: true,
      task_id: task.id,
    },
    200
  );
});


// helper function to standardize JSON responses
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*", 
    },
  });
}