import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User } from '@/types';
import { DEMO_USERS } from '@/data/mockData';
import { usersRepository } from '@/lib/demo-db/users.repository';
import { AuthenticatedAccount } from '../services/authApi';
import { clearAuthCookies, setAuthCookies } from '@/utils/authCookies';

export function accountToUser(account: AuthenticatedAccount): User {
  return {
    id: account.id,
    name: account.name,
    email: account.email || `${account.loginId}@moltyfoam.store`,
    role: account.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'BRANCH_MANAGER',
    roleName: account.role === 'SUPER_ADMIN' ? 'Super Administrator' : 'Branch Operator',
    assignedBranchId: account.branchId || account.branch?.id || undefined,
    branchId: account.branchId || account.branch?.id || undefined,
    assignedBranchIds: account.branchId ? [account.branchId] : [],
    designation: account.branch?.shopNumber
      ? `${account.branch.shopNumber} Terminal`
      : account.role === 'SUPER_ADMIN'
      ? 'Executive HQ'
      : 'Branch Terminal',
    isActive: account.isActive ?? true,
    customPermissions: Object.entries(account.permissions || {})
      .filter(([, v]) => Boolean(v))
      .map(([k]) => k),
    permissions: account.permissions,
  };
}

interface AuthState {
  currentUser: User | null;
  account: AuthenticatedAccount | null;
  isAuthenticated: boolean;
  sessionRestored: boolean;
}

const AUTH_STORAGE_KEY = 'molty_auth_session';

function getInitialState(): AuthState {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.account) {
          return {
            currentUser: accountToUser(parsed.account),
            account: parsed.account,
            isAuthenticated: true,
            sessionRestored: true,
          };
        }
      }
    } catch {}
  }

  return {
    currentUser: null,
    account: null,
    isAuthenticated: false,
    sessionRestored: false,
  };
}

const initialState: AuthState = getInitialState();

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthenticatedAccount: (state, action: PayloadAction<AuthenticatedAccount>) => {
      state.account = action.payload;
      state.currentUser = accountToUser(action.payload);
      state.isAuthenticated = true;
      state.sessionRestored = true;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ account: action.payload }));
        } catch {}
      }
    },
    setCurrentUser: (state, action: PayloadAction<User>) => {
      state.currentUser = action.payload;
      state.isAuthenticated = true;
    },
    logout: (state) => {
      state.currentUser = null;
      state.account = null;
      state.isAuthenticated = false;
      state.sessionRestored = true;
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(AUTH_STORAGE_KEY);
        } catch {}
        clearAuthCookies();
      }
    },
    markSessionChecked: (state) => {
      state.sessionRestored = true;
    },
    switchPersona: (state, action: PayloadAction<string>) => {
      let found: User | null = null;
      try {
        found = usersRepository.getById(action.payload);
      } catch {
        // SSR fallback
      }
      if (!found) {
        found = DEMO_USERS.find((u) => u.id === action.payload) || null;
      }
      if (found) {
        state.currentUser = found;
        state.isAuthenticated = true;
      }
    },
  },
});

export const {
  setAuthenticatedAccount,
  setCurrentUser,
  logout,
  markSessionChecked,
  switchPersona,
} = authSlice.actions;

export default authSlice.reducer;
