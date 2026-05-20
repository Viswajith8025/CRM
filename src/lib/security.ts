
import { z } from 'zod';

/**
 * OWASP-aligned Security Utilities
 * Provides input sanitization and strict validation helpers.
 */

/**
 * Sanitizes a string to prevent basic XSS and injection attacks.
 * Strips HTML tags and trims whitespace.
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';
  return input
    .replace(/<[^>]*>?/gm, '') // Strip HTML tags
    .replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m] || m)) // Escape HTML characters
    .trim();
}

/**
 * Recursively sanitizes all string values in an object.
 */
export function sanitizeObject<T>(obj: T): T {
  if (typeof obj !== 'object' || obj === null) return obj;
  
  const sanitized = Array.isArray(obj) ? [] : {} as any;
  
  for (const key in obj) {
    const value = obj[key];
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized as T;
}

/**
 * Strict schema validation helper that strips unexpected fields.
 */
export function validateSchema<T>(schema: z.ZodSchema<T>, data: any): T {
  // Zod's parse() with a default schema will strip unknown keys 
  // if you use .strict() or if it's the default behavior of your Zod version.
  // We use .strip() explicitly if needed, but here we just rely on parse.
  return schema.parse(data);
}

/**
 * Checks if a value is a valid UUID to prevent IDOR/Injection.
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
