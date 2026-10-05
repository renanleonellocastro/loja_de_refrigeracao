import type { Permission } from '@rc/contracts';

declare module '#app' {
  interface PageMeta {
    /** Permission of the matrix in @rc/contracts required to open the page (middleware auth.global). */
    permission?: Permission;
    /**
     * The page opens read only from the copy saved on this device when the API cannot be reached and the
     * session cannot be restored (the technician's day, issue #81).
     */
    offlineCopy?: boolean;
    /** Title shown in the top bar of the signed in area. */
    title?: string;
  }
}

export {};
