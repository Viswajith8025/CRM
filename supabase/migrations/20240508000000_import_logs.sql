-- Create import_logs table
CREATE TABLE IF NOT EXISTS import_logs (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    module VARCHAR(50) NOT NULL, -- leads, clients, invoices, etc.
    file_name VARCHAR(255),
    rows_total INTEGER DEFAULT 0,
    rows_imported INTEGER DEFAULT 0,
    rows_failed INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'completed', -- completed, partial, failed
    error_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their organization's import logs"
    ON import_logs FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can insert import logs for their organization"
    ON import_logs FOR INSERT
    WITH CHECK (organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));
