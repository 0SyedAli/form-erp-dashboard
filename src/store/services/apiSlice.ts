import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { 
  Invoice, 
  DashboardKPIs, 
  BranchPerformanceMetric, 
  SalesTrendDataPoint, 
  TopProductMetric,
  Branch,
  BranchSettings,
  Product,
  FilterState,
  User,
  Role,
  Permission
} from '@/types';
import { SHARED_PRODUCT_CATALOGUE, INITIAL_MOCK_INVOICES } from '@/data/mockData';
import { 
  filterInvoices, 
  calculateDashboardKPIs, 
  calculateBranchPerformance, 
  calculateSalesTrend, 
  calculateTopProducts 
} from '@/utils/financialCalculations';
import {
  branchesRepository,
  CreateBranchDTO,
  UpdateBranchDTO,
  BranchFilterOptions,
  usersRepository,
  rolesRepository,
  CreateUserDTO,
  UpdateUserDTO,
  UserFilterOptions,
  CreateRoleDTO,
  UpdateRoleDTO,
  RoleFilterOptions,
} from '@/lib/demo-db';

// Simulated latency helper for realistic demo feedback
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const erpApi = createApi({
  reducerPath: 'erpApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['Invoices', 'KPIs', 'Branches', 'Products', 'Users', 'Roles'],
  endpoints: (builder) => ({
    getBranches: builder.query<Branch[], BranchFilterOptions | void>({
      async queryFn(filter) {
        await delay(80);
        try {
          const data = branchesRepository.getAll(filter || undefined);
          return { data };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Branches' as const, id })),
              { type: 'Branches', id: 'LIST' },
            ]
          : [{ type: 'Branches', id: 'LIST' }],
    }),

    getBranchCounts: builder.query<
      { total: number; retail: number; warehouse: number; active: number; inactive: number },
      void
    >({
      async queryFn() {
        await delay(50);
        try {
          const counts = branchesRepository.getCounts();
          return { data: counts };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: [{ type: 'Branches', id: 'COUNTS' }],
    }),

    getBranchById: builder.query<Branch | null, string>({
      async queryFn(id) {
        await delay(60);
        try {
          const branch = branchesRepository.getById(id);
          if (!branch) {
            return { error: { status: 404, data: `Branch with ID "${id}" not found.` } };
          }
          return { data: branch };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: (_result, _error, id) => [{ type: 'Branches', id }],
    }),

    createBranch: builder.mutation<Branch, CreateBranchDTO>({
      async queryFn(input) {
        await delay(120);
        try {
          const newBranch = branchesRepository.create(input);
          return { data: newBranch };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: [{ type: 'Branches', id: 'LIST' }, { type: 'Branches', id: 'COUNTS' }, 'KPIs'],
    }),

    updateBranch: builder.mutation<Branch, { id: string; input: UpdateBranchDTO }>({
      async queryFn({ id, input }) {
        await delay(120);
        try {
          const updated = branchesRepository.update(id, input);
          return { data: updated };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Branches', id },
        { type: 'Branches', id: 'LIST' },
        { type: 'Branches', id: 'COUNTS' },
        'KPIs',
      ],
    }),

    toggleBranchStatus: builder.mutation<Branch, { id: string; isActive: boolean }>({
      async queryFn({ id, isActive }) {
        await delay(90);
        try {
          const updated = branchesRepository.toggleStatus(id, isActive);
          return { data: updated };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Branches', id },
        { type: 'Branches', id: 'LIST' },
        { type: 'Branches', id: 'COUNTS' },
        'KPIs',
      ],
    }),

    updateBranchSettings: builder.mutation<
      Branch,
      { id: string; settings: Partial<BranchSettings> }
    >({
      async queryFn({ id, settings }) {
        await delay(80);
        try {
          const updated = branchesRepository.updateSettings(id, settings);
          return { data: updated };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Branches', id },
        { type: 'Branches', id: 'LIST' },
      ],
    }),

    resetDemoData: builder.mutation<{ success: boolean; branches: Branch[] }, void>({
      async queryFn() {
        await delay(150);
        try {
          const resetBranches = branchesRepository.resetToSeed();
          usersRepository.resetToSeed();
          rolesRepository.resetToSeed();
          return { data: { success: true, branches: resetBranches } };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      invalidatesTags: ['Branches', 'KPIs', 'Invoices', 'Products', 'Users', 'Roles'],
    }),

    getProductCatalogue: builder.query<Product[], void>({
      async queryFn() {
        await delay(100);
        return { data: SHARED_PRODUCT_CATALOGUE };
      },
      providesTags: ['Products'],
    }),

    getInvoices: builder.query<Invoice[], Partial<FilterState>>({
      async queryFn(filter) {
        await delay(120);
        const filtered = filterInvoices(INITIAL_MOCK_INVOICES, {
          branchId: filter?.branchId,
          dateRange: filter?.dateRange,
          startDate: filter?.startDate,
          endDate: filter?.endDate,
          customerType: filter?.customerTypeFilter,
          searchQuery: filter?.searchQuery,
        });
        return { data: filtered };
      },
      providesTags: ['Invoices'],
    }),

    getInvoiceById: builder.query<Invoice | null, string>({
      async queryFn(id) {
        await delay(70);
        const invoice = INITIAL_MOCK_INVOICES.find((inv) => inv.id === id) || null;
        if (!invoice) {
          return { error: { status: 404, data: 'Invoice not found' } };
        }
        return { data: invoice };
      },
    }),

    getDashboardKPIs: builder.query<DashboardKPIs, Partial<FilterState>>({
      async queryFn(filter) {
        await delay(100);
        const filtered = filterInvoices(INITIAL_MOCK_INVOICES, {
          branchId: filter?.branchId,
          dateRange: filter?.dateRange,
          startDate: filter?.startDate,
          endDate: filter?.endDate,
          customerType: filter?.customerTypeFilter,
          searchQuery: filter?.searchQuery,
        });
        const kpis = calculateDashboardKPIs(filtered);
        return { data: kpis };
      },
      providesTags: ['KPIs'],
    }),

    getSalesTrend: builder.query<SalesTrendDataPoint[], Partial<FilterState>>({
      async queryFn(filter) {
        await delay(120);
        const filtered = filterInvoices(INITIAL_MOCK_INVOICES, {
          branchId: filter?.branchId,
          dateRange: filter?.dateRange,
          startDate: filter?.startDate,
          endDate: filter?.endDate,
        });
        const trend = calculateSalesTrend(filtered);
        return { data: trend };
      },
    }),

    getBranchPerformance: builder.query<BranchPerformanceMetric[], Partial<FilterState>>({
      async queryFn(filter) {
        await delay(100);
        const branches = branchesRepository.getAll();
        const filtered = filterInvoices(INITIAL_MOCK_INVOICES, {
          dateRange: filter?.dateRange,
          startDate: filter?.startDate,
          endDate: filter?.endDate,
        });
        const performance = calculateBranchPerformance(branches, filtered);
        return { data: performance };
      },
      providesTags: ['KPIs', 'Branches'],
    }),

    getTopProducts: builder.query<TopProductMetric[], { branchId?: string }>({
      async queryFn({ branchId }) {
        await delay(100);
        const filtered = filterInvoices(INITIAL_MOCK_INVOICES, {
          branchId,
          dateRange: 'mtd',
        });
        const topProducts = calculateTopProducts(
          SHARED_PRODUCT_CATALOGUE,
          filtered,
          branchId
        );
        return { data: topProducts };
      },
      providesTags: ['Products'],
    }),

    // --- Users & Roles Management Endpoints ---
    getUsers: builder.query<User[], UserFilterOptions | void>({
      async queryFn(filter) {
        await delay(60);
        try {
          const data = usersRepository.getAll(filter || undefined);
          return { data };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Users' as const, id })),
              { type: 'Users', id: 'LIST' },
            ]
          : [{ type: 'Users', id: 'LIST' }],
    }),

    getUserCounts: builder.query<
      {
        total: number;
        active: number;
        inactive: number;
        managers: number;
        cashiers: number;
        wholesale: number;
        inventory: number;
        accountants: number;
        superAdmins: number;
      },
      void
    >({
      async queryFn() {
        await delay(50);
        try {
          const counts = usersRepository.getCounts();
          return { data: counts };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: [{ type: 'Users', id: 'COUNTS' }],
    }),

    getUserById: builder.query<User | null, string>({
      async queryFn(id) {
        await delay(50);
        try {
          const user = usersRepository.getById(id);
          if (!user) {
            return { error: { status: 404, data: `User with ID "${id}" not found.` } };
          }
          return { data: user };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: (_result, _error, id) => [{ type: 'Users', id }],
    }),

    createUser: builder.mutation<User, CreateUserDTO>({
      async queryFn(input) {
        await delay(100);
        try {
          const newUser = usersRepository.create(input);
          return { data: newUser };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: [
        { type: 'Users', id: 'LIST' },
        { type: 'Users', id: 'COUNTS' },
        { type: 'Branches', id: 'LIST' },
      ],
    }),

    updateUser: builder.mutation<User, { id: string; input: UpdateUserDTO }>({
      async queryFn({ id, input }) {
        await delay(100);
        try {
          const updated = usersRepository.update(id, input);
          return { data: updated };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Users', id },
        { type: 'Users', id: 'LIST' },
        { type: 'Users', id: 'COUNTS' },
        { type: 'Branches', id: 'LIST' },
      ],
    }),

    toggleUserStatus: builder.mutation<User, string>({
      async queryFn(id) {
        await delay(80);
        try {
          const toggled = usersRepository.toggleStatus(id);
          return { data: toggled };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: (_result, _error, id) => [
        { type: 'Users', id },
        { type: 'Users', id: 'LIST' },
        { type: 'Users', id: 'COUNTS' },
      ],
    }),

    getRoles: builder.query<Role[], RoleFilterOptions | void>({
      async queryFn(filter) {
        await delay(60);
        try {
          const data = rolesRepository.getAll(filter || undefined);
          return { data };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Roles' as const, id })),
              { type: 'Roles', id: 'LIST' },
            ]
          : [{ type: 'Roles', id: 'LIST' }],
    }),

    createRole: builder.mutation<Role, CreateRoleDTO>({
      async queryFn(input) {
        await delay(100);
        try {
          const newRole = rolesRepository.create(input);
          return { data: newRole };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: [{ type: 'Roles', id: 'LIST' }],
    }),

    updateRole: builder.mutation<Role, { id: string; input: UpdateRoleDTO }>({
      async queryFn({ id, input }) {
        await delay(100);
        try {
          const updated = rolesRepository.update(id, input);
          return { data: updated };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Roles', id },
        { type: 'Roles', id: 'LIST' },
        { type: 'Users', id: 'LIST' },
      ],
    }),

    getPermissionsCatalogue: builder.query<Permission[], void>({
      async queryFn() {
        try {
          const data = rolesRepository.getPermissionsCatalogue();
          return { data };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
    }),
  }),
});

export const {
  useGetBranchesQuery,
  useGetBranchCountsQuery,
  useGetBranchByIdQuery,
  useCreateBranchMutation,
  useUpdateBranchMutation,
  useToggleBranchStatusMutation,
  useUpdateBranchSettingsMutation,
  useResetDemoDataMutation,
  useGetProductCatalogueQuery,
  useGetInvoicesQuery,
  useGetInvoiceByIdQuery,
  useGetDashboardKPIsQuery,
  useGetSalesTrendQuery,
  useGetBranchPerformanceQuery,
  useGetTopProductsQuery,
  useGetUsersQuery,
  useGetUserCountsQuery,
  useGetUserByIdQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useToggleUserStatusMutation,
  useGetRolesQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useGetPermissionsCatalogueQuery,
} = erpApi;
