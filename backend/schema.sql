-- LearnLynk Tech Test - Task 1: Schema
-- Fill in the definitions for leads, applications, tasks as per README.

create extension if not exists "pgcrypto";

-- Leads table
CREATE TABLE IF NOT EXISTS public.leads (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid        NOT NULL,
    owner_id    uuid        NOT NULL,
    name        text        NOT NULL,
    email       text        NULL,
    phone       text        NULL,

    -- Stages of Lead (assumed)
    stage       text        NOT NULL
                CHECK (stage IN (
                    'new',
                    'contacted',
                    'in_progress',
                    'rejected',
                    'converted'
                )),

    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- adding unique constraint per tenant to avoud duplication
ALTER TABLE public.leads
    ADD CONSTRAINT leads_unique_email_per_tenant
    UNIQUE (tenant_id, email)
    DEFERRABLE INITIALLY DEFERRED;

-- TODO: add useful indexes for leads:
-- - by tenant_id, owner_id, stage, created_at

CREATE INDEX IF NOT EXISTS idx_leads_tenant_owner_stage_created_at
    ON public.leads (tenant_id, owner_id, stage, created_at DESC);


-- Applications table

CREATE TABLE IF NOT EXISTS public.applications (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid        NOT NULL,

    -- Forign Key refered to public.lead
    lead_id         uuid        NOT NULL
                    REFERENCES public.leads(id)
                    ON UPDATE CASCADE
                    ON DELETE CASCADE,

    position_title  text        NOT NULL,
    status          text        NOT NULL
                    CHECK (status IN (
                        'draft',
                        'submitted',
                        'rejected',
                        'accepted'
                    )),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- TODO: add useful indexes for applications:
-- - by tenant_id, lead_id, stage
CREATE INDEX IF NOT EXISTS idx_applications_tenant_lead
    ON public.applications (tenant_id, lead_id, stage);

-- Tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid        NOT NULL,

    -- related_id references applications(id)
    related_id  uuid        NOT NULL
                REFERENCES public.applications(id)
                ON UPDATE CASCADE
                ON DELETE CASCADE,

    -- Task type: check constraint for type in ('call','email','review')
    type        text        NOT NULL
                CHECK (type IN ('call', 'email', 'review')),

    title       text        NOT NULL,
    description text        NULL,

    status      text        NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'completed', 'cancelled')),

    
    due_at      timestamptz NOT NULL,

    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),

    -- Constraint - due_at >= created_at
    CONSTRAINT tasks_due_at_after_created_at
        CHECK (due_at >= created_at)
);

-- TODO:
-- - add check constraint for type in ('call','email','review')
      -- | -> already made changes in create table itself 
-- - add constraint that due_at >= created_at
--     | -> already made changes in create table itself 

-- - add indexes for tasks due today by tenant_id, due_at, status
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_due_at
    ON public.tasks (tenant_id, due_at);
