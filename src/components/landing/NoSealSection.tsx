// Feature: 09-demo-polish (F6.2, F6.3), retired by 16 task 15
//
// The no-seal text now lives in ResurrectionSection, under "What we
// resurrected". This component renders nothing. src/app/page.tsx still imports
// it (platform-dev owns that file), and the file is deleted once page.tsx drops
// the import.

export function NoSealSection() {
  return null;
}
