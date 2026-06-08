INSERT INTO module_registry (id, key, name, icon, route, category, sort_order, permission, is_enabled)
VALUES (
  gen_random_uuid(),
  'attendance',
  'Attendance Device',
  'Clock',
  '/attendance',
  'top',
  50,
  'module.attendance',
  true
) ON CONFLICT (key) DO NOTHING;
