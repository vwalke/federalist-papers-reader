declare module '../scripts/validate-content.mjs' {
  export interface ContentValidationReport {
    count: number;
    missingNumbers: number[];
    duplicateNumbers: number[];
    missingFields: string[];
    emptyBodies: string[];
    shortSummariesOver18Words: number[];
    unquotedDates: string[];
    commentaryOutsideTarget: number[];
  }

  export function validateContentDirectory(directory: URL): Promise<ContentValidationReport>;
}
