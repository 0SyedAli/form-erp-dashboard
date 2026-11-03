import { describe, it, expect } from 'vitest';
import authReducer, {
  setAuthenticatedAccount,
  logout,
  accountToUser,
} from '@/store/slices/authSlice';
import { AuthenticatedAccount } from '@/store/services/authApi';

describe('Frontend Authentication State & Account Mapping', () => {
  it('maps Super Admin account correctly to User interface', () => {
    const adminAccount: AuthenticatedAccount = {
      id: 'ACC-ADMIN-01',
      loginId: 'admin',
      name: 'Super Admin',
      email: 'admin@moltyfoam.store',
      role: 'SUPER_ADMIN',
      permissions: {
        pos: true,
        viewProducts: true,
        addEditProducts: true,
        viewStock: true,
        manageStock: true,
      },
      isActive: true,
    };

    const user = accountToUser(adminAccount);
    expect(user.id).toBe('ACC-ADMIN-01');
    expect(user.role).toBe('SUPER_ADMIN');
    expect(user.roleName).toBe('Super Administrator');
    expect(user.customPermissions).toContain('pos');
    expect(user.customPermissions).toContain('manageStock');
  });

  it('maps Branch account with assigned branch and isolated permissions', () => {
    const branchAccount: AuthenticatedAccount = {
      id: 'ACC-BRANCH-12',
      loginId: 'mainbranch',
      name: 'Main Branch (Shop #12-14)',
      email: 'mainbranch@moltyfoam.store',
      role: 'BRANCH',
      branchId: '660000000000000000000001',
      branch: {
        id: '660000000000000000000001',
        code: 'SHOP-12',
        name: 'Main Branch (Shop #12-14)',
        shopNumber: 'Shop #12-14',
        type: 'RETAIL_STORE',
        city: 'Karachi',
      },
      permissions: {
        pos: true,
        viewOwnSales: true,
        viewStock: true,
        customers: true,
        manageStock: false,
      },
      isActive: true,
    };

    const user = accountToUser(branchAccount);
    expect(user.id).toBe('ACC-BRANCH-12');
    expect(user.role).toBe('BRANCH_MANAGER');
    expect(user.assignedBranchId).toBe('660000000000000000000001');
    expect(user.designation).toBe('Shop #12-14 Terminal');
    expect(user.customPermissions).toContain('pos');
    expect(user.customPermissions).toContain('viewStock');
    expect(user.customPermissions).not.toContain('manageStock');
  });

  it('updates state upon setAuthenticatedAccount dispatch', () => {
    const initial = {
      currentUser: null,
      account: null,
      isAuthenticated: false,
      sessionRestored: false,
    };

    const account: AuthenticatedAccount = {
      id: 'ACC-01',
      loginId: 'wholesaledepot',
      name: 'Wholesale Depot',
      role: 'BRANCH',
      permissions: { pos: true },
      isActive: true,
    };

    const nextState = authReducer(initial, setAuthenticatedAccount(account));
    expect(nextState.isAuthenticated).toBe(true);
    expect(nextState.sessionRestored).toBe(true);
    expect(nextState.account?.loginId).toBe('wholesaledepot');
    expect(nextState.currentUser?.name).toBe('Wholesale Depot');
  });

  it('clears state upon logout dispatch', () => {
    const activeState = {
      currentUser: { id: 'U1', name: 'User 1', email: 'u1@test.com', role: 'SUPER_ADMIN' as const },
      account: {
        id: 'U1',
        loginId: 'admin',
        name: 'Admin',
        role: 'SUPER_ADMIN' as const,
        permissions: {},
        isActive: true,
      },
      isAuthenticated: true,
      sessionRestored: true,
    };

    const loggedOutState = authReducer(activeState, logout());
    expect(loggedOutState.isAuthenticated).toBe(false);
    expect(loggedOutState.currentUser).toBeNull();
    expect(loggedOutState.account).toBeNull();
  });
});

