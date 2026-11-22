// Feature: 09-demo-polish (F6.2, F6.3)
//
// The no-seal text now lives in ResurrectionSection, under "What we
// resurrected". This component renders nothing. src/app/page.tsx still imports
// it (platform-dev owns that file). Spec 16 task 15 drops the import from
// page.tsx, and task 16 deletes this file.

export function NoSealSection() {
  return null;
}
