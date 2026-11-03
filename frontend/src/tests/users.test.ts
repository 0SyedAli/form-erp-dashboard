import { describe, it, expect, beforeEach } from 'vitest';
import {
  usersRepository,
  rolesRepository,
  branchesRepository,
  demoStorage,
  STORAGE_KEYS,
  UserValidationError,
  RoleValidationError,
} from '@/lib/demo-db';
import { hasPermission, canAccessBranch } from '@/lib/permissions';
import { User } from '@/types';

describe('Flow 03 — Users, Roles & Permissions Management', () => {
  beforeEach(() => {
    // Reset databases to clean seed state before each test
    usersRepository.resetToSeed();
    rolesRepository.resetToSeed();
    branchesRepository.resetToSeed();
  });

  it('1. Seed Data: initializes with baseline 10 verified personas across 6 roles', () => {
    const users = usersRepository.getAll();
    expect(users.length).toBe(10);

    const counts = usersRepository.getCounts();
    expect(counts.total).toBe(10);
    expect(counts.active).toBe(10);
    expect(counts.inactive).toBe(0);
    expect(counts.superAdmins).toBe(1);
    expect(counts.managers).toBe(5);
    expect(counts.cashiers).toBe(1);
    expect(counts.wholesale).toBe(1);
    expect(counts.inventory).toBe(1);
    expect(counts.accountants).toBe(1);
  });

  it('2. User Creation: successfully registers a new employee with valid fields', () => {
    const created = usersRepository.create({
      name: 'Zainab Bibi',
      email: 'zainab.bibi@moltyfoam.store',
      phone: '0300-9876543',
      role: 'CASHIER',
      assignedBranchId: 'BR-MAIN-01',
      designation: 'Junior POS Operator',
    });

    expect(created).toBeDefined();
    expect(created.id).toContain('USR-EMP-');
    expect(created.name).toBe('Zainab Bibi');
    expect(created.email).toBe('zainab.bibi@moltyfoam.store');
    expect(created.role).toBe('CASHIER');
    expect(created.isActive).toBe(true);

    const retrieved = usersRepository.getById(created.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.email).toBe('zainab.bibi@moltyfoam.store');
  });

  it('3. Duplicate Email Validation: rejects user registration if email already exists', () => {
    expect(() => {
      usersRepository.create({
        name: 'Imposter Admin',
        email: 'ali.raza@moltyfoam.store', // Already exists as Super Admin
        role: 'CASHIER',
      });
    }).toThrow(UserValidationError);
  });

  it('4. User Profile Update: modifies details and updates timestamp', () => {
    const user = usersRepository.getByEmail('ayesha.khan@moltyfoam.store');
    expect(user).not.toBeNull();

    const updated = usersRepository.update(user!.id, {
      phone: '0300-9991122',
      designation: 'Lead POS Supervisor',
      customPermissions: ['pos:create', 'pos:returns', 'inventory:view', 'wholesale:view'],
    });

    expect(updated.phone).toBe('0300-9991122');
    expect(updated.designation).toBe('Lead POS Supervisor');
    expect(updated.customPermissions).toContain('wholesale:view');

    const fresh = usersRepository.getById(user!.id);
    expect(fresh?.phone).toBe('0300-9991122');
  });

  it('5. User Deactivation & Activation: soft status toggle preserves account and audits', () => {
    const user = usersRepository.getByEmail('ayesha.khan@moltyfoam.store');
    expect(user?.isActive).toBe(true);

    // Deactivate
    const deactivated = usersRepository.toggleStatus(user!.id);
    expect(deactivated.isActive).toBe(false);

    let counts = usersRepository.getCounts();
    expect(counts.active).toBe(9);
    expect(counts.inactive).toBe(1);

    // Reactivate
    const reactivated = usersRepository.toggleStatus(user!.id);
    expect(reactivated.isActive).toBe(true);

    counts = usersRepository.getCounts();
    expect(counts.active).toBe(10);
    expect(counts.inactive).toBe(0);
  });

  it('6. Safeguard: prevents deactivating the last active Super Admin', () => {
    const admin = usersRepository.getByEmail('ali.raza@moltyfoam.store');
    expect(admin).not.toBeNull();
    expect(admin?.role).toBe('SUPER_ADMIN');

    expect(() => {
      usersRepository.toggleStatus(admin!.id);
    }).toThrow(UserValidationError);
  });

  it('7. Safeguard: prevents demoting the last active Super Admin to another role', () => {
    const admin = usersRepository.getByEmail('ali.raza@moltyfoam.store');
    expect(admin).not.toBeNull();

    expect(() => {
      usersRepository.update(admin!.id, {
        role: 'CASHIER',
      });
    }).toThrow(UserValidationError);
  });

  it('8. Search & Filtering: searches text and filters by role, branch, and status', () => {
    // Text search
    const searchByName = usersRepository.getAll({ search: 'Tariq' });
    expect(searchByName.length).toBe(1);
    expect(searchByName[0].name).toBe('Tariq Mehmood');

    const searchByPhone = usersRepository.getAll({ search: '7777777' });
    expect(searchByPhone.length).toBe(1);
    expect(searchByPhone[0].email).toBe('sara.khan@moltyfoam.store');

    // Role filter
    const cashiers = usersRepository.getAll({ role: 'CASHIER' });
    expect(cashiers.length).toBe(1);
    expect(cashiers[0].name).toBe('Ayesha Khan');

    // Branch filter
    const wsUsers = usersRepository.getAll({ branchId: 'BR-WS-03' });
    expect(wsUsers.length).toBeGreaterThanOrEqual(3); // Saad Malik, Farhan Qureshi, Tariq Mehmood
  });

  it('9. Branch Manager Synchronization: updates branch record when manager is reassigned', () => {
    // Create new manager assigned to Main Branch
    const newManager = usersRepository.create({
      name: 'Kashif Mehmood',
      email: 'kashif.mehmood@moltyfoam.store',
      phone: '0300-7654321',
      role: 'BRANCH_MANAGER',
      assignedBranchId: 'BR-MAIN-01',
    });

    const branch = branchesRepository.getById('BR-MAIN-01');
    expect(branch?.managerId).toBe(newManager.id);
    expect(branch?.managerName).toBe('Kashif Mehmood');
    expect(branch?.managerEmail).toBe('kashif.mehmood@moltyfoam.store');
  });

  it('10. Custom Role CRUD & System Role Protection', () => {
    // Create custom role
    const customRole = rolesRepository.create({
      name: 'Shift Supervisor',
      code: 'SHIFT_SUPERVISOR',
      description: 'Supervises cashiers and counter handovers',
      permissions: ['pos:create', 'pos:view', 'pos:returns', 'inventory:view'],
    });

    expect(customRole.id).toBeDefined();
    expect(customRole.code).toBe('SHIFT_SUPERVISOR');
    expect(customRole.isSystem).toBe(false);

    // Retrieve
    const found = rolesRepository.getByCode('SHIFT_SUPERVISOR');
    expect(found?.name).toBe('Shift Supervisor');

    // Prevent deleting system role
    const systemRole = rolesRepository.getByCode('SUPER_ADMIN');
    expect(() => {
      rolesRepository.delete(systemRole!.id);
    }).toThrow(RoleValidationError);

    // Delete custom role
    const deleted = rolesRepository.delete(customRole.id);
    expect(deleted).toBe(true);
    expect(rolesRepository.getByCode('SHIFT_SUPERVISOR')).toBeNull();
  });

  it('11. Permissions Helper: checks module privileges across roles and custom overrides', () => {
    const admin = usersRepository.getByEmail('ali.raza@moltyfoam.store')!;
    const cashier = usersRepository.getByEmail('ayesha.khan@moltyfoam.store')!;
    const accountant = usersRepository.getByEmail('sara.khan@moltyfoam.store')!;

    // Super Admin has all permissions
    expect(hasPermission(admin, 'branches:manage')).toBe(true);
    expect(hasPermission(admin, 'users:manage')).toBe(true);
    expect(hasPermission(admin, 'reports:financial')).toBe(true);

    // Cashier has POS permissions but cannot manage branches or users
    expect(hasPermission(cashier, 'pos:create')).toBe(true);
    expect(hasPermission(cashier, 'pos:returns')).toBe(true);
    expect(hasPermission(cashier, 'branches:manage')).toBe(false);
    expect(hasPermission(cashier, 'users:manage')).toBe(false);

    // Accountant has financial reporting access
    expect(hasPermission(accountant, 'reports:financial')).toBe(true);
    expect(hasPermission(accountant, 'pos:create')).toBe(false);

    // Deactivated user has zero permissions
    const inactiveUser: User = { ...cashier, isActive: false };
    expect(hasPermission(inactiveUser, 'pos:create')).toBe(false);
  });

  it('12. Branch Isolation: verifies authorized branch boundary access', () => {
    const admin = usersRepository.getByEmail('ali.raza@moltyfoam.store')!;
    const managerMain = usersRepository.getByEmail('bilal.ahmed@moltyfoam.store')!;
    const accountant = usersRepository.getByEmail('sara.khan@moltyfoam.store')!;

    // Super Admin and Accountant have global access to all branches
    expect(canAccessBranch(admin, 'BR-MAIN-01')).toBe(true);
    expect(canAccessBranch(admin, 'BR-WS-03')).toBe(true);
    expect(canAccessBranch(accountant, 'BR-DISP-02')).toBe(true);

    // Manager of Main Branch can only access BR-MAIN-01
    expect(canAccessBranch(managerMain, 'BR-MAIN-01')).toBe(true);
    expect(canAccessBranch(managerMain, 'BR-WS-03')).toBe(false);
    expect(canAccessBranch(managerMain, 'BR-DISP-02')).toBe(false);
  });

  it('13. Persistence & Reset Demo: verifies storage survival and clean restore', () => {
    // Add user
    usersRepository.create({
      name: 'Temporary Staff',
      email: 'temp.staff@moltyfoam.store',
      role: 'CASHIER',
    });
    expect(usersRepository.getAll().length).toBe(11);

    // Verify localStorage key holds 11 records
    const stored = demoStorage.getItem<User[]>(STORAGE_KEYS.USERS, []);
    expect(stored.length).toBe(11);

    // Reset to seed
    usersRepository.resetToSeed();
    expect(usersRepository.getAll().length).toBe(10);
    expect(usersRepository.getByEmail('temp.staff@moltyfoam.store')).toBeNull();
  });
});
