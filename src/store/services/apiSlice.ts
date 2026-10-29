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
  Permission,
  Brand,
  Category,
  MattressSize,
  MattressThickness,
  CatalogueProduct,
  ProductVariant,
  PricingHistoryRecord,
  CatalogueItemStatus,
  StockLocation,
  InventoryBalance,
  StockMovement,
  StockTransfer,
  StockCount,
  StockAdjustmentInput,
  StockReceivingInput,
  OpeningStockInput,
  HeldSale,
  POSSettings,
  POSCheckoutInput,
  POSCheckoutResult,
  Customer,
  CustomerLedgerEntry,
  PaymentCollection,
  CustomerAdvance,
  PriceListItem,
  PriceListType,
} from '@/types';
import { SHARED_PRODUCT_CATALOGUE } from '@/data/mockData';
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
  brandsRepository,
  categoriesRepository,
  sizesRepository,
  thicknessRepository,
  productsRepository,
  variantsRepository,
  pricingRepository,
  stockLocationsRepository,
  stockMovementsRepository,
  inventoryRepository,
  stockTransfersRepository,
  stockCountsRepository,
  salesRepository,
  heldSalesRepository,
  CreateHeldSaleDTO,
  posSettingsRepository,
  InventoryDashboardKPIs,
  CreateBrandDTO,
  UpdateBrandDTO,
  BrandFilterOptions,
  CreateCategoryDTO,
  UpdateCategoryDTO,
  CategoryFilterOptions,
  CreateSizeDTO,
  UpdateSizeDTO,
  SizeFilterOptions,
  CreateThicknessDTO,
  UpdateThicknessDTO,
  ThicknessFilterOptions,
  CreateCatalogueProductDTO,
  UpdateCatalogueProductDTO,
  ProductFilterOptions,
  CreateVariantDTO,
  UpdateVariantDTO,
  VariantFilterOptions,
  GenerateVariantsDTO,
  UpdatePricingDTO,
  BulkUpdatePricingDTO,
  customersRepository,
  CreateCustomerDTO,
  UpdateCustomerDTO,
  CustomerFilterOptions,
  customerLedgerRepository,
  CreateLedgerEntryDTO,
  collectionsRepository,
  CreatePaymentCollectionDTO,
  CollectionFilterOptions,
  priceListsRepository,
} from '@/lib/demo-db';

// Simulated latency helper for realistic demo feedback
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const erpApi = createApi({
  reducerPath: 'erpApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: [
    'Invoices',
    'KPIs',
    'Branches',
    'Products',
    'Users',
    'Roles',
    'Brands',
    'Categories',
    'Sizes',
    'Thickness',
    'CatalogueProducts',
    'Variants',
    'PricingHistory',
    'InventoryBalances',
    'StockLocations',
    'StockMovements',
    'StockTransfers',
    'StockCounts',
    'HeldSales',
    'POSSettings',
    'Customers',
    'CustomerLedger',
    'PaymentCollections',
    'PriceLists',
    'CustomerAdvances',
  ],
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
          brandsRepository.resetToSeed();
          categoriesRepository.resetToSeed();
          sizesRepository.resetToSeed();
          thicknessRepository.resetToSeed();
          productsRepository.resetToSeed();
          variantsRepository.resetToSeed();
          pricingRepository.resetToSeed();
          stockLocationsRepository.resetToSeed();
          stockMovementsRepository.resetToSeed();
          inventoryRepository.resetToSeed();
          stockTransfersRepository.resetToSeed();
          stockCountsRepository.resetToSeed();
          salesRepository.resetToSeed();
          heldSalesRepository.resetToSeed();
          posSettingsRepository.resetToSeed();
          customersRepository.resetToSeed();
          customerLedgerRepository.resetToSeed();
          collectionsRepository.resetToSeed();
          priceListsRepository.resetToSeed();
          return { data: { success: true, branches: resetBranches } };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      invalidatesTags: [
        'Branches',
        'KPIs',
        'Invoices',
        'Products',
        'Users',
        'Roles',
        'Brands',
        'Categories',
        'Sizes',
        'Thickness',
        'CatalogueProducts',
        'Variants',
        'PricingHistory',
        'InventoryBalances',
        'StockLocations',
        'StockMovements',
        'StockTransfers',
        'StockCounts',
        'HeldSales',
        'POSSettings',
        'Customers',
        'CustomerLedger',
        'PaymentCollections',
        'PriceLists',
        'CustomerAdvances',
      ],
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
        const allInvoices = salesRepository.getAll();
        const filtered = filterInvoices(allInvoices, {
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
        const invoice = salesRepository.getById(id);
        if (!invoice) {
          return { error: { status: 404, data: 'Invoice not found' } };
        }
        return { data: invoice };
      },
      providesTags: (_res, _err, id) => [{ type: 'Invoices', id }],
    }),

    getDashboardKPIs: builder.query<DashboardKPIs, Partial<FilterState>>({
      async queryFn(filter) {
        await delay(100);
        const allInvoices = salesRepository.getAll();
        const filtered = filterInvoices(allInvoices, {
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
      providesTags: ['KPIs', 'Invoices'],
    }),

    getSalesTrend: builder.query<SalesTrendDataPoint[], Partial<FilterState>>({
      async queryFn(filter) {
        await delay(120);
        const allInvoices = salesRepository.getAll();
        const filtered = filterInvoices(allInvoices, {
          branchId: filter?.branchId,
          dateRange: filter?.dateRange,
          startDate: filter?.startDate,
          endDate: filter?.endDate,
        });
        const trend = calculateSalesTrend(filtered);
        return { data: trend };
      },
      providesTags: ['KPIs', 'Invoices'],
    }),

    getBranchPerformance: builder.query<BranchPerformanceMetric[], Partial<FilterState>>({
      async queryFn(filter) {
        await delay(100);
        const branches = branchesRepository.getAll();
        const allInvoices = salesRepository.getAll();
        const filtered = filterInvoices(allInvoices, {
          dateRange: filter?.dateRange,
          startDate: filter?.startDate,
          endDate: filter?.endDate,
        });
        const performance = calculateBranchPerformance(branches, filtered);
        return { data: performance };
      },
      providesTags: ['KPIs', 'Branches', 'Invoices'],
    }),

    getTopProducts: builder.query<TopProductMetric[], { branchId?: string }>({
      async queryFn({ branchId }) {
        await delay(100);
        const allInvoices = salesRepository.getAll();
        const filtered = filterInvoices(allInvoices, {
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
      providesTags: ['Products', 'Invoices'],
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

    // --- Flow 04: Brand Endpoints ---
    getBrands: builder.query<Brand[], BrandFilterOptions | void>({
      async queryFn(filter) {
        await delay(50);
        try {
          const data = brandsRepository.getAll(filter || undefined);
          return { data };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: 'Brands' as const, id })), { type: 'Brands', id: 'LIST' }]
          : [{ type: 'Brands', id: 'LIST' }],
    }),

    getBrandById: builder.query<Brand | null, string>({
      async queryFn(id) {
        await delay(40);
        try {
          const brand = brandsRepository.getById(id);
          if (!brand) return { error: { status: 404, data: `Brand with ID "${id}" not found.` } };
          return { data: brand };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: (_result, _error, id) => [{ type: 'Brands', id }],
    }),

    createBrand: builder.mutation<Brand, CreateBrandDTO>({
      async queryFn(input) {
        await delay(80);
        try {
          const created = brandsRepository.create(input);
          return { data: created };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: [{ type: 'Brands', id: 'LIST' }],
    }),

    updateBrand: builder.mutation<Brand, { id: string; input?: UpdateBrandDTO } & Partial<UpdateBrandDTO>>({
      async queryFn(args) {
        await delay(80);
        try {
          const id = args.id;
          const input: UpdateBrandDTO = args.input ? args.input : args;
          const updated = brandsRepository.update(id, input);
          return { data: updated };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Brands', id },
        { type: 'Brands', id: 'LIST' },
        { type: 'Categories', id: 'LIST' },
        { type: 'CatalogueProducts', id: 'LIST' },
        { type: 'Variants', id: 'LIST' },
      ],
    }),

    toggleBrandStatus: builder.mutation<Brand, string | { id: string; status?: CatalogueItemStatus }>({
      async queryFn(arg) {
        await delay(60);
        try {
          const id = typeof arg === 'string' ? arg : arg.id;
          const status = typeof arg === 'object' && arg.status ? (arg.status as CatalogueItemStatus) : undefined;
          const updated = brandsRepository.toggleStatus(id, status);
          return { data: updated };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: (_result, _error, arg) => {
        const id = typeof arg === 'string' ? arg : arg.id;
        return [
          { type: 'Brands', id },
          { type: 'Brands', id: 'LIST' },
          { type: 'CatalogueProducts', id: 'LIST' },
          { type: 'Variants', id: 'LIST' },
        ];
      },
    }),

    // --- Flow 04: Category Endpoints ---
    getCategories: builder.query<Category[], CategoryFilterOptions | void>({
      async queryFn(filter) {
        await delay(50);
        try {
          const data = categoriesRepository.getAll(filter || undefined);
          return { data };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: 'Categories' as const, id })), { type: 'Categories', id: 'LIST' }]
          : [{ type: 'Categories', id: 'LIST' }],
    }),

    getCategoriesByBrand: builder.query<Category[], string>({
      async queryFn(brandId) {
        await delay(40);
        try {
          const data = categoriesRepository.getByBrand(brandId);
          return { data };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: [{ type: 'Categories', id: 'LIST' }],
    }),

    getCategoryById: builder.query<Category | null, string>({
      async queryFn(id) {
        await delay(40);
        try {
          const cat = categoriesRepository.getById(id);
          if (!cat) return { error: { status: 404, data: `Category with ID "${id}" not found.` } };
          return { data: cat };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: (_result, _error, id) => [{ type: 'Categories', id }],
    }),

    createCategory: builder.mutation<Category, CreateCategoryDTO>({
      async queryFn(input) {
        await delay(80);
        try {
          const created = categoriesRepository.create(input);
          return { data: created };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: [{ type: 'Categories', id: 'LIST' }],
    }),

    updateCategory: builder.mutation<Category, { id: string; input?: UpdateCategoryDTO } & Partial<UpdateCategoryDTO>>({
      async queryFn(args) {
        await delay(80);
        try {
          const id = args.id;
          const input: UpdateCategoryDTO = args.input ? args.input : args;
          const updated = categoriesRepository.update(id, input);
          return { data: updated };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Categories', id },
        { type: 'Categories', id: 'LIST' },
        { type: 'CatalogueProducts', id: 'LIST' },
        { type: 'Variants', id: 'LIST' },
      ],
    }),

    toggleCategoryStatus: builder.mutation<Category, string | { id: string; status?: CatalogueItemStatus }>({
      async queryFn(arg) {
        await delay(60);
        try {
          const id = typeof arg === 'string' ? arg : arg.id;
          const status = typeof arg === 'object' && arg.status ? (arg.status as CatalogueItemStatus) : undefined;
          const updated = categoriesRepository.toggleStatus(id, status);
          return { data: updated };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: (_result, _error, arg) => {
        const id = typeof arg === 'string' ? arg : arg.id;
        return [
          { type: 'Categories', id },
          { type: 'Categories', id: 'LIST' },
          { type: 'CatalogueProducts', id: 'LIST' },
          { type: 'Variants', id: 'LIST' },
        ];
      },
    }),

    // --- Flow 04: Size Endpoints ---
    getSizes: builder.query<MattressSize[], SizeFilterOptions | void>({
      async queryFn(filter) {
        await delay(40);
        try {
          const data = sizesRepository.getAll(filter || undefined);
          return { data };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: 'Sizes' as const, id })), { type: 'Sizes', id: 'LIST' }]
          : [{ type: 'Sizes', id: 'LIST' }],
    }),

    getSizeById: builder.query<MattressSize | null, string>({
      async queryFn(id) {
        await delay(30);
        try {
          const size = sizesRepository.getById(id);
          if (!size) return { error: { status: 404, data: `Size "${id}" not found.` } };
          return { data: size };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: (_result, _error, id) => [{ type: 'Sizes', id }],
    }),

    createSize: builder.mutation<MattressSize, CreateSizeDTO>({
      async queryFn(input) {
        await delay(80);
        try {
          const created = sizesRepository.create(input);
          return { data: created };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: [{ type: 'Sizes', id: 'LIST' }],
    }),

    updateSize: builder.mutation<MattressSize, { id: string; input?: UpdateSizeDTO } & Partial<UpdateSizeDTO>>({
      async queryFn(args) {
        await delay(80);
        try {
          const id = args.id;
          const input: UpdateSizeDTO = args.input ? args.input : args;
          const updated = sizesRepository.update(id, input);
          return { data: updated };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Sizes', id },
        { type: 'Sizes', id: 'LIST' },
        { type: 'Variants', id: 'LIST' },
      ],
    }),

    toggleSizeStatus: builder.mutation<MattressSize, string | { id: string; status?: CatalogueItemStatus }>({
      async queryFn(arg) {
        await delay(60);
        try {
          const id = typeof arg === 'string' ? arg : arg.id;
          const status = typeof arg === 'object' && arg.status ? (arg.status as CatalogueItemStatus) : undefined;
          const updated = sizesRepository.toggleStatus(id, status);
          return { data: updated };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: (_result, _error, arg) => {
        const id = typeof arg === 'string' ? arg : arg.id;
        return [
          { type: 'Sizes', id },
          { type: 'Sizes', id: 'LIST' },
          { type: 'Variants', id: 'LIST' },
        ];
      },
    }),

    // --- Flow 04: Thickness Endpoints ---
    getThicknesses: builder.query<MattressThickness[], ThicknessFilterOptions | void>({
      async queryFn(filter) {
        await delay(40);
        try {
          const data = thicknessRepository.getAll(filter || undefined);
          return { data };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: 'Thickness' as const, id })), { type: 'Thickness', id: 'LIST' }]
          : [{ type: 'Thickness', id: 'LIST' }],
    }),

    getThicknessById: builder.query<MattressThickness | null, string>({
      async queryFn(id) {
        await delay(30);
        try {
          const item = thicknessRepository.getById(id);
          if (!item) return { error: { status: 404, data: `Thickness "${id}" not found.` } };
          return { data: item };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: (_result, _error, id) => [{ type: 'Thickness', id }],
    }),

    createThickness: builder.mutation<MattressThickness, CreateThicknessDTO>({
      async queryFn(input) {
        await delay(80);
        try {
          const created = thicknessRepository.create(input);
          return { data: created };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: [{ type: 'Thickness', id: 'LIST' }],
    }),

    updateThickness: builder.mutation<MattressThickness, { id: string; input?: UpdateThicknessDTO } & Partial<UpdateThicknessDTO>>({
      async queryFn(args) {
        await delay(80);
        try {
          const id = args.id;
          const input: UpdateThicknessDTO = args.input ? args.input : args;
          const updated = thicknessRepository.update(id, input);
          return { data: updated };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Thickness', id },
        { type: 'Thickness', id: 'LIST' },
        { type: 'Variants', id: 'LIST' },
      ],
    }),

    toggleThicknessStatus: builder.mutation<MattressThickness, string | { id: string; status?: CatalogueItemStatus }>({
      async queryFn(arg) {
        await delay(60);
        try {
          const id = typeof arg === 'string' ? arg : arg.id;
          const status = typeof arg === 'object' && arg.status ? (arg.status as CatalogueItemStatus) : undefined;
          const updated = thicknessRepository.toggleStatus(id, status);
          return { data: updated };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: (_result, _error, arg) => {
        const id = typeof arg === 'string' ? arg : arg.id;
        return [
          { type: 'Thickness', id },
          { type: 'Thickness', id: 'LIST' },
          { type: 'Variants', id: 'LIST' },
        ];
      },
    }),

    // --- Flow 04: Master Catalogue Products Endpoints ---
    getCatalogueProducts: builder.query<CatalogueProduct[], ProductFilterOptions | void>({
      async queryFn(filter) {
        await delay(60);
        try {
          const data = productsRepository.getAll(filter || undefined);
          return { data };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: 'CatalogueProducts' as const, id })), { type: 'CatalogueProducts', id: 'LIST' }]
          : [{ type: 'CatalogueProducts', id: 'LIST' }],
    }),

    getCatalogueProductById: builder.query<CatalogueProduct | null, string>({
      async queryFn(id) {
        await delay(40);
        try {
          const product = productsRepository.getById(id);
          if (!product) return { error: { status: 404, data: `Product with ID "${id}" not found.` } };
          return { data: product };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: (_result, _error, id) => [{ type: 'CatalogueProducts', id }],
    }),

    createCatalogueProduct: builder.mutation<CatalogueProduct, CreateCatalogueProductDTO>({
      async queryFn(input) {
        await delay(100);
        try {
          const created = productsRepository.create(input);
          return { data: created };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: [{ type: 'CatalogueProducts', id: 'LIST' }],
    }),

    updateCatalogueProduct: builder.mutation<CatalogueProduct, { id: string; input?: UpdateCatalogueProductDTO } & Partial<UpdateCatalogueProductDTO>>({
      async queryFn(args) {
        await delay(100);
        try {
          const id = args.id;
          const input: UpdateCatalogueProductDTO = args.input ? args.input : args;
          const updated = productsRepository.update(id, input);
          return { data: updated };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'CatalogueProducts', id },
        { type: 'CatalogueProducts', id: 'LIST' },
        { type: 'Variants', id: 'LIST' },
      ],
    }),

    toggleCatalogueProductStatus: builder.mutation<CatalogueProduct, string | { id: string; status?: CatalogueItemStatus }>({
      async queryFn(arg) {
        await delay(60);
        try {
          const id = typeof arg === 'string' ? arg : arg.id;
          const status = typeof arg === 'object' && arg.status ? (arg.status as CatalogueItemStatus) : undefined;
          const updated = productsRepository.toggleStatus(id, status);
          return { data: updated };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: (_result, _error, arg) => {
        const id = typeof arg === 'string' ? arg : arg.id;
        return [
          { type: 'CatalogueProducts', id },
          { type: 'CatalogueProducts', id: 'LIST' },
          { type: 'Variants', id: 'LIST' },
        ];
      },
    }),

    // --- Flow 04: Product Variants Endpoints ---
    getProductVariants: builder.query<ProductVariant[], VariantFilterOptions | void>({
      async queryFn(filter) {
        await delay(60);
        try {
          const data = variantsRepository.getAll(filter || undefined);
          return { data };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: 'Variants' as const, id })), { type: 'Variants', id: 'LIST' }]
          : [{ type: 'Variants', id: 'LIST' }],
    }),

    getVariantById: builder.query<ProductVariant | null, string>({
      async queryFn(id) {
        await delay(40);
        try {
          const variant = variantsRepository.getById(id);
          if (!variant) return { error: { status: 404, data: `Variant "${id}" not found.` } };
          return { data: variant };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: (_result, _error, id) => [{ type: 'Variants', id }],
    }),

    getVariantsByProduct: builder.query<ProductVariant[], string>({
      async queryFn(productId) {
        await delay(50);
        try {
          const data = variantsRepository.getByProduct(productId);
          return { data };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: [{ type: 'Variants', id: 'LIST' }],
    }),

    createVariant: builder.mutation<ProductVariant, CreateVariantDTO>({
      async queryFn(input) {
        await delay(90);
        try {
          const created = variantsRepository.create(input);
          return { data: created };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: [{ type: 'Variants', id: 'LIST' }, { type: 'CatalogueProducts', id: 'LIST' }],
    }),

    generateVariants: builder.mutation<ProductVariant[], GenerateVariantsDTO>({
      async queryFn(input) {
        await delay(120);
        try {
          const created = variantsRepository.bulkGenerate(input);
          return { data: created };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: [{ type: 'Variants', id: 'LIST' }, { type: 'CatalogueProducts', id: 'LIST' }],
    }),

    updateVariant: builder.mutation<ProductVariant, { id: string; input?: UpdateVariantDTO } & Partial<UpdateVariantDTO>>({
      async queryFn(args) {
        await delay(80);
        try {
          const id = args.id;
          const input: UpdateVariantDTO = args.input ? args.input : args;
          const updated = variantsRepository.update(id, input);
          return { data: updated };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Variants', id },
        { type: 'Variants', id: 'LIST' },
      ],
    }),

    toggleVariantStatus: builder.mutation<ProductVariant, string | { id: string; status?: CatalogueItemStatus }>({
      async queryFn(arg) {
        await delay(60);
        try {
          const id = typeof arg === 'string' ? arg : arg.id;
          const status = typeof arg === 'object' && arg.status ? (arg.status as CatalogueItemStatus) : undefined;
          const updated = variantsRepository.toggleStatus(id, status);
          return { data: updated };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: (_result, _error, arg) => {
        const id = typeof arg === 'string' ? arg : arg.id;
        return [
          { type: 'Variants', id },
          { type: 'Variants', id: 'LIST' },
        ];
      },
    }),

    // --- Flow 04: Pricing Endpoints ---
    updateVariantPricing: builder.mutation<
      ProductVariant,
      UpdatePricingDTO
    >({
      async queryFn(input) {
        await delay(90);
        try {
          const res = pricingRepository.updatePrice(input);
          return { data: res.variant };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: [
        { type: 'Variants', id: 'LIST' },
        { type: 'PricingHistory', id: 'LIST' },
      ],
    }),

    bulkUpdatePricing: builder.mutation<
      ProductVariant[],
      BulkUpdatePricingDTO
    >({
      async queryFn(input) {
        await delay(120);
        try {
          pricingRepository.bulkUpdate(input);
          const updated = input.updates.map((u) => variantsRepository.getById(u.variantId)!).filter(Boolean);
          return { data: updated };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: [
        { type: 'Variants', id: 'LIST' },
        { type: 'PricingHistory', id: 'LIST' },
      ],
    }),

    getPricingHistory: builder.query<PricingHistoryRecord[], string | void>({
      async queryFn(variantId) {
        await delay(40);
        try {
          const data = pricingRepository.getHistory(variantId || undefined);
          return { data };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: [{ type: 'PricingHistory', id: 'LIST' }],
    }),

    getPricingSummary: builder.query<
      { totalVariants: number; avgRetail: number; avgWholesale: number; minRetail: number; maxRetail: number },
      void
    >({
      async queryFn() {
        await delay(40);
        try {
          const summary = pricingRepository.getPricingSummary();
          return { data: summary };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: [{ type: 'Variants', id: 'LIST' }, { type: 'PricingHistory', id: 'LIST' }],
    }),

    // -----------------------------------------------------------------------
    // Flow 05: Inventory, Locations, Movements, Transfers & Counting Endpoints
    // -----------------------------------------------------------------------

    getInventoryBalances: builder.query<
      InventoryBalance[],
      Parameters<typeof inventoryRepository.getAll>[0] | void
    >({
      async queryFn(filter) {
        await delay(50);
        try {
          const data = inventoryRepository.getAll(filter || undefined);
          return { data };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: ['InventoryBalances'],
    }),

    getInventoryDashboardKPIs: builder.query<InventoryDashboardKPIs, string | void>({
      async queryFn(branchId) {
        await delay(60);
        try {
          const data = inventoryRepository.getDashboardKPIs(branchId || undefined);
          return { data };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: ['InventoryBalances', 'StockMovements', 'StockTransfers'],
    }),

    getStockLocations: builder.query<
      StockLocation[],
      Parameters<typeof stockLocationsRepository.getAll>[0] | void
    >({
      async queryFn(filter) {
        await delay(40);
        try {
          const data = stockLocationsRepository.getAll(filter || undefined);
          return { data };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: ['StockLocations'],
    }),

    createStockLocation: builder.mutation<
      StockLocation,
      Parameters<typeof stockLocationsRepository.create>[0]
    >({
      async queryFn(dto) {
        await delay(80);
        try {
          const data = stockLocationsRepository.create(dto);
          return { data };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: ['StockLocations', 'InventoryBalances'],
    }),

    updateStockLocation: builder.mutation<
      StockLocation,
      { id: string; dto: Parameters<typeof stockLocationsRepository.update>[1] }
    >({
      async queryFn({ id, dto }) {
        await delay(80);
        try {
          const data = stockLocationsRepository.update(id, dto);
          return { data };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: ['StockLocations', 'InventoryBalances'],
    }),

    getStockMovements: builder.query<
      StockMovement[],
      Parameters<typeof stockMovementsRepository.getAll>[0] | void
    >({
      async queryFn(filter) {
        await delay(50);
        try {
          const data = stockMovementsRepository.getAll(filter || undefined);
          return { data };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: ['StockMovements'],
    }),

    receiveStock: builder.mutation<
      { receiptNumber: string; updatedBalances: InventoryBalance[]; movements: StockMovement[] },
      StockReceivingInput
    >({
      async queryFn(input) {
        await delay(120);
        try {
          const data = inventoryRepository.receiveStock(input);
          return { data };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: ['InventoryBalances', 'StockMovements', 'KPIs'],
    }),

    createOpeningStock: builder.mutation<
      { referenceNumber: string; updatedBalances: InventoryBalance[]; movements: StockMovement[] },
      OpeningStockInput
    >({
      async queryFn(input) {
        await delay(120);
        try {
          const data = inventoryRepository.createOpeningStock(input);
          return { data };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: ['InventoryBalances', 'StockMovements', 'KPIs'],
    }),

    adjustStock: builder.mutation<
      { adjustmentId: string; updatedBalance: InventoryBalance; movement: StockMovement },
      StockAdjustmentInput
    >({
      async queryFn(input) {
        await delay(100);
        try {
          const data = inventoryRepository.adjustStock(input);
          return { data };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: ['InventoryBalances', 'StockMovements', 'KPIs'],
    }),

    setReorderLevel: builder.mutation<
      InventoryBalance,
      { stockLocationId: string; sku: string; reorderLevel: number }
    >({
      async queryFn({ stockLocationId, sku, reorderLevel }) {
        await delay(80);
        try {
          const data = inventoryRepository.setReorderLevel(stockLocationId, sku, reorderLevel);
          return { data };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: ['InventoryBalances'],
    }),

    getStockTransfers: builder.query<
      StockTransfer[],
      Parameters<typeof stockTransfersRepository.getAll>[0] | void
    >({
      async queryFn(filter) {
        await delay(50);
        try {
          const data = stockTransfersRepository.getAll(filter || undefined);
          return { data };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: ['StockTransfers'],
    }),

    getStockTransferById: builder.query<StockTransfer | undefined, string>({
      async queryFn(id) {
        await delay(40);
        try {
          const data = stockTransfersRepository.getById(id);
          return { data };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: ['StockTransfers'],
    }),

    createStockTransfer: builder.mutation<
      StockTransfer,
      Parameters<typeof stockTransfersRepository.createTransfer>[0]
    >({
      async queryFn(dto) {
        await delay(100);
        try {
          const data = stockTransfersRepository.createTransfer(dto);
          return { data };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: ['StockTransfers'],
    }),

    approveStockTransfer: builder.mutation<
      StockTransfer,
      { transferId: string; approvedBy: string }
    >({
      async queryFn({ transferId, approvedBy }) {
        await delay(90);
        try {
          const data = stockTransfersRepository.approveTransfer(transferId, approvedBy);
          return { data };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: ['StockTransfers'],
    }),

    dispatchStockTransfer: builder.mutation<
      StockTransfer,
      {
        transferId: string;
        dispatchedBy: string;
        itemDispatches?: Array<{ sku: string; dispatchedQuantity: number }>;
      }
    >({
      async queryFn({ transferId, dispatchedBy, itemDispatches }) {
        await delay(120);
        try {
          const data = stockTransfersRepository.dispatchTransfer(
            transferId,
            dispatchedBy,
            itemDispatches
          );
          return { data };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: ['StockTransfers', 'InventoryBalances', 'StockMovements', 'KPIs'],
    }),

    receiveStockTransfer: builder.mutation<
      StockTransfer,
      {
        transferId: string;
        receivedBy: string;
        itemReceipts?: Array<{ sku: string; receivedQuantity: number }>;
      }
    >({
      async queryFn({ transferId, receivedBy, itemReceipts }) {
        await delay(120);
        try {
          const data = stockTransfersRepository.receiveTransfer(
            transferId,
            receivedBy,
            itemReceipts
          );
          return { data };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: ['StockTransfers', 'InventoryBalances', 'StockMovements', 'KPIs'],
    }),

    cancelStockTransfer: builder.mutation<
      StockTransfer,
      { transferId: string; cancelledBy: string; cancellationReason: string }
    >({
      async queryFn({ transferId, cancelledBy, cancellationReason }) {
        await delay(100);
        try {
          const data = stockTransfersRepository.cancelTransfer(
            transferId,
            cancelledBy,
            cancellationReason
          );
          return { data };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: ['StockTransfers', 'InventoryBalances', 'StockMovements', 'KPIs'],
    }),

    getStockCounts: builder.query<
      StockCount[],
      Parameters<typeof stockCountsRepository.getAll>[0] | void
    >({
      async queryFn(filter) {
        await delay(50);
        try {
          const data = stockCountsRepository.getAll(filter || undefined);
          return { data };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: ['StockCounts'],
    }),

    getStockCountById: builder.query<StockCount | undefined, string>({
      async queryFn(id) {
        await delay(40);
        try {
          const data = stockCountsRepository.getById(id);
          return { data };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: ['StockCounts'],
    }),

    createStockCount: builder.mutation<
      StockCount,
      Parameters<typeof stockCountsRepository.createStockCount>[0]
    >({
      async queryFn(dto) {
        await delay(90);
        try {
          const data = stockCountsRepository.createStockCount(dto);
          return { data };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: ['StockCounts'],
    }),

    updateStockCountItems: builder.mutation<
      StockCount,
      { countId: string; itemUpdates: Array<{ sku: string; physicalQuantity: number; notes?: string }> }
    >({
      async queryFn({ countId, itemUpdates }) {
        await delay(80);
        try {
          const data = stockCountsRepository.updateCountItems(countId, itemUpdates);
          return { data };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: ['StockCounts'],
    }),

    reconcileAndPostStockCount: builder.mutation<
      { count: StockCount; movements: StockMovement[] },
      { countId: string; approvedBy: string }
    >({
      async queryFn({ countId, approvedBy }) {
        await delay(140);
        try {
          const data = stockCountsRepository.reconcileAndPostCount(countId, approvedBy);
          return { data };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: ['StockCounts', 'InventoryBalances', 'StockMovements', 'KPIs'],
    }),

    // --- Flow 06: Retail POS Endpoints ---
    getPOSSettings: builder.query<POSSettings, void>({
      async queryFn() {
        await delay(50);
        try {
          const data = posSettingsRepository.getSettings();
          return { data };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: ['POSSettings'],
    }),

    updatePOSSettings: builder.mutation<POSSettings, Partial<POSSettings>>({
      async queryFn(input) {
        await delay(60);
        try {
          const data = posSettingsRepository.updateSettings(input);
          return { data };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: ['POSSettings'],
    }),

    getHeldSales: builder.query<HeldSale[], { branchId?: string } | void>({
      async queryFn(arg) {
        await delay(60);
        try {
          const data = heldSalesRepository.getAll(arg?.branchId);
          return { data };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: ['HeldSales'],
    }),

    holdSale: builder.mutation<HeldSale, CreateHeldSaleDTO>({
      async queryFn(input) {
        await delay(80);
        try {
          const data = heldSalesRepository.holdSale(input);
          return { data };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: ['HeldSales'],
    }),

    deleteHeldSale: builder.mutation<{ success: boolean }, string>({
      async queryFn(id) {
        await delay(50);
        try {
          const success = heldSalesRepository.deleteHeldSale(id);
          return { data: { success } };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: ['HeldSales'],
    }),

    completePOSCheckout: builder.mutation<POSCheckoutResult, POSCheckoutInput>({
      async queryFn(input) {
        await delay(120);
        try {
          const data = salesRepository.createSale(input);
          return { data };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: [
        'Invoices',
        'KPIs',
        'InventoryBalances',
        'StockMovements',
        'HeldSales',
        'Customers',
        'CustomerLedger',
      ],
    }),

    // Flow 07 Customers Endpoints
    getCustomers: builder.query<Customer[], CustomerFilterOptions | void>({
      async queryFn(filter) {
        await delay(80);
        try {
          const data = customersRepository.getAll(filter || undefined);
          return { data };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Customers' as const, id })),
              { type: 'Customers', id: 'LIST' },
            ]
          : [{ type: 'Customers', id: 'LIST' }],
    }),

    getCustomerById: builder.query<Customer | null, string>({
      async queryFn(id) {
        await delay(50);
        try {
          const data = customersRepository.getById(id);
          return { data };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: (_res, _err, id) => [{ type: 'Customers', id }],
    }),

    createCustomer: builder.mutation<Customer, CreateCustomerDTO>({
      async queryFn(dto) {
        await delay(100);
        try {
          const data = customersRepository.create(dto);
          return { data };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: [{ type: 'Customers', id: 'LIST' }, 'CustomerLedger'],
    }),

    updateCustomer: builder.mutation<Customer, { id: string; data: UpdateCustomerDTO }>({
      async queryFn({ id, data: updateData }) {
        await delay(90);
        try {
          const data = customersRepository.update(id, updateData);
          return { data };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Customers', id },
        { type: 'Customers', id: 'LIST' },
      ],
    }),

    toggleCustomerStatus: builder.mutation<Customer, { id: string; status: 'ACTIVE' | 'INACTIVE' }>({
      async queryFn({ id, status }) {
        await delay(70);
        try {
          const data = customersRepository.update(id, { status });
          return { data };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Customers', id },
        { type: 'Customers', id: 'LIST' },
      ],
    }),

    // Flow 07 Customer Ledger Endpoints
    getCustomerLedger: builder.query<CustomerLedgerEntry[], string>({
      async queryFn(customerId) {
        await delay(80);
        try {
          const data = customerLedgerRepository.getByCustomerId(customerId);
          return { data };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: (_res, _err, customerId) => [
        { type: 'CustomerLedger', id: customerId },
        { type: 'CustomerLedger', id: 'LIST' },
      ],
    }),

    addCustomerLedgerEntry: builder.mutation<CustomerLedgerEntry, CreateLedgerEntryDTO>({
      async queryFn(dto) {
        await delay(100);
        try {
          const data = customerLedgerRepository.addEntry(dto);
          return { data };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: (_res, _err, { customerId }) => [
        { type: 'CustomerLedger', id: customerId },
        { type: 'Customers', id: customerId },
        { type: 'Customers', id: 'LIST' },
      ],
    }),

    // Flow 07 Payment Collections Endpoints
    getPaymentCollections: builder.query<PaymentCollection[], CollectionFilterOptions | void>({
      async queryFn(filter) {
        await delay(80);
        try {
          const data = collectionsRepository.getAll(filter || undefined);
          return { data };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: ['PaymentCollections'],
    }),

    createPaymentCollection: builder.mutation<PaymentCollection, CreatePaymentCollectionDTO>({
      async queryFn(dto) {
        await delay(120);
        try {
          const data = collectionsRepository.createCollection(dto);
          return { data };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: [
        'PaymentCollections',
        'Invoices',
        'Customers',
        'CustomerLedger',
        'CustomerAdvances',
        'KPIs',
      ],
    }),

    getCustomerAdvances: builder.query<CustomerAdvance[], { customerId: string }>({
      async queryFn({ customerId }) {
        await delay(50);
        try {
          const data = collectionsRepository.getAdvancesByCustomer(customerId);
          return { data };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: ['CustomerAdvances'],
    }),

    // Flow 07 Price Lists Endpoints
    getPriceLists: builder.query<
      PriceListItem[],
      { priceList?: PriceListType; variantId?: string } | void
    >({
      async queryFn(arg) {
        await delay(60);
        try {
          const data = priceListsRepository.getAll(arg?.priceList, arg?.variantId);
          return { data };
        } catch (error) {
          return { error: { status: 500, data: (error as Error).message } };
        }
      },
      providesTags: ['PriceLists'],
    }),

    setPriceListItem: builder.mutation<
      PriceListItem,
      { priceList: PriceListType; variantId: string; price: number; minQuantity?: number }
    >({
      async queryFn(arg) {
        await delay(80);
        try {
          const data = priceListsRepository.setPrice(
            arg.priceList,
            arg.variantId,
            arg.price,
            arg.minQuantity
          );
          return { data };
        } catch (error) {
          return { error: { status: 400, data: (error as Error).message } };
        }
      },
      invalidatesTags: ['PriceLists', 'Variants', 'PricingHistory'],
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
  // Flow 04 Brands Hooks
  useGetBrandsQuery,
  useGetBrandByIdQuery,
  useCreateBrandMutation,
  useUpdateBrandMutation,
  useToggleBrandStatusMutation,
  // Flow 04 Categories Hooks
  useGetCategoriesQuery,
  useGetCategoriesByBrandQuery,
  useGetCategoryByIdQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useToggleCategoryStatusMutation,
  // Flow 04 Sizes Hooks
  useGetSizesQuery,
  useGetSizeByIdQuery,
  useCreateSizeMutation,
  useUpdateSizeMutation,
  useToggleSizeStatusMutation,
  // Flow 04 Thickness Hooks
  useGetThicknessesQuery,
  useGetThicknessByIdQuery,
  useCreateThicknessMutation,
  useUpdateThicknessMutation,
  useToggleThicknessStatusMutation,
  // Flow 04 Products Hooks
  useGetCatalogueProductsQuery,
  useGetCatalogueProductByIdQuery,
  useCreateCatalogueProductMutation,
  useUpdateCatalogueProductMutation,
  useToggleCatalogueProductStatusMutation,
  // Flow 04 Variants Hooks
  useGetProductVariantsQuery,
  useGetVariantByIdQuery,
  useGetVariantsByProductQuery,
  useCreateVariantMutation,
  useGenerateVariantsMutation,
  useUpdateVariantMutation,
  useToggleVariantStatusMutation,
  // Flow 04 Pricing Hooks
  useUpdateVariantPricingMutation,
  useBulkUpdatePricingMutation,
  useGetPricingHistoryQuery,
  useGetPricingSummaryQuery,
  // Flow 05 Inventory Hooks
  useGetInventoryBalancesQuery,
  useGetInventoryDashboardKPIsQuery,
  useGetStockLocationsQuery,
  useCreateStockLocationMutation,
  useUpdateStockLocationMutation,
  useGetStockMovementsQuery,
  useReceiveStockMutation,
  useCreateOpeningStockMutation,
  useAdjustStockMutation,
  useSetReorderLevelMutation,
  // Flow 05 Transfers Hooks
  useGetStockTransfersQuery,
  useGetStockTransferByIdQuery,
  useCreateStockTransferMutation,
  useApproveStockTransferMutation,
  useDispatchStockTransferMutation,
  useReceiveStockTransferMutation,
  useCancelStockTransferMutation,
  // Flow 05 Counts Hooks
  useGetStockCountsQuery,
  useGetStockCountByIdQuery,
  useCreateStockCountMutation,
  useUpdateStockCountItemsMutation,
  useReconcileAndPostStockCountMutation,
  // Flow 06 POS Hooks
  useGetPOSSettingsQuery,
  useUpdatePOSSettingsMutation,
  useGetHeldSalesQuery,
  useHoldSaleMutation,
  useDeleteHeldSaleMutation,
  useCompletePOSCheckoutMutation,
  // Flow 07 Customers & Credit Hooks
  useGetCustomersQuery,
  useGetCustomerByIdQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useToggleCustomerStatusMutation,
  useGetCustomerLedgerQuery,
  useAddCustomerLedgerEntryMutation,
  useGetPaymentCollectionsQuery,
  useCreatePaymentCollectionMutation,
  useGetCustomerAdvancesQuery,
  useGetPriceListsQuery,
  useSetPriceListItemMutation,
} = erpApi;

// Flow 04 Alias Hook Exports for direct naming consistency
export const useGetProductsQuery = erpApi.useGetCatalogueProductsQuery;
export const useGetProductByIdQuery = erpApi.useGetCatalogueProductByIdQuery;
export const useCreateProductMutation = erpApi.useCreateCatalogueProductMutation;
export const useUpdateProductMutation = erpApi.useUpdateCatalogueProductMutation;
export const useToggleProductStatusMutation = erpApi.useToggleCatalogueProductStatusMutation;

export const useGetVariantsQuery = erpApi.useGetProductVariantsQuery;
export const useGetThicknessQuery = erpApi.useGetThicknessesQuery;
export const useUpdatePricingMutation = erpApi.useUpdateVariantPricingMutation;



