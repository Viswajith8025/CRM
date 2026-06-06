const fs = require('fs');
const path = require('path');

// 1. MyAssignedTasksWidget.tsx
let p = 'src/modules/dashboard/components/widgets/MyAssignedTasksWidget.tsx';
let c = fs.readFileSync(p, 'utf8');
c = c.replace(/import \{ useTimeStore \} from "@\/modules\/time-tracking\/timeStore"/, '');
c = c.replace(/const \{ activeTimer, startTimer, stopTimer \} = useTimeStore\(\)/, '');
// Remove timer UI (e.g. Play/Pause buttons) from MyAssignedTasksWidget
// Let's use a regex to remove the specific Timer button or just replace it with empty if found.
// Look for Button with onClick={() => activeTimer?.task_id === task.id ? stopTimer() : startTimer(...)}
c = c.replace(/<Button[^>]*onClick=\{\(\) => activeTimer\?.task_id === task\.id \? stopTimer\(\) \: startTimer[^\}]*\}[^>]*>[\s\S]*?<\/Button>/g, '');
// Also look for activeTimer condition blocks
c = c.replace(/\{activeTimer\?.task_id === task\.id \? \([\s\S]*?\) \: \([\s\S]*?\)\}/g, '');
fs.writeFileSync(p, c);

// 2. ModulesTab.tsx
p = 'src/modules/projects/components/ModulesTab.tsx';
c = fs.readFileSync(p, 'utf8');
c = c.replace(/import \{ useTimeStore \} from "@\/modules\/time-tracking\/timeStore"/, '');
c = c.replace(/const \{ activeTimer, startTimer, stopTimer \} = useTimeStore\(\)/, '');
c = c.replace(/<Button[^>]*onClick=\{\(\) => activeTimer\?.task_id === task\.id \? stopTimer\(\) \: startTimer[^\}]*\}[^>]*>[\s\S]*?<\/Button>/g, '');
c = c.replace(/\{activeTimer\?.task_id === task\.id \? \([\s\S]*?\) \: \([\s\S]*?\)\}/g, '');
fs.writeFileSync(p, c);

// 3. InvoiceForm.tsx
p = 'src/modules/billing/components/InvoiceForm.tsx';
c = fs.readFileSync(p, 'utf8');
// remove time_logs fetch
c = c.replace(/const \{ data: logsData \} = await supabase[\s\S]*?\.eq\('project_id', projectId\)[\s\S]*?if \(logsData\) \{[\s\S]*?newItems\.push\([\s\S]*?\)[\s\S]*?\}/, '');
fs.writeFileSync(p, c);

console.log('Cleaned up time_logs references');
