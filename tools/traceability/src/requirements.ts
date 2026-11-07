/** A functional requirement of docs/REQUISITOS.md. */
export interface Requirement {
  readonly id: string;
  readonly text: string;
}

// A requirement line: "* **RF-12** Cadastrar e editar produto: ... (UC Cadastrar Produto)".
const REQUIREMENT_LINE = /^\* \*\*(RF-\d{2})\*\* (.+)$/;
// The trailing use case reference adds nothing to the matrix.
const USE_CASE_REFERENCE = /\s*\((?:UC|UCs|Issue) [^)]*\)$/;

function toRequirement(line: string): Requirement | undefined {
  const match = REQUIREMENT_LINE.exec(line.trim());
  if (!match) return undefined;
  return { id: match[1]!, text: match[2]!.replace(USE_CASE_REFERENCE, '') };
}

/** Every requirement of the document, in the order it lists them. */
export function parseRequirements(markdown: string): Requirement[] {
  return markdown
    .split('\n')
    .map(toRequirement)
    .filter((requirement): requirement is Requirement => requirement !== undefined);
}
