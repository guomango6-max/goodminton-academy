// Non-auth lookups on the student manifest: display name and who holds the
// account. Kept separate from lib/student-login.ts so the credential map stays
// a single-purpose module.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type AccountHolder = 'parent' | 'student';

export type StudentDirectoryEntry = {
  studentId: string;
  name: string;
  // Coach policy (2026-08-01): minors are not given accounts — the parent is.
  // On a 'parent' entry the reader is the guardian and the student is the
  // subject, not the audience. Anything that writes to a student must check
  // this before choosing how to address them.
  accountHolder: AccountHolder;
};

type ManifestEntry = {
  studentId?: string;
  name?: string;
  accountHolder?: string;
};

let cache: Record<string, StudentDirectoryEntry> | null = null;

export function getStudentDirectory(): Record<string, StudentDirectoryEntry> {
  if (cache) return cache;

  const directory: Record<string, StudentDirectoryEntry> = {};
  try {
    const raw = readFileSync(join(process.cwd(), 'data', 'student-manifest.json'), 'utf8');
    const manifest = JSON.parse(raw) as ManifestEntry[];
    if (Array.isArray(manifest)) {
      for (const entry of manifest) {
        if (!entry.studentId) continue;
        directory[entry.studentId] = {
          studentId: entry.studentId,
          name: entry.name || entry.studentId,
          // Default to 'student' only when the manifest predates the field.
          // Re-run scripts/sync-students-from-obsidian.mjs to populate it.
          accountHolder: entry.accountHolder === 'parent' ? 'parent' : 'student',
        };
      }
    }
  } catch {
    // A missing or malformed manifest degrades to an empty directory rather
    // than breaking the routes that decorate output with it.
  }

  cache = directory;
  return cache;
}

export function getStudentEntry(studentId: string): StudentDirectoryEntry | null {
  return getStudentDirectory()[studentId] || null;
}
