-- LearnLynk Tech Test - Task 2: RLS Policies on leads

alter table public.leads enable row level security;

-- Example helper: assume JWT has tenant_id, user_id, role.
-- You can use: current_setting('request.jwt.claims', true)::jsonb

-- TODO: write a policy so:
-- - counselors see leads where they are owner_id OR in one of their teams
-- - admins can see all leads of their tenant


-- Example skeleton for SELECT (replace with your own logic):

create policy "leads_select_policy"
on public.leads
for select
USING (
    -- Case 1 -> admins can see everything
    (auth.jwt() ->> 'role') = 'admin'

    OR

    -- Case 2 -> counselors can see only allowed leads
    (
        (auth.jwt() ->> 'role') = 'counselor'
        AND
        (
            -- lead directly owned by counselor
            owner_id = auth.uid()

            OR

            -- lead owned by someone in the counselor team
            EXISTS (
                SELECT 1
                FROM public.user_teams AS ut_counselor
                JOIN public.user_teams AS ut_owner
                  ON ut_counselor.team_id = ut_owner.team_id
                WHERE ut_counselor.user_id = auth.uid()
                  AND ut_owner.user_id = public.leads.owner_id
            )
        )
    )
);

-- TODO: add INSERT policy that:
-- - allows counselors/admins to insert leads for their tenant
-- - ensures tenant_id is correctly set/validated

CREATE POLICY "leads_insert_policy"
ON public.leads
FOR INSERT
WITH CHECK (
    -- admims can insert any lead
    (auth.jwt() ->> 'role') = 'admin'

    OR

    -- counsler can only insert lead they own
    (
        (auth.jwt() ->> 'role') = 'counselor'
        AND owner_id = auth.uid()
    )
);