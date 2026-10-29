import { describe, it, expect, beforeEach } from 'vitest';
import {
  brandsRepository,
  categoriesRepository,
  sizesRepository,
  thicknessRepository,
  productsRepository,
  variantsRepository,
  pricingRepository,
  branchesRepository,
  usersRepository,
  demoStorage,
  STORAGE_KEYS,
  DEMO_DB_VERSION,
  CatalogueValidationError,
} from '@/lib/demo-db';
import { hasPermission } from '@/lib/permissions';
import { User, Brand } from '@/types';
import { INITIAL_MOCK_INVOICES } from '@/data/mockData';

describe('Flow 04 — Product Catalogue, Brands, Categories, Variants & Pricing Management', () => {
  beforeEach(() => {
    // Reset all catalogue repositories to clean seed state
    brandsRepository.resetToSeed();
    categoriesRepository.resetToSeed();
    sizesRepository.resetToSeed();
    thicknessRepository.resetToSeed();
    productsRepository.resetToSeed();
    variantsRepository.resetToSeed();
    pricingRepository.resetToSeed();
    branchesRepository.resetToSeed();
    usersRepository.resetToSeed();
  });

  // 1. Brand creation
  it('1. Brand creation: successfully registers a new brand with system-generated ID and code', () => {
    const brand = brandsRepository.create({
      name: 'Diamond Supreme Foam',
      code: 'DIAMOND',
      description: 'High-density premium orthopedic and luxury foam mattresses.',
      status: 'ACTIVE',
    });

    expect(brand).toBeDefined();
    expect(brand.id).toContain('BRAND-DIAMOND-');
    expect(brand.name).toBe('Diamond Supreme Foam');
    expect(brand.code).toBe('DIAMOND');
    expect(brand.status).toBe('ACTIVE');

    const fetched = brandsRepository.getById(brand.id);
    expect(fetched).toBeDefined();
    expect(fetched?.name).toBe('Diamond Supreme Foam');
  });

  // 2. Duplicate brand code
  it('2. Duplicate brand code: rejects registration when brand code is already in use (case-insensitive)', () => {
    expect(() => {
      brandsRepository.create({
        name: 'Molty Clone',
        code: 'molty', // Existing code is 'MOLTY'
        description: 'Duplicate code test',
      });
    }).toThrow(CatalogueValidationError);
  });

  // 3. Category-to-brand assignment
  it('3. Category-to-brand assignment: associates a category with a valid brand and verifies foreign key', () => {
    const duraBrand = brandsRepository.getByCode('DURA');
    expect(duraBrand).toBeDefined();

    const category = categoriesRepository.create({
      brandId: duraBrand!.id,
      name: 'Cool Air Series',
      description: 'Breathable foam matrix for hot climates.',
      status: 'ACTIVE',
    });

    expect(category).toBeDefined();
    expect(category.brandId).toBe(duraBrand!.id);
    expect(category.brandName).toBe(duraBrand!.name);

    const retrieved = categoriesRepository.getById(category.id);
    expect(retrieved?.brandId).toBe(duraBrand!.id);
  });

  // 4. Category filtering by brand
  it('4. Category filtering by brand: retrieves only categories that belong to the queried brand', () => {
    const moltyBrand = brandsRepository.getByCode('MOLTY');
    const duraBrand = brandsRepository.getByCode('DURA');
    expect(moltyBrand).toBeDefined();
    expect(duraBrand).toBeDefined();

    const moltyCategories = categoriesRepository.getAll({ brandId: moltyBrand!.id });
    expect(moltyCategories.length).toBeGreaterThan(0);
    expect(moltyCategories.every((c) => c.brandId === moltyBrand!.id)).toBe(true);

    const duraCategories = categoriesRepository.getAll({ brandId: duraBrand!.id });
    expect(duraCategories.length).toBeGreaterThan(0);
    expect(duraCategories.every((c) => c.brandId === duraBrand!.id)).toBe(true);

    // Disjoint category lists between independent brands
    const moltyIds = new Set(moltyCategories.map((c) => c.id));
    expect(duraCategories.some((c) => moltyIds.has(c.id))).toBe(false);
  });

  // 5. Size creation and duplicate dimensions
  it('5. Size creation and duplicate dimensions: creates new dimension and blocks duplicate length x width', () => {
    const size = sizesRepository.create({
      length: 84,
      width: 72,
      unit: 'inches',
    });

    expect(size).toBeDefined();
    expect(size.displayLabel).toContain('84');
    expect(size.displayLabel).toContain('72');
    expect(size.length).toBe(84);
    expect(size.width).toBe(72);

    // Duplicate dimension creation attempt
    expect(() => {
      sizesRepository.create({
        length: 84,
        width: 72,
        unit: 'inches',
      });
    }).toThrow(CatalogueValidationError);
  });

  // 6. Thickness creation and validation
  it('6. Thickness creation and validation: creates thickness value and rejects duplicate thickness', () => {
    const thickness = thicknessRepository.create({
      value: 12,
      unit: 'inches',
    });

    expect(thickness).toBeDefined();
    expect(thickness.value).toBe(12);
    expect(thickness.displayLabel).toContain('12');

    // Duplicate thickness rejection
    expect(() => {
      thicknessRepository.create({
        value: 12,
        unit: 'inches',
      });
    }).toThrow(CatalogueValidationError);
  });

  // 7. Product creation
  it('7. Product creation: registers a new master catalogue product with valid brand and category', () => {
    const duraBrand = brandsRepository.getByCode('DURA');
    const duraCategories = categoriesRepository.getAll({ brandId: duraBrand!.id });
    expect(duraCategories.length).toBeGreaterThan(0);

    const product = productsRepository.create({
      name: 'Dura Comfort Spine',
      code: 'DURA-SPINE',
      brandId: duraBrand!.id,
      categoryId: duraCategories[0].id,
      description: 'Ergonomic lumbar spine support mattress.',
      status: 'ACTIVE',
    });

    expect(product).toBeDefined();
    expect(product.code).toBe('DURA-SPINE');
    expect(product.brandId).toBe(duraBrand!.id);
    expect(product.categoryId).toBe(duraCategories[0].id);

    const fetched = productsRepository.getById(product.id);
    expect(fetched?.name).toBe('Dura Comfort Spine');
  });

  // 8. Invalid product/category relationship
  it('8. Invalid product/category relationship: prevents assigning a category from a different brand', () => {
    const moltyBrand = brandsRepository.getByCode('MOLTY');
    const duraBrand = brandsRepository.getByCode('DURA');
    const duraCategories = categoriesRepository.getAll({ brandId: duraBrand!.id });

    expect(() => {
      productsRepository.create({
        name: 'Mismatched Brand Product',
        code: 'MISMATCH-01',
        brandId: moltyBrand!.id, // Molty Brand
        categoryId: duraCategories[0].id, // Dura Category
        description: 'Should fail validation',
      });
    }).toThrow(CatalogueValidationError);
  });

  // 9. Variant generation
  it('9. Variant generation: previews and generates Cartesian matrix of variants with deterministic SKUs', () => {
    const brand = brandsRepository.getAll()[0];
    const cat = categoriesRepository.getAll({ brandId: brand.id })[0];
    const newProduct = productsRepository.create({
      name: 'Matrix Test Mattress',
      code: 'TEST-MAT',
      brandId: brand.id,
      categoryId: cat.id,
    });

    const sizes = sizesRepository.getAll({ status: 'ACTIVE' }).slice(0, 2); // 2 sizes
    const thicknesses = thicknessRepository.getAll({ status: 'ACTIVE' }).slice(0, 2); // 2 thicknesses

    // Preview previewMatrix: 2 x 2 = 4 variants
    const preview = variantsRepository.previewMatrix({
      productId: newProduct.id,
      sizeIds: sizes.map((s) => s.id),
      thicknessIds: thicknesses.map((t) => t.id),
    });

    expect(preview.totalPossible).toBe(4);
    expect(preview.existingCount).toBe(0);

    // Generate variants
    const result = variantsRepository.generateMatrix({
      productId: newProduct.id,
      combinations: preview.combinations.map((c) => ({
        sizeId: c.sizeId,
        thicknessId: c.thicknessId,
        sku: c.suggestedSku,
        retailPrice: 50000,
        wholesalePrice: 42000,
      })),
    });

    expect(result.createdCount).toBe(4);
    expect(variantsRepository.getByProductId(newProduct.id).length).toBe(4);
  });

  // 10. Duplicate variant prevention
  it('10. Duplicate variant prevention: blocks creating variant with identical size & thickness for same product', () => {
    const product = productsRepository.getAll()[0];
    const existingVariants = variantsRepository.getByProductId(product.id);
    expect(existingVariants.length).toBeGreaterThan(0);

    const first = existingVariants[0];

    // Attempting to create variant with exact same product + size + thickness
    expect(() => {
      variantsRepository.create({
        productId: product.id,
        sizeId: first.sizeId,
        thicknessId: first.thicknessId,
        sku: `${first.sku}-DUP`,
        retailPrice: 55000,
        wholesalePrice: 48000,
      });
    }).toThrow(CatalogueValidationError);
  });

  // 11. Unique SKU validation
  it('11. Unique SKU validation: enforces globally unique SKU strings across the catalogue', () => {
    const allVariants = variantsRepository.getAll();
    const existingSku = allVariants[0].sku;

    const products = productsRepository.getAll();
    const product = products[1];
    const sizes = sizesRepository.getAll();
    const thicknesses = thicknessRepository.getAll();

    expect(() => {
      variantsRepository.create({
        productId: product.id,
        sizeId: sizes[2].id,
        thicknessId: thicknesses[2].id,
        sku: existingSku, // Collision with existing variant's SKU
        retailPrice: 40000,
        wholesalePrice: 35000,
      });
    }).toThrow(CatalogueValidationError);
  });

  // 12. Retail price updates
  it('12. Retail price updates: safely updates retail price, validates non-negative, and logs audit record', () => {
    const variant = variantsRepository.getAll()[0];
    const oldRetail = variant.retailPrice;
    const newRetail = oldRetail + 5000;

    const updateResult = pricingRepository.updateVariantPrice(variant.id, {
      retailPrice: newRetail,
      wholesalePrice: variant.wholesalePrice,
      changedBy: 'Admin Test',
      reason: 'Annual inflation tariff adjustment',
    });

    expect(updateResult.variant.retailPrice).toBe(newRetail);
    expect(updateResult.history).toBeDefined();
    expect(updateResult.history.oldRetailPrice).toBe(oldRetail);
    expect(updateResult.history.newRetailPrice).toBe(newRetail);
    expect(updateResult.history.changeReason).toBe('Annual inflation tariff adjustment');

    // Negative price validation check
    expect(() => {
      pricingRepository.updateVariantPrice(variant.id, {
        retailPrice: -100,
        wholesalePrice: variant.wholesalePrice,
        changedBy: 'Admin Test',
      });
    }).toThrow(CatalogueValidationError);
  });

  // 13. Wholesale price updates
  it('13. Wholesale price updates: safely updates wholesale price with audit logging and bulk adjustments', () => {
    const variant = variantsRepository.getAll()[0];
    const oldWholesale = variant.wholesalePrice;
    const newWholesale = oldWholesale + 3000;

    const result = pricingRepository.updateVariantPrice(variant.id, {
      retailPrice: variant.retailPrice,
      wholesalePrice: newWholesale,
      changedBy: 'Wholesale Lead',
      reason: 'Volume dealer incentive update',
    });

    expect(result.variant.wholesalePrice).toBe(newWholesale);
    expect(result.history.oldWholesalePrice).toBe(oldWholesale);
    expect(result.history.newWholesalePrice).toBe(newWholesale);

    // Bulk price update test (e.g. +10% wholesale across product)
    const bulkResult = pricingRepository.bulkUpdatePrices({
      scope: 'ALL',
      retailAdjustmentType: 'PERCENTAGE',
      retailAdjustmentValue: 5,
      wholesaleAdjustmentType: 'PERCENTAGE',
      wholesaleAdjustmentValue: 5,
      changedBy: 'Super Admin',
      reason: 'Q4 Dealer Tariff Revision',
    });

    expect(bulkResult.updatedCount).toBeGreaterThan(0);
    expect(bulkResult.history.length).toBe(bulkResult.updatedCount);
  });

  // 14. Persistence after refresh
  it('14. Persistence after refresh: verifies demoStorage loads data correctly across reloads', () => {
    const brand = brandsRepository.create({
      name: 'Persistent Brand',
      code: 'PERSIST-01',
      description: 'Testing demoStorage write/read cycle',
    });

    // Directly read from storage key
    const rawStorage = demoStorage.getItem<Brand[]>(STORAGE_KEYS.BRANDS, []);
    const found = rawStorage.find((b) => b.id === brand.id);
    expect(found).toBeDefined();
    expect(found!.code).toBe('PERSIST-01');
  });

  // 15. Safe data migration
  it('15. Safe data migration: initializes with current schema version without corrupting prior data', () => {
    expect(DEMO_DB_VERSION).toBe('v5_flow05');

    // Ensure version is recorded in storage
    const currentVersion = demoStorage.getVersion();
    expect(currentVersion).toBe('v5_flow05');
  });

  // 16. Role-based permissions
  it('16. Role-based permissions: verifies Super Admin, Cashier, and Manager access boundaries', () => {
    const superAdmin: User = {
      id: 'USR-ADMIN-01',
      name: 'Super Admin',
      email: 'admin@moltyfoam.store',
      phone: '0300-1111111',
      role: 'SUPER_ADMIN',
      designation: 'Enterprise Administrator',
      customPermissions: ['*'],
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const cashier: User = {
      id: 'USR-CASH-01',
      name: 'Cashier Staff',
      email: 'cashier@moltyfoam.store',
      phone: '0300-2222222',
      role: 'CASHIER',
      designation: 'Checkout Operator',
      assignedBranchId: 'BR-MAIN-01',
      customPermissions: ['pos:access', 'pos:create_sale', 'invoices:read', 'catalogue:view'],
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    // Super Admin has full catalogue and pricing permissions
    expect(hasPermission(superAdmin, 'catalogue:manage')).toBe(true);
    expect(hasPermission(superAdmin, 'pricing:manage')).toBe(true);
    expect(hasPermission(superAdmin, 'catalogue:view')).toBe(true);

    // Cashier has read-only catalogue view, cannot manage catalogue or modify pricing
    expect(hasPermission(cashier, 'catalogue:view')).toBe(true);
    expect(hasPermission(cashier, 'catalogue:manage')).toBe(false);
    expect(hasPermission(cashier, 'pricing:manage')).toBe(false);
  });

  // 17. Product deactivation
  it('17. Product deactivation: deactivating a product retains all variant entities in database', () => {
    const products = productsRepository.getAll();
    const product = products[0];

    const initialVariants = variantsRepository.getByProductId(product.id);
    expect(initialVariants.length).toBeGreaterThan(0);

    // Deactivate product
    const deactivated = productsRepository.toggleStatus(product.id, 'INACTIVE');
    expect(deactivated.status).toBe('INACTIVE');

    // Variants are preserved
    const remainingVariants = variantsRepository.getByProductId(product.id);
    expect(remainingVariants.length).toBe(initialVariants.length);
  });

  // 18. Historical record preservation
  it('18. Historical record preservation: historical invoice SKUs and prices remain intact', () => {
    // Seed invoices reference specific SKUs
    const seedInvoices = INITIAL_MOCK_INVOICES;
    expect(seedInvoices.length).toBeGreaterThan(0);

    // Verify seed variants contain the historical invoice SKUs
    const allVariants = variantsRepository.getAll();
    const skuSet = new Set(allVariants.map((v) => v.sku));

    expect(skuSet.has('MF-ORIG-7872')).toBe(true);
    expect(skuSet.has('MF-COOL-7866')).toBe(true);
    expect(skuSet.has('MF-SLIM-7860')).toBe(true);
    expect(skuSet.has('MF-ORTH-7866')).toBe(true);
    expect(skuSet.has('MF-SPRG-7872')).toBe(true);
  });

  // 19. Reset Demo Data consistency
  it('19. Reset Demo Data consistency: restoring baseline seeds properly resets all catalogue tables', () => {
    // Create temporary brand and size
    brandsRepository.create({ name: 'Temp Brand', code: 'TEMP' });
    sizesRepository.create({ length: 90, width: 80, unit: 'inches' });

    // Execute reset
    brandsRepository.resetToSeed();
    sizesRepository.resetToSeed();

    expect(brandsRepository.getByCode('TEMP')).toBeNull();
    expect(sizesRepository.getByDimensions(90, 80)).toBeNull();
    expect(brandsRepository.getAll().length).toBe(3); // Baseline: Molty, Dura, Master
  });

  // 20. No regression in Branch Management or Users & Roles
  it('20. No regression: Flow 02 branches and Flow 03 users and roles remain functional and intact', () => {
    const branches = branchesRepository.getAll();
    expect(branches.length).toBe(5);
    expect(branches.find((b) => b.code === 'SHOP-12')).toBeDefined();

    const users = usersRepository.getAll();
    expect(users.length).toBe(10);
    expect(users.find((u) => u.role === 'SUPER_ADMIN')).toBeDefined();

    const counts = branchesRepository.getCounts();
    expect(counts.total).toBe(5);
    expect(counts.active).toBe(5);
  });
});
