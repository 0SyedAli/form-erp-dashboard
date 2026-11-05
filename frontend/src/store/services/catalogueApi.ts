import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { Branch } from '@/types';
export type { Branch };

export interface Brand {
  _id?: string;
  id: string;
  name: string;
  code: string;
  status: 'ACTIVE' | 'INACTIVE';
  description?: string;
  createdAt?: string;
}

export interface Category {
  _id?: string;
  id: string;
  brandId: string;
  name: string;
  code: string;
  status: 'ACTIVE' | 'INACTIVE';
  description?: string;
  createdAt?: string;
}

export interface Size {
  _id?: string;
  id: string;
  name?: string;
  displayLabel: string;
  length: number;
  width: number;
  unit: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Thickness {
  _id?: string;
  id: string;
  value: number;
  unit: string;
  displayLabel: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface ProductVariant {
  _id?: string;
  id: string;
  productId: string;
  sku: string;
  sizeId: string;
  thicknessId: string;
  size?: Size;
  thickness?: Thickness;
  product?: Product;
  listPrice: number;
  purchasePrice: number;
  retailPrice: number;
  wholesalePrice: number;
  distributorPrice: number;
  purchaseDiscountPercent?: number;
  retailMarkupPercent?: number;
  wholesaleDiscountPercent?: number;
  distributorDiscountPercent?: number;
  status: 'ACTIVE' | 'INACTIVE';
  initialStockCommitted?: boolean;
}

export interface Product {
  _id?: string;
  id: string;
  name: string;
  code: string;
  brandId: string;
  categoryId: string;
  brand?: Brand;
  category?: Category;
  description?: string;
  variantsCount?: number;
  variants?: ProductVariant[];
  status: 'ACTIVE' | 'INACTIVE';
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: PaginationMeta;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface CreateProductRequest {
  brandId: string;
  categoryId: string;
  sizeId: string;
  thicknessId: string;
  listPrice: number;
  purchasePercent?: number;
  purchasePrice?: number;
  retailPercent?: number;
  retailPrice?: number;
  wholesalePercent?: number;
  wholesalePrice?: number;
  distributorPercent?: number;
  distributorPrice?: number;
  initialStock?: number;
  minimumStock?: number;
  stock?: number;
  targetBranchId?: string;
  destinationBranchId?: string;
}

export interface UpdatePricesRequest {
  id: string;
  brandId?: string;
  categoryId?: string;
  sizeId?: string;
  thicknessId?: string;
  listPrice: number;
  purchasePercent?: number;
  purchasePrice?: number;
  retailPercent?: number;
  retailPrice?: number;
  wholesalePercent?: number;
  wholesalePrice?: number;
  distributorPercent?: number;
  distributorPrice?: number;
  stock?: number;
  minimumStock?: number;
  status?: 'ACTIVE' | 'INACTIVE';
  reason?: string;
}

export type UpdateSkuRequest = UpdatePricesRequest;

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

export const catalogueApi = createApi({
  reducerPath: 'catalogueApi',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    credentials: 'include',
  }),
  tagTypes: ['Branch', 'Brand', 'Category', 'Size', 'Thickness', 'Product', 'Variant', 'PriceHistory'],
  endpoints: (builder) => ({
    getBranches: builder.query<Branch[], void>({
      query: () => '/branches',
      transformResponse: (response: ApiResponse<Branch[]>) =>
        (response.data || []).map((b) => ({
          ...b,
          id: b.id || b._id || '',
        })),
      providesTags: ['Branch'],
    }),

    createBranch: builder.mutation<
      Branch,
      {
        name: string;
        code: string;
        shopNumber: string;
        type?: string;
        city?: string;
        address: string;
        phone: string;
        loginId: string;
        password?: string;
        email?: string;
        managerId?: string;
        targetMonthlySales?: number;
        imageUrl?: string;
        settings?: Record<string, boolean>;
      }
    >({
      query: (body) => ({
        url: '/admin/branches',
        method: 'POST',
        body,
      }),
      transformResponse: (response: ApiResponse<Branch>) => response.data,
      invalidatesTags: ['Branch'],
    }),

    getBrands: builder.query<Brand[], void>({
      query: () => '/brands',
      transformResponse: (response: ApiResponse<Brand[]>) =>
        (response.data || []).map((b) => ({
          ...b,
          id: b.id || b._id || '',
        })),
      providesTags: ['Brand'],
    }),

    createBrand: builder.mutation<
      Brand,
      { name: string; code: string; description?: string; logoUrl?: string; logo?: string; status?: string }
    >({
      query: (body) => ({
        url: '/brands',
        method: 'POST',
        body: {
          name: body.name,
          code: body.code,
          description: body.description,
          logoUrl: body.logoUrl || body.logo,
          ...(body.status && { status: body.status }),
        },
      }),
      invalidatesTags: ['Brand'],
    }),

    updateBrand: builder.mutation<
      Brand,
      { id: string; name?: string; code?: string; description?: string; logoUrl?: string; logo?: string; status?: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/brands/${id}`,
        method: 'PATCH',
        body: {
          ...(body.name && { name: body.name }),
          ...(body.code && { code: body.code }),
          ...(body.description !== undefined && { description: body.description }),
          ...(body.logoUrl !== undefined || body.logo !== undefined ? { logoUrl: body.logoUrl || body.logo } : {}),
          ...(body.status && { status: body.status }),
        },
      }),
      invalidatesTags: ['Brand'],
    }),

    toggleBrandStatus: builder.mutation<Brand, { id: string; status: 'ACTIVE' | 'INACTIVE' }>({
      query: ({ id, status }) => ({
        url: `/brands/${id}/status`,
        method: 'PATCH',
        body: { status },
      }),
      invalidatesTags: ['Brand', 'Category', 'Product', 'Variant'],
    }),

    deleteBrand: builder.mutation<ApiResponse<{ deleted: boolean; message: string }>, string>({
      query: (id) => ({
        url: `/brands/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Brand', 'Category', 'Product', 'Variant'],
    }),

    getCategories: builder.query<Category[], { brandId?: string } | void>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params && params.brandId) queryParams.append('brandId', params.brandId);
        const queryStr = queryParams.toString();
        return `/categories${queryStr ? `?${queryStr}` : ''}`;
      },
      transformResponse: (response: ApiResponse<Category[]>) =>
        (response.data || []).map((c: any) => ({
          ...c,
          id: c.id || c._id || '',
          brandId: typeof c.brandId === 'object' && c.brandId !== null
            ? (c.brandId._id || c.brandId.id || '').toString()
            : (c.brandId || '').toString(),
        })),
      providesTags: ['Category'],
    }),

    createCategory: builder.mutation<
      Category,
      { brandId: string; name: string; code: string; description?: string }
    >({
      query: (body) => ({
        url: '/categories',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Category'],
    }),

    toggleCategoryStatus: builder.mutation<Category, { id: string; status: 'ACTIVE' | 'INACTIVE' }>({
      query: ({ id, status }) => ({
        url: `/categories/${id}/status`,
        method: 'PATCH',
        body: { status },
      }),
      invalidatesTags: ['Category', 'Product', 'Variant'],
    }),

    deleteCategory: builder.mutation<ApiResponse<{ deleted: boolean; message: string }>, string>({
      query: (id) => ({
        url: `/categories/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Category', 'Product', 'Variant'],
    }),

    getSizes: builder.query<Size[], void>({
      query: () => '/sizes',
      transformResponse: (response: ApiResponse<Size[]>) =>
        (response.data || []).map((s) => ({
          ...s,
          id: s.id || s._id || '',
        })),
      providesTags: ['Size'],
    }),

    createSize: builder.mutation<
      Size,
      { length: number; width: number; unit?: string; displayLabel?: string }
    >({
      query: (body) => ({
        url: '/sizes',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Size'],
    }),

    toggleSizeStatus: builder.mutation<Size, { id: string; status: 'ACTIVE' | 'INACTIVE' }>({
      query: ({ id, status }) => ({
        url: `/sizes/${id}/status`,
        method: 'PATCH',
        body: { status },
      }),
      invalidatesTags: ['Size', 'Variant'],
    }),

    deleteSize: builder.mutation<ApiResponse<{ deleted: boolean; message: string }>, string>({
      query: (id) => ({
        url: `/sizes/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Size', 'Variant'],
    }),

    getThicknesses: builder.query<Thickness[], void>({
      query: () => '/thicknesses',
      transformResponse: (response: ApiResponse<Thickness[]>) =>
        (response.data || []).map((t) => ({
          ...t,
          id: t.id || t._id || '',
        })),
      providesTags: ['Thickness'],
    }),

    createThickness: builder.mutation<
      Thickness,
      { value: number; unit?: string; displayLabel?: string }
    >({
      query: (body) => ({
        url: '/thicknesses',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Thickness'],
    }),

    toggleThicknessStatus: builder.mutation<Thickness, { id: string; status: 'ACTIVE' | 'INACTIVE' }>({
      query: ({ id, status }) => ({
        url: `/thicknesses/${id}/status`,
        method: 'PATCH',
        body: { status },
      }),
      invalidatesTags: ['Thickness', 'Variant'],
    }),

    deleteThickness: builder.mutation<ApiResponse<{ deleted: boolean; message: string }>, string>({
      query: (id) => ({
        url: `/thicknesses/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Thickness', 'Variant'],
    }),

    getProducts: builder.query<
      PaginatedResponse<Product>,
      { brandId?: string; categoryId?: string; search?: string; page?: number; limit?: number } | void
    >({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params?.brandId) queryParams.append('brandId', params.brandId);
        if (params?.categoryId) queryParams.append('categoryId', params.categoryId);
        if (params?.search) queryParams.append('search', params.search);
        if (params?.page) queryParams.append('page', params.page.toString());
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        const queryStr = queryParams.toString();
        return `/products${queryStr ? `?${queryStr}` : ''}`;
      },
      transformResponse: (response: any) => {
        const rawList = Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.data?.items)
          ? response.data.items
          : Array.isArray(response?.items)
          ? response.items
          : [];
        const pagination = response?.data?.pagination || response?.pagination || {
          total: rawList.length,
          page: 1,
          limit: rawList.length || 20,
          totalPages: 1,
        };
        return {
          success: true,
          data: rawList.map((p: any) => {
            const bId = String(p.brandId?._id || p.brandId || p.brand?._id || p.brand?.id || '');
            const cId = String(p.categoryId?._id || p.categoryId || p.category?._id || p.category?.id || '');
            const bCode = p.brand?.code || 'MF';
            const cCode = p.category?.code || 'CAT';
            return {
              ...p,
              id: p.id || p._id || '',
              brandId: bId,
              categoryId: cId,
              code: p.code || `${bCode}-${cCode}`.toUpperCase(),
            };
          }),
          pagination,
        };
      },
      providesTags: ['Product'],
    }),

    createProductWithVariant: builder.mutation<
      ApiResponse<{ product: Product; variant: ProductVariant; initialStockCommitted?: boolean }>,
      CreateProductRequest
    >({
      query: (body) => ({
        url: '/products',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Product', 'Variant'],
    }),

    getSkus: builder.query<
      PaginatedResponse<ProductVariant>,
      { productId?: string; search?: string; status?: string; page?: number; limit?: number } | void
    >({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params?.productId) queryParams.append('productId', params.productId);
        if (params?.search) queryParams.append('search', params.search);
        if (params?.status) queryParams.append('status', params.status);
        if (params?.page) queryParams.append('page', params.page.toString());
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        const queryStr = queryParams.toString();
        return `/skus${queryStr ? `?${queryStr}` : ''}`;
      },
      transformResponse: (response: any) => {
        const rawList = Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.data?.items)
          ? response.data.items
          : Array.isArray(response?.items)
          ? response.items
          : [];
        const pagination = response?.data?.pagination || response?.pagination || {
          total: rawList.length,
          page: 1,
          limit: rawList.length || 100,
          totalPages: 1,
        };
        return {
          success: true,
          data: rawList.map((v: any) => {
            const pId = String(v.productId?._id || v.productId || v.product?._id || v.product?.id || '');
            const bId = String(v.brandId?._id || v.brandId || v.brand?._id || v.brand?.id || '');
            const cId = String(v.categoryId?._id || v.categoryId || v.category?._id || v.category?.id || '');
            const sId = String(v.sizeId?._id || v.sizeId || v.size?._id || v.size?.id || '');
            const tId = String(v.thicknessId?._id || v.thicknessId || v.thickness?._id || v.thickness?.id || '');
            const retPrice = v.retailPrice || v.walkInPrice || 0;
            return {
              ...v,
              id: v.id || v._id || '',
              productId: pId,
              brandId: bId,
              categoryId: cId,
              sizeId: sId,
              thicknessId: tId,
              retailPrice: retPrice,
              walkInPrice: v.walkInPrice || retPrice,
              stock: v.stock ?? v.onHand ?? 0,
            };
          }),
          pagination,
        };
      },
      providesTags: ['Variant'],
    }),

    updateSkuPrices: builder.mutation<
      ApiResponse<{ variant: ProductVariant; priceHistory: unknown }>,
      UpdatePricesRequest
    >({
      query: ({ id, ...body }) => ({
        url: `/skus/${id}/prices`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Variant', 'Product', 'PriceHistory'],
    }),

    updateSku: builder.mutation<
      ApiResponse<{ variant: ProductVariant; priceHistory: unknown }>,
      UpdateSkuRequest
    >({
      query: ({ id, ...body }) => ({
        url: `/skus/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Variant', 'Product', 'PriceHistory'],
    }),

    toggleSkuStatus: builder.mutation<
      ApiResponse<ProductVariant>,
      { id: string; status: 'ACTIVE' | 'INACTIVE' }
    >({
      query: ({ id, status }) => ({
        url: `/skus/${id}/status`,
        method: 'PATCH',
        body: { status },
      }),
      invalidatesTags: ['Variant', 'Product'],
    }),

    getSkuById: builder.query<
      ApiResponse<ProductVariant & { stock?: number; minimumStock?: number }>,
      string
    >({
      query: (id) => `/skus/${id}`,
      providesTags: ['Variant'],
    }),

    getSkuPriceHistory: builder.query<ApiResponse<unknown[]>, string>({
      query: (skuId) => `/skus/${skuId}/prices`,
      providesTags: ['PriceHistory'],
    }),
  }),
});

export const {
  useGetBranchesQuery,
  useCreateBranchMutation,
  useGetBrandsQuery,
  useCreateBrandMutation,
  useUpdateBrandMutation,
  useToggleBrandStatusMutation,
  useDeleteBrandMutation,
  useGetCategoriesQuery,
  useCreateCategoryMutation,
  useToggleCategoryStatusMutation,
  useDeleteCategoryMutation,
  useGetSizesQuery,
  useCreateSizeMutation,
  useToggleSizeStatusMutation,
  useDeleteSizeMutation,
  useGetThicknessesQuery,
  useCreateThicknessMutation,
  useToggleThicknessStatusMutation,
  useDeleteThicknessMutation,
  useGetProductsQuery,
  useCreateProductWithVariantMutation,
  useGetSkusQuery,
  useGetSkuByIdQuery,
  useUpdateSkuPricesMutation,
  useUpdateSkuMutation,
  useToggleSkuStatusMutation,
  useGetSkuPriceHistoryQuery,
} = catalogueApi;

