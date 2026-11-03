import { User } from '@/types';
import {
  STORAGE_KEYS,
  CreateUserDTO,
  UpdateUserDTO,
  UserFilterOptions,
  UserValidationError,
  ValidationErrorDetail,
} from './schema';
import { SEED_USERS } from './seed';
import { demoStorage } from './storage';
import { rolesRepository } from './roles.repository';
import { branchesRepository } from './branches.repository';

export class UsersRepository {
  /**
   * Internal retrieval of users with seed fallback.
   */
  private getUsersInternal(): User[] {
    const users = demoStorage.getItem<User[] | null>(STORAGE_KEYS.USERS, null);
    if (!users || !Array.isArray(users) || users.length === 0) {
      this.resetToSeed();
      return [...SEED_USERS];
    }
    return users;
  }

  private saveUsersInternal(users: User[]): void {
    demoStorage.setItem(STORAGE_KEYS.USERS, users);
  }

  /**
   * Retrieve all users, optionally filtered and sorted.
   */
  public getAll(options?: UserFilterOptions): User[] {
    let list = this.getUsersInternal();

    if (!options) return list;

    // 1. Text search across name, email, phone, designation
    if (options.search && options.search.trim()) {
      const q = options.search.toLowerCase().trim();
      list = list.filter((u) => {
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.phone && u.phone.toLowerCase().includes(q)) ||
          (u.designation && u.designation.toLowerCase().includes(q))
        );
      });
    }

    // 2. Role filter
    if (options.role && options.role !== 'all') {
      const targetRole = options.role.toUpperCase();
      list = list.filter((u) => u.role.toUpperCase() === targetRole);
    }

    // 3. Branch filter
    if (options.branchId && options.branchId !== 'all') {
      const bId = options.branchId;
      list = list.filter(
        (u) =>
          u.assignedBranchId === bId ||
          (Array.isArray(u.assignedBranchIds) && u.assignedBranchIds.includes(bId))
      );
    }

    // 4. Status filter
    if (options.status && options.status !== 'all') {
      const isTargetActive = options.status === 'active';
      list = list.filter((u) => (u.isActive ?? true) === isTargetActive);
    }

    // 5. Sorting
    if (options.sortBy) {
      const order = options.sortOrder === 'desc' ? -1 : 1;
      list.sort((a, b) => {
        switch (options.sortBy) {
          case 'name':
            return order * a.name.localeCompare(b.name);
          case 'email':
            return order * a.email.localeCompare(b.email);
          case 'role':
            return order * a.role.localeCompare(b.role);
          case 'status':
            return order * ((a.isActive ? 1 : 0) - (b.isActive ? 1 : 0));
          case 'createdAt':
            return (
              order *
              (new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
            );
          default:
            return 0;
        }
      });
    }

    return list;
  }

  /**
   * Find user by ID.
   */
  public getById(id: string): User | null {
    const list = this.getUsersInternal();
    return list.find((u) => u.id === id) || null;
  }

  /**
   * Find user by Email (case-insensitive).
   */
  public getByEmail(email: string): User | null {
    const list = this.getUsersInternal();
    const cleanEmail = email.toLowerCase().trim();
    return list.find((u) => u.email.toLowerCase() === cleanEmail) || null;
  }

  /**
   * Compute dynamic tab counts.
   */
  public getCounts() {
    const all = this.getUsersInternal();
    return {
      total: all.length,
      active: all.filter((u) => u.isActive ?? true).length,
      inactive: all.filter((u) => !(u.isActive ?? true)).length,
      managers: all.filter((u) => u.role === 'BRANCH_MANAGER').length,
      cashiers: all.filter((u) => u.role === 'CASHIER').length,
      wholesale: all.filter((u) => u.role === 'WHOLESALE_STAFF').length,
      inventory: all.filter((u) => u.role === 'INVENTORY_OFFICER').length,
      accountants: all.filter((u) => u.role === 'ACCOUNTANT').length,
      superAdmins: all.filter((u) => u.role === 'SUPER_ADMIN').length,
    };
  }

  /**
   * Validate user input fields.
   */
  public validate(dto: Partial<CreateUserDTO>, currentId?: string): ValidationErrorDetail[] {
    const errors: ValidationErrorDetail[] = [];

    if (!dto.name || dto.name.trim().length < 3) {
      errors.push({ field: 'name', message: 'Employee name must be at least 3 characters.' });
    }

    if (!dto.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.email.trim())) {
      errors.push({ field: 'email', message: 'Please provide a valid work email address.' });
    } else {
      const existing = this.getByEmail(dto.email);
      if (existing && existing.id !== currentId) {
        errors.push({ field: 'email', message: `Email "${dto.email}" is already registered.` });
      }
    }

    if (!dto.role) {
      errors.push({ field: 'role', message: 'Role assignment is required.' });
    }

    return errors;
  }

  /**
   * Create a new employee record.
   */
  public create(dto: CreateUserDTO): User {
    const errors = this.validate(dto);
    if (errors.length > 0) {
      throw new UserValidationError('User validation failed.', errors);
    }

    const users = this.getUsersInternal();
    const normalizedRole = dto.role.toUpperCase();
    const matchedRole = rolesRepository.getByCode(normalizedRole);

    const newId = `USR-EMP-${Date.now().toString(36).toUpperCase()}`;
    const branchIds = dto.assignedBranchIds && dto.assignedBranchIds.length > 0
      ? dto.assignedBranchIds
      : dto.assignedBranchId
      ? [dto.assignedBranchId]
      : [];

    const newUser: User = {
      id: newId,
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      phone: dto.phone?.trim() || '0300-0000000',
      role: normalizedRole,
      roleId: matchedRole?.id,
      roleName: matchedRole?.name || normalizedRole,
      assignedBranchId: dto.assignedBranchId || branchIds[0],
      assignedBranchIds: branchIds,
      designation: dto.designation?.trim() || `${matchedRole?.name || 'Staff'} (${dto.name.trim()})`,
      avatarUrl:
        dto.avatarUrl ||
        `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80`,
      isActive: dto.isActive ?? true,
      customPermissions: dto.customPermissions || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    users.push(newUser);
    this.saveUsersInternal(users);

    // Sync with branch repository if assigned as Branch Manager
    if (newUser.role === 'BRANCH_MANAGER' && newUser.assignedBranchId) {
      this.syncBranchManager(newUser.assignedBranchId, newUser.id, newUser.name, newUser.email);
    }

    return newUser;
  }

  /**
   * Update an existing user.
   */
  public update(id: string, dto: UpdateUserDTO): User {
    const users = this.getUsersInternal();
    const index = users.findIndex((u) => u.id === id);

    if (index === -1) {
      throw new UserValidationError(`User with ID "${id}" was not found.`);
    }

    const existing = users[index];

    // Check duplicate email
    if (dto.email && dto.email.toLowerCase() !== existing.email.toLowerCase()) {
      const emailConflict = this.getByEmail(dto.email);
      if (emailConflict && emailConflict.id !== id) {
        throw new UserValidationError(`Email "${dto.email}" is already in use by another staff member.`, [
          { field: 'email', message: 'Email address already in use' },
        ]);
      }
    }

    // Protection rule: Cannot demote the last active Super Admin
    if (existing.role === 'SUPER_ADMIN' && dto.role && dto.role.toUpperCase() !== 'SUPER_ADMIN') {
      const activeSuperAdmins = users.filter((u) => u.role === 'SUPER_ADMIN' && (u.isActive ?? true));
      if (activeSuperAdmins.length <= 1) {
        throw new UserValidationError(
          'Cannot reassign the role of the last remaining active Super Admin account.',
          [{ field: 'role', message: 'Protected master administrator' }]
        );
      }
    }

    const newRole = dto.role ? dto.role.toUpperCase() : existing.role;
    const matchedRole = rolesRepository.getByCode(newRole);

    const updatedBranchIds = dto.assignedBranchIds
      ? dto.assignedBranchIds
      : dto.assignedBranchId
      ? [dto.assignedBranchId]
      : existing.assignedBranchIds;

    const updatedUser: User = {
      ...existing,
      name: dto.name?.trim() || existing.name,
      email: dto.email ? dto.email.trim().toLowerCase() : existing.email,
      phone: dto.phone !== undefined ? dto.phone.trim() : existing.phone,
      role: newRole,
      roleId: matchedRole?.id || existing.roleId,
      roleName: matchedRole?.name || existing.roleName,
      assignedBranchId: dto.assignedBranchId !== undefined ? dto.assignedBranchId : existing.assignedBranchId,
      assignedBranchIds: updatedBranchIds,
      designation: dto.designation?.trim() || existing.designation,
      avatarUrl: dto.avatarUrl !== undefined ? dto.avatarUrl : existing.avatarUrl,
      customPermissions: dto.customPermissions !== undefined ? dto.customPermissions : existing.customPermissions,
      isActive: dto.isActive !== undefined ? dto.isActive : (existing.isActive ?? true),
      updatedAt: new Date().toISOString(),
    };

    users[index] = updatedUser;
    this.saveUsersInternal(users);

    // Sync with branch repository if assigned as Branch Manager
    if (updatedUser.role === 'BRANCH_MANAGER' && updatedUser.assignedBranchId) {
      this.syncBranchManager(
        updatedUser.assignedBranchId,
        updatedUser.id,
        updatedUser.name,
        updatedUser.email
      );
    }

    return updatedUser;
  }

  /**
   * Toggle active/inactive status with Last Active Super Admin protection.
   */
  public toggleStatus(id: string): User {
    const users = this.getUsersInternal();
    const index = users.findIndex((u) => u.id === id);

    if (index === -1) {
      throw new UserValidationError(`User with ID "${id}" was not found.`);
    }

    const user = users[index];
    const willDeactivate = (user.isActive ?? true);

    // Protect last active Super Admin
    if (willDeactivate && user.role === 'SUPER_ADMIN') {
      const activeSuperAdmins = users.filter(
        (u) => u.role === 'SUPER_ADMIN' && (u.isActive ?? true)
      );
      if (activeSuperAdmins.length <= 1) {
        throw new UserValidationError(
          'Security Safeguard: You cannot deactivate the last remaining active Super Admin account.'
        );
      }
    }

    const updatedUser: User = {
      ...user,
      isActive: !willDeactivate,
      updatedAt: new Date().toISOString(),
    };

    users[index] = updatedUser;
    this.saveUsersInternal(users);
    return updatedUser;
  }

  /**
   * Helper to synchronize branch manager assignments with Branches repository.
   */
  private syncBranchManager(branchId: string, managerId: string, managerName: string, managerEmail: string) {
    try {
      const branch = branchesRepository.getById(branchId);
      if (branch && branch.managerId !== managerId) {
        branchesRepository.update(branchId, {
          managerId,
          managerName,
          managerEmail,
        });
      }
    } catch {
      // Non-fatal if branches repository is still initializing
    }
  }

  /**
   * Reset users database back to initial 10 verified personas.
   */
  public resetToSeed(): void {
    this.saveUsersInternal([...SEED_USERS]);
  }
}

export const usersRepository = new UsersRepository();
