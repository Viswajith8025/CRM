-- ==============================================================================
-- INTERNAL CHAT & COMMENT MENTIONS SYSTEM
-- Threaded replies, Mentions, and Notifications
-- ==============================================================================

-- 1. CREATE GENERIC COMMENTS TABLE
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL DEFAULT public.get_my_org_id(),
  content TEXT NOT NULL,
  entity_id UUID NOT NULL, -- task_id or project_id or invoice_id
  entity_type VARCHAR(20) NOT NULL, -- 'task', 'project', 'invoice'
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  mentions JSONB DEFAULT '[]', -- Array of {id: UUID, name: string}
  attachment_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ENABLE RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments_select" ON comments;
CREATE POLICY "comments_select" ON comments FOR SELECT TO authenticated 
  USING (organization_id = public.get_my_org_id());

DROP POLICY IF EXISTS "comments_insert" ON comments;
CREATE POLICY "comments_insert" ON comments FOR INSERT TO authenticated 
  WITH CHECK (organization_id = public.get_my_org_id() AND user_id = auth.uid());

DROP POLICY IF EXISTS "comments_delete" ON comments;
CREATE POLICY "comments_delete" ON comments FOR DELETE TO authenticated 
  USING (organization_id = public.get_my_org_id() AND user_id = auth.uid());

-- 3. NOTIFICATION TRIGGER FOR MENTIONS
CREATE OR REPLACE FUNCTION public.notify_comment_mentions()
RETURNS TRIGGER AS $$
DECLARE
  mention_record JSONB;
  mention_user_id UUID;
  comment_author_name TEXT;
BEGIN
  -- Get author name
  SELECT full_name INTO comment_author_name FROM profiles WHERE id = NEW.user_id;

  -- Loop through mentions array
  IF NEW.mentions IS NOT NULL AND jsonb_array_length(NEW.mentions) > 0 THEN
    FOR mention_record IN SELECT * FROM jsonb_array_elements(NEW.mentions) LOOP
      mention_user_id := (mention_record->>'id')::UUID;
      
      -- Don't notify yourself
      IF mention_user_id != NEW.user_id THEN
        INSERT INTO notifications (
          user_id,
          organization_id,
          type,
          title,
          message,
          link,
          created_at
        ) VALUES (
          mention_user_id,
          NEW.organization_id,
          'mention',
          'New @mention',
          comment_author_name || ' mentioned you in a ' || NEW.entity_type || ' comment.',
          '/' || NEW.entity_type || 's/' || NEW.entity_id,
          NOW()
        );
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_comment_mention ON comments;
CREATE TRIGGER on_comment_mention
  AFTER INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_comment_mentions();

-- 4. NOTIFICATION TRIGGER FOR REPLIES
CREATE OR REPLACE FUNCTION public.notify_comment_replies()
RETURNS TRIGGER AS $$
DECLARE
  parent_user_id UUID;
  comment_author_name TEXT;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    -- Get parent comment author
    SELECT user_id INTO parent_user_id FROM comments WHERE id = NEW.parent_id;
    SELECT full_name INTO comment_author_name FROM profiles WHERE id = NEW.user_id;

    -- Don't notify if replying to own comment or if already mentioned
    IF parent_user_id != NEW.user_id THEN
      INSERT INTO notifications (
        user_id,
        organization_id,
        type,
        title,
        message,
        link,
        created_at
      ) VALUES (
        parent_user_id,
        NEW.organization_id,
        'reply',
        'New Reply',
        comment_author_name || ' replied to your comment.',
        '/' || NEW.entity_type || 's/' || NEW.entity_id,
        NOW()
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_comment_reply ON comments;
CREATE TRIGGER on_comment_reply
  AFTER INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_comment_replies();
