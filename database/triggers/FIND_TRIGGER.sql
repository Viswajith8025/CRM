-- Diagnostic script to find the trigger name for the protect_sensitive_profile_fields function
SELECT 
    trigger_name, 
    event_manipulation, 
    event_object_table, 
    action_statement, 
    status 
FROM information_schema.triggers 
WHERE event_object_table = 'profiles';
