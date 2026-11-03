import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export interface AuthenticatedBranch {
  id: string;
  code: string;
  name: string;
  shopNumber: string;
  type: string;
  city: string;
}

export interface AuthenticatedAccount {
  id: string;
  loginId: string;
  name: string;
  email?: string;
  role: 'SUPER_ADMIN' | 'BRANCH';
  branchId?: string;
  permissions: Record<string, boolean>;
  branch?: AuthenticatedBranch | null;
  isActive?: boolean;
}

export interface LoginRequest {
  loginId: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  data: {
    account: AuthenticatedAccount;
    expiresAt: string;
  };
}

export interface ProfileResponse {
  success: boolean;
  data: AuthenticatedAccount;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    credentials: 'include', // Includes HttpOnly cookies in CORS requests
  }),
  tagTypes: ['Auth'],
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: ['Auth'],
    }),
    logout: builder.mutation<{ success: boolean }, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      invalidatesTags: ['Auth'],
    }),
    getMe: builder.query<ProfileResponse, void>({
      query: () => '/auth/me',
      providesTags: ['Auth'],
    }),
    changePassword: builder.mutation<
      { success: boolean; message: string },
      { currentPassword: string; newPassword: string }
    >({
      query: (body) => ({
        url: '/auth/change-password',
        method: 'POST',
        body,
      }),
    }),
  }),
});

export const {
  useLoginMutation,
  useLogoutMutation,
  useGetMeQuery,
  useLazyGetMeQuery,
  useChangePasswordMutation,
} = authApi;
