import type { Permission } from '@rc/contracts';

declare module '#app' {
  interface PageMeta {
    /** Permission of the matrix in @rc/contracts required to open the page (middleware auth.global). */
    permission?: Permission;
    /** Title shown in the top bar of the signed in area. */
    title?: string;
  }
}

export {};
