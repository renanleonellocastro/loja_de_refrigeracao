import { writeFileSync } from 'node:fs';
import { buildCss } from './css.js';

writeFileSync(new URL('./tokens.css', import.meta.url), buildCss());
