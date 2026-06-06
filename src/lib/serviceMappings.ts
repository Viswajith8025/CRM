export const SERVICE_DEPARTMENT_MAPPING: Record<string, string> = {
  // Web Developing Department
  'webdevelopment': 'web developing department',
  'software development': 'web developing department',
  'web development': 'web developing department', // Alternative spelling

  // Content Writing
  'content writing': 'content writing',

  // Digital Marketing
  'digital marketing': 'digital marketing',
  'seo': 'digital marketing',

  // Videography
  'vediography': 'vediography',
  'videography': 'vediography', // Fixed spelling alternative
  'shoot': 'vediography',

  // Graphic Designing
  'design': 'graphic designing',
  'branding': 'graphic designing',
  'graphic design': 'graphic designing'
};

// All available standardized services
export const AVAILABLE_SERVICES = [
  'Web Development',
  'Software Development',
  'Content Writing',
  'Digital Marketing',
  'SEO',
  'Videography',
  'Shoot',
  'Design',
  'Branding'
];

/**
 * Returns the mapped department name for a given service string.
 * It normalizes the input to lower case and removes spaces.
 */
export function getDepartmentForService(serviceStr: string | null | undefined): string {
  if (!serviceStr) return 'General';
  
  const normalized = serviceStr.toLowerCase().trim();
  
  // Try exact match first
  if (SERVICE_DEPARTMENT_MAPPING[normalized]) {
    return SERVICE_DEPARTMENT_MAPPING[normalized];
  }
  
  // Try matching against parts (e.g. "seo and marketing")
  for (const [key, dept] of Object.entries(SERVICE_DEPARTMENT_MAPPING)) {
    if (normalized.includes(key)) {
      return dept;
    }
  }
  
  return 'General';
}
