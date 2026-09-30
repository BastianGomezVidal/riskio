import { SetMetadata } from '@nestjs/common';
import { Role } from '../auth.roles.js';

/** Metadata key holding the roles allowed to access a handler. */
export const ROLES_KEY = 'roles';

/**
 * Declare the roles allowed to access a route. When attached together with
 * {@link RolesGuard}, the request must resolve an authenticated user whose
 * role is included.
 *
 * @param roles allowed roles, e.g. `@Roles('admin')`.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
