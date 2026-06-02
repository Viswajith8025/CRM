-- ==============================================================================
-- FIX HIGH-1: ATOMIC PROJECT MEMBER UPDATES
-- ==============================================================================
-- This RPC replaces the non-atomic delete-then-insert frontend logic
-- for project members, ensuring that network failures do not leave 
-- projects orphaned from their team.

CREATE OR REPLACE FUNCTION public.update_project_members(
    p_project_id UUID,
    p_org_id UUID,
    p_lead_id UUID,
    p_member_ids UUID[]
) RETURNS void AS $$
DECLARE
    v_member_id UUID;
BEGIN
    -- 1. Remove all existing members for this project
    DELETE FROM public.project_members
    WHERE project_id = p_project_id AND organization_id = p_org_id;

    -- 2. Insert Lead if provided
    IF p_lead_id IS NOT NULL THEN
        INSERT INTO public.project_members (project_id, user_id, role, organization_id)
        VALUES (p_project_id, p_lead_id, 'lead', p_org_id);
    END IF;

    -- 3. Insert other members
    IF p_member_ids IS NOT NULL THEN
        FOREACH v_member_id IN ARRAY p_member_ids
        LOOP
            -- Avoid inserting the lead twice if they were passed in member_ids
            IF v_member_id != p_lead_id OR p_lead_id IS NULL THEN
                INSERT INTO public.project_members (project_id, user_id, role, organization_id)
                VALUES (p_project_id, v_member_id, 'member', p_org_id);
            END IF;
        END LOOP;
    END IF;
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
