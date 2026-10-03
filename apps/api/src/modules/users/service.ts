// Public surface of the users module for other modules (docs/ARQUITETURA.md: modules talk through services).
export { findActiveUserByEmail, findActiveUserById, insertUser, updateUser } from './repository.js';
export type { NewUser, UserRow } from './repository.js';
