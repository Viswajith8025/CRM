const fs = require('fs');
const path = require('path');

const dir = 'src/modules/reports/pages';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

files.forEach(f => {
  const filePath = path.join(dir, f);
  let content = fs.readFileSync(filePath, 'utf8');
  
  content = content.replace(/searchFields:\s*\[([^\]]+)\]/g, (match, p1) => {
    // Extract and clean fields
    const fields = p1.split(',').map(s => s.trim().replace(/['"]/g, ''));
    
    // Filter out invalid columns for ilike (enums, uuids, numbers)
    const validFields = fields.filter(f => !['status', 'priority', 'amount', 'category', 'leave_type'].includes(f) && f !== '');
    
    return 'searchFields: [' + validFields.map(f => `'${f}'`).join(', ') + ']';
  });
  
  fs.writeFileSync(filePath, content);
  console.log('Updated ' + f);
});
