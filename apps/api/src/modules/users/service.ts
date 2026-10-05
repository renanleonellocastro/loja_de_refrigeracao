// Public surface of the users module for other modules (docs/ARQUITETURA.md: modules talk through services).
export {
  activeEmailsByRole,
  anonymizeUser,
  exportUserData,
  findActiveUserByCpf,
  findActiveUserByEmail,
  findActiveUserById,
  findAddress,
  insertUser,
  recentCustomerActivity,
  recentEmployeeAppointments,
  saveAddress,
  searchUsers,
  updateUser,
} from './repository.js';
export type { AddressRow, NewUser, UserRow } from './repository.js';
