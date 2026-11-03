import { Role, Permission } from '@/types';
import {
  STORAGE_KEYS,
  CreateRoleDTO,
  UpdateRoleDTO,
  RoleFilterOptions,
  RoleValidationError,
} from './schema';
import { SEED_ROLES, SEED_PERMISSIONS } from './seed';
import { demoStorage } from './storage';

export class RolesRepository {
  /**
   * Internal retrieval of roles with seed fallback.
   */
  private getRolesInternal(): Role[] {
    const roles = demoStorage.getItem<Role[] | null>(STORAGE_KEYS.ROLES, null);
    if (!roles || !Array.isArray(roles) || roles.length === 0) {
      this.resetToSeed();
      return [...SEED_ROLES];
    }
    return roles;
  }

  private saveRolesInternal(roles: Role[]): void {
    demoStorage.setItem(STORAGE_KEYS.ROLES, roles);
  }

  /**
   * Return the static master catalogue of all available permissions.
   */
  public getPermissionsCatalogue(): Permission[] {
    return SEED_PERMISSIONS;
  }

  /**
   * Retrieve all roles, optionally filtered.
   */
  public getAll(filter?: RoleFilterOptions): Role[] {
    let roles = this.getRolesInternal();

    if (filter?.search) {
      const q = filter.search.toLowerCase().trim();
      roles = roles.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)
      );
    }

    if (typeof filter?.isSystem === 'boolean') {
      roles = roles.filter((r) => r.isSystem === filter.isSystem);
    }

    return roles;
  }

  /**
   * Find role by ID.
   */
  public getById(id: string): Role | null {
    const roles = this.getRolesInternal();
    return roles.find((r) => r.id === id) || null;
  }

  /**
   * Find role by unique Code.
   */
  public getByCode(code: string): Role | null {
    const roles = this.getRolesInternal();
    return roles.find((r) => r.code.toUpperCase() === code.toUpperCase()) || null;
  }

  /**
   * Register a new custom role.
   */
  public create(dto: CreateRoleDTO): Role {
    const roles = this.getRolesInternal();

    const normalizedCode = dto.code.trim().toUpperCase().replace(/\s+/g, '_');

    if (!dto.name || dto.name.trim().length < 3) {
      throw new RoleValidationError('Role name must be at least 3 characters long.', [
        { field: 'name', message: 'Name must be at least 3 characters' },
      ]);
    }

    if (!normalizedCode || !/^[A-Z0-9_]{3,30}$/.test(normalizedCode)) {
      throw new RoleValidationError('Role code must be 3-30 uppercase alphanumeric characters or underscores.', [
        { field: 'code', message: 'Invalid role code format' },
      ]);
    }

    // Check duplicate code
    if (roles.some((r) => r.code.toUpperCase() === normalizedCode)) {
      throw new RoleValidationError(`Role code "${normalizedCode}" already exists.`, [
        { field: 'code', message: 'Role code already in use' },
      ]);
    }

    if (!Array.isArray(dto.permissions) || dto.permissions.length === 0) {
      throw new RoleValidationError('A role must contain at least one authorized permission.', [
        { field: 'permissions', message: 'Select at least one permission' },
      ]);
    }

    const newRole: Role = {
      id: `ROLE_CUSTOM_${Date.now()}`,
      code: normalizedCode,
      name: dto.name.trim(),
      description: dto.description?.trim() || `Custom business role for ${dto.name.trim()}`,
      isSystem: false,
      permissions: [...new Set(dto.permissions)],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    roles.push(newRole);
    this.saveRolesInternal(roles);
    return newRole;
  }

  /**
   * Update an existing role.
   * Super Admin permissions are protected from being stripped.
   */
  public update(id: string, dto: UpdateRoleDTO): Role {
    const roles = this.getRolesInternal();
    const index = roles.findIndex((r) => r.id === id);

    if (index === -1) {
      throw new RoleValidationError(`Role with ID "${id}" was not found.`);
    }

    const existing = roles[index];

    // If updating Super Admin role, ensure critical privileges cannot be removed
    const updatedPermissions = dto.permissions ? [...new Set(dto.permissions)] : [...existing.permissions];
    if (existing.code === 'SUPER_ADMIN') {
      const critical = ['users:manage', 'branches:manage', 'roles:manage'];
      for (const crit of critical) {
        if (!updatedPermissions.includes(crit)) {
          updatedPermissions.push(crit);
        }
      }
    }

    const updatedRole: Role = {
      ...existing,
      name: dto.name?.trim() || existing.name,
      description: dto.description?.trim() || existing.description,
      permissions: updatedPermissions,
      updatedAt: new Date().toISOString(),
    };

    roles[index] = updatedRole;
    this.saveRolesInternal(roles);
    return updatedRole;
  }

  /**
   * Delete a custom role (system roles cannot be deleted).
   */
  public delete(id: string, isRoleInUseCheck?: (roleCode: string) => boolean): boolean {
    const roles = this.getRolesInternal();
    const role = roles.find((r) => r.id === id);

    if (!role) {
      throw new RoleValidationError(`Role with ID "${id}" was not found.`);
    }

    if (role.isSystem) {
      throw new RoleValidationError(`System role "${role.name}" is protected and cannot be deleted.`);
    }

    if (isRoleInUseCheck && isRoleInUseCheck(role.code)) {
      throw new RoleValidationError(
        `Cannot delete role "${role.name}" because active staff members are currently assigned to it.`
      );
    }

    const filtered = roles.filter((r) => r.id !== id);
    this.saveRolesInternal(filtered);
    return true;
  }

  /**
   * Reset roles table back to default 6 system roles.
   */
  public resetToSeed(): void {
    this.saveRolesInternal([...SEED_ROLES]);
  }
}

export const rolesRepository = new RolesRepository();
