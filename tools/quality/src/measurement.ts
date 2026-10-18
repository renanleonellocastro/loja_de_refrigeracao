export interface Measurement {
  readonly path: string;
  readonly line: number;
  readonly name: string;
  readonly length: number;
}

export interface ScriptSource {
  readonly path: string;
  readonly text: string;
  readonly language: 'ts' | 'tsx' | 'js' | 'jsx';
  /** Lines before the script inside its file, so a Vue block reports lines of the .vue file. */
  readonly lineOffset: number;
}
