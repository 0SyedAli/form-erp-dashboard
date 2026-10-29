import { User, Branch } from '@/types';
import { rolesRepository } from '@/lib/demo-db';

/**
 * Determine whether a user possesses a specific permission.
 * Super Admin implicitly has all system permissions.
 */
export function hasPermission(user: User | null | undefined, permissionKey: string): boolean {
  if (!user || user.isActive === false) return false;

  // Super Admin possesses unrestricted master authority
  if (user.role.toUpperCase() === 'SUPER_ADMIN') {
    return true;
  }

  // Check custom permission overrides first
  if (Array.isArray(user.customPermissions) && user.customPermissions.includes(permissionKey)) {
    return true;
  }

  // Check role-based permissions
  const role = rolesRepository.getByCode(user.role);
  if (role && Array.isArray(role.permissions)) {
    if (role.permissions.includes(permissionKey)) return true;
  }

  // Built-in role fallbacks for Flow 07 permissions
  const roleCode = user.role.toUpperCase();
  if (roleCode === 'BRANCH_MANAGER') {
    const bmAllowed = [
      'sales.credit.create',
      'sales.credit.approve',
      'customers.credit.manage',
      'payments.collect',
      'ledger.view',
      'pricing.override',
      'pos:create',
      'pos:view',
    ];
    if (bmAllowed.includes(permissionKey)) return true;
  } else if (roleCode === 'CASHIER') {
    const cashierAllowed = [
      'sales.credit.create',
      'payments.collect',
      'pos:create',
      'pos:view',
    ];
    if (cashierAllowed.includes(permissionKey)) return true;
  } else if (roleCode === 'ACCOUNTANT') {
    const accAllowed = [
      'payments.collect',
      'ledger.view',
      'customers.credit.manage',
      'sales.credit.approve',
    ];
    if (accAllowed.includes(permissionKey)) return true;
  } else if (roleCode === 'WHOLESALE_STAFF') {
    const wsAllowed = [
      'sales.credit.create',
      'payments.collect',
      'ledger.view',
      'wholesale:create',
      'wholesale:view',
    ];
    if (wsAllowed.includes(permissionKey)) return true;
  }

  return false;
}

/**
 * Check whether a user is authorized to access data for a specific branch.
 */
export function canAccessBranch(user: User | null | undefined, branchId: string): boolean {
  if (!user || user.isActive === false) return false;

  const roleCode = user.role.toUpperCase();

  // Super Admin and Accountants have global consolidated access
  if (roleCode === 'SUPER_ADMIN' || roleCode === 'ACCOUNTANT') {
    return true;
  }

  // Primary branch match
  if (user.assignedBranchId === branchId) {
    return true;
  }

  // Multi-branch accessibility list match
  if (Array.isArray(user.assignedBranchIds) && user.assignedBranchIds.includes(branchId)) {
    return true;
  }

  return false;
}

/**
 * Filter an array of branches to only those accessible by the given user.
 */
export function getUserAuthorizedBranches(
  user: User | null | undefined,
  allBranches: Branch[]
): Branch[] {
  if (!user || user.isActive === false) return [];
  return allBranches.filter((b) => canAccessBranch(user, b.id));
}

/**
 * Visual badge styling helper for role tags across the ERP UI.
 */
export function getRoleBadge(roleCode?: string): {
  label: string;
  bg: string;
  text: string;
  border: string;
} {
  const code = roleCode ? roleCode.toUpperCase() : 'UNKNOWN';

  switch (code) {
    case 'SUPER_ADMIN':
      return {
        label: 'Super Admin',
        bg: 'bg-purple-50',
        text: 'text-purple-700',
        border: 'border-purple-200/60',
      };
    case 'BRANCH_MANAGER':
      return {
        label: 'Branch Manager',
        bg: 'bg-blue-50',
        text: 'text-brand-blue',
        border: 'border-blue-200/60',
      };
    case 'CASHIER':
      return {
        label: 'Cashier',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200/60',
      };
    case 'WHOLESALE_STAFF':
      return {
        label: 'Wholesale Staff',
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        border: 'border-amber-200/60',
      };
    case 'INVENTORY_OFFICER':
      return {
        label: 'Inventory Officer',
        bg: 'bg-cyan-50',
        text: 'text-cyan-800',
        border: 'border-cyan-200/60',
      };
    case 'ACCOUNTANT':
      return {
        label: 'Accountant',
        bg: 'bg-indigo-50',
        text: 'text-indigo-700',
        border: 'border-indigo-200/60',
      };
    default:
      return {
        label: roleCode || 'Custom Role',
        bg: 'bg-slate-100',
        text: 'text-slate-700',
        border: 'border-slate-200',
      };
  }
}
