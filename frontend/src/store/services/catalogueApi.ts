import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export interface Branch {
  _id?: string;
  id: string;
  name: string;
  code: string;
  shopNumber?: string;
  type?: string;
  city?: string;
  address?: string;
  phone?: string;
  loginId?: string;
  isActive?: boolean;
}

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
  targetBranchId?: string;
}

export interface UpdatePricesRequest {
  id: string;
  listPrice: number;
  purchasePercent?: number;
  purchasePrice?: number;
  retailPercent?: number;
  retailPrice?: number;
  wholesalePercent?: number;
  wholesalePrice?: number;
  distributorPercent?: number;
  distributorPrice?: number;
  reason?: string;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

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

    getBrands: builder.query<Brand[], void>({
      query: () => '/brands',
      transformResponse: (response: ApiResponse<Brand[]>) =>
        (response.data || []).map((b) => ({
          ...b,
          id: b.id || b._id || '',
        })),
      providesTags: ['Brand'],
    }),

    createBrand: builder.mutation<Brand, { name: string; code: string; description?: string }>({
      query: (body) => ({
        url: '/brands',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Brand'],
    }),

    getCategories: builder.query<Category[], { brandId?: string } | void>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params && params.brandId) queryParams.append('brandId', params.brandId);
        const queryStr = queryParams.toString();
        return `/categories${queryStr ? `?${queryStr}` : ''}`;
      },
      transformResponse: (response: ApiResponse<Category[]>) =>
        (response.data || []).map((c) => ({
          ...c,
          id: c.id || c._id || '',
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
      transformResponse: (response: PaginatedResponse<Product>) => ({
        ...response,
        data: (response.data || []).map((p) => ({
          ...p,
          id: p.id || p._id || '',
        })),
      }),
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
      { productId?: string; search?: string; page?: number; limit?: number } | void
    >({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params?.productId) queryParams.append('productId', params.productId);
        if (params?.search) queryParams.append('search', params.search);
        if (params?.page) queryParams.append('page', params.page.toString());
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        const queryStr = queryParams.toString();
        return `/skus${queryStr ? `?${queryStr}` : ''}`;
      },
      transformResponse: (response: PaginatedResponse<ProductVariant>) => ({
        ...response,
        data: (response.data || []).map((v) => ({
          ...v,
          id: v.id || v._id || '',
        })),
      }),
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
      invalidatesTags: ['Variant', 'PriceHistory'],
    }),

    getSkuPriceHistory: builder.query<ApiResponse<unknown[]>, string>({
      query: (skuId) => `/skus/${skuId}/prices`,
      providesTags: ['PriceHistory'],
    }),
  }),
});

export const {
  useGetBranchesQuery,
  useGetBrandsQuery,
  useCreateBrandMutation,
  useGetCategoriesQuery,
  useCreateCategoryMutation,
  useGetSizesQuery,
  useCreateSizeMutation,
  useGetThicknessesQuery,
  useCreateThicknessMutation,
  useGetProductsQuery,
  useCreateProductWithVariantMutation,
  useGetSkusQuery,
  useUpdateSkuPricesMutation,
  useGetSkuPriceHistoryQuery,
} = catalogueApi;

