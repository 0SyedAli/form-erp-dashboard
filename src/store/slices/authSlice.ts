import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User } from '@/types';
import { DEMO_USERS } from '@/data/mockData';
import { usersRepository } from '@/lib/demo-db/users.repository';

interface AuthState {
  currentUser: User | null;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  // Default to Super Admin for immediate executive dashboard preview
  currentUser: DEMO_USERS[0],
  isAuthenticated: true,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCurrentUser: (state, action: PayloadAction<User>) => {
      state.currentUser = action.payload;
      state.isAuthenticated = true;
    },
    logout: (state) => {
      state.currentUser = null;
      state.isAuthenticated = false;
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

export const { setCurrentUser, logout, switchPersona } = authSlice.actions;
export default authSlice.reducer;
