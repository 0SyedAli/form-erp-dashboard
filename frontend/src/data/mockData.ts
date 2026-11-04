import { Branch, Product, User, Invoice } from '@/types';

// In clean production mode, mock/demo arrays are empty.
// Real operational data comes exclusively from the Express / MongoDB Atlas API.
export const DEMO_BRANCHES: Branch[] = [];
export const DEMO_USERS: User[] = [];
export const SHARED_PRODUCT_CATALOGUE: Product[] = [];
export const INITIAL_MOCK_INVOICES: Invoice[] = [];
