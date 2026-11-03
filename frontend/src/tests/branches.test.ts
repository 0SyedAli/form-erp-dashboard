import { describe, it, expect, beforeEach } from 'vitest';
import {
  branchesRepository,
  BranchValidationError,
  CreateBranchDTO,
  STORAGE_KEYS,
  DEMO_DB_VERSION,
  demoStorage,
} from '../lib/demo-db';
import { INITIAL_MOCK_INVOICES } from '../data/mockData';
import { calculateDashboardKPIs } from '../utils/financialCalculations';
import { Branch } from '../types';

describe('Molty Foam ERP — Flow 02: Branch & Store Management Repository', () => {
  beforeEach(() => {
    // Reset repository to fresh baseline before every test
    branchesRepository.resetToSeed();
  });

  it('1. Successfully creates a new market branch with validated fields and default settings', () => {
    const input: CreateBranchDTO = {
      name: 'Molty Gallery Plaza (Shop #45)',
      code: 'SHOP-45',
      shopNumber: 'Shop #45',
      type: 'RETAIL_STORE',
      city: 'Karachi (Main Market)',
      address: 'Shop #45, Central Mattress Market, Shahrah-e-Faisal, Karachi',
      phone: '0300-9988776',
      targetMonthlySales: 3000000,
      settings: {
        allowRetailSales: true,
        allowWholesaleSales: false,
        manageOwnInventory: true,
        showInReports: true,
      },
    };

    const initialCounts = branchesRepository.getCounts();
    const created = branchesRepository.create(input);

    expect(created.id).toContain('BR-SHOP45');
    expect(created.code).toBe('SHOP-45');
    expect(created.name).toBe('Molty Gallery Plaza (Shop #45)');
    expect(created.shopNumber).toBe('Shop #45');
    expect(created.type).toBe('RETAIL_STORE');
    expect(created.isActive).toBe(true);
    expect(created.settings?.allowRetailSales).toBe(true);
    expect(created.settings?.allowWholesaleSales).toBe(false);
    expect(created.settings?.manageOwnInventory).toBe(true);

    const newCounts = branchesRepository.getCounts();
    expect(newCounts.total).toBe(initialCounts.total + 1);
    expect(newCounts.retail).toBe(initialCounts.retail + 1);
  });

  it('2. Enforces unique branch codes (rejects duplicate branch-code case-insensitively)', () => {
    // SHOP-12 is the code of Main Branch
    const duplicateInput: CreateBranchDTO = {
      name: 'Conflicting Shop',
      code: 'shop-12', // lowercase check
      shopNumber: 'Shop #99',
      type: 'RETAIL_STORE',
      city: 'Karachi',
      address: 'Commercial Strip',
      phone: '0300-1111111',
    };

    expect(() => {
      branchesRepository.create(duplicateInput);
    }).toThrowError(BranchValidationError);

    try {
      branchesRepository.create(duplicateInput);
    } catch (e) {
      const err = e as BranchValidationError;
      const codeError = err.errors.find((errItem) => errItem.field === 'code');
      expect(codeError).toBeDefined();
      expect(codeError?.message).toContain('already in use');
    }
  });

  it('3. Successfully updates an existing branch without changing immutable associations', () => {
    const mainBranch = branchesRepository.getById('BR-MAIN-01');
    expect(mainBranch).not.toBeNull();

    const updated = branchesRepository.update('BR-MAIN-01', {
      name: 'Molty Foam Main Flagship (Shop #12-14)',
      phone: '0300-1112222',
      targetMonthlySales: 5000000,
    });

    expect(updated.name).toBe('Molty Foam Main Flagship (Shop #12-14)');
    expect(updated.phone).toBe('0300-1112222');
    expect(updated.targetMonthlySales).toBe(5000000);
    // Preserves code and original ID
    expect(updated.id).toBe('BR-MAIN-01');
    expect(updated.code).toBe('SHOP-12');
  });

  it('4. Soft deactivates a branch without destructive record deletion', () => {
    const target = branchesRepository.getById('BR-DISP-02');
    expect(target?.isActive).toBe(true);

    const deactivated = branchesRepository.toggleStatus('BR-DISP-02', false);
    expect(deactivated.isActive).toBe(false);

    // Record must still exist in database
    const found = branchesRepository.getById('BR-DISP-02');
    expect(found).not.toBeNull();
    expect(found?.isActive).toBe(false);

    const counts = branchesRepository.getCounts();
    expect(counts.active).toBe(4);
    expect(counts.inactive).toBe(1);
  });

  it('5. Filters branches accurately by type (retail vs warehouse) and status (active vs inactive)', () => {
    // Initially: 4 retail and 1 warehouse
    const retailBranches = branchesRepository.getAll({ type: 'retail' });
    expect(retailBranches.length).toBe(4);

    const warehouseBranches = branchesRepository.getAll({ type: 'warehouse' });
    expect(warehouseBranches.length).toBe(1);
    expect(warehouseBranches[0].id).toBe('BR-WS-03');

    // Deactivate one branch and filter by status
    branchesRepository.toggleStatus('BR-ORTH-04', false);

    const activeOnly = branchesRepository.getAll({ status: 'active' });
    expect(activeOnly.length).toBe(4);

    const inactiveOnly = branchesRepository.getAll({ status: 'inactive' });
    expect(inactiveOnly.length).toBe(1);
    expect(inactiveOnly[0].id).toBe('BR-ORTH-04');
  });

  it('6. Live searches across branch name, code, shop number, and manager name', () => {
    // Search by manager name "Usman"
    const byManager = branchesRepository.getAll({ search: 'Usman' });
    expect(byManager.length).toBe(1);
    expect(byManager[0].id).toBe('BR-DISP-02');

    // Search by shop number "Shop #24"
    const byShop = branchesRepository.getAll({ search: 'Shop #24' });
    expect(byShop.length).toBe(1);
    expect(byShop[0].id).toBe('BR-WS-03');

    // Search by code "SHOP-06"
    const byCode = branchesRepository.getAll({ search: 'SHOP-06' });
    expect(byCode.length).toBe(1);
    expect(byCode[0].id).toBe('BR-ORTH-04');
  });

  it('7. Assigns verified demo managers and populates name and email', () => {
    // Assign Saad Malik (USR-MGR-WS) to Express Counter
    const updated = branchesRepository.update('BR-EXPR-05', {
      managerId: 'USR-MGR-WS',
    });

    expect(updated.managerId).toBe('USR-MGR-WS');
    expect(updated.managerName).toBe('Saad Malik');
    expect(updated.managerEmail).toBe('saad.malik@moltyfoam.store');
  });

  it('8. Enforces localStorage persistence and schema versioning', () => {
    // Add custom branch
    branchesRepository.create({
      name: 'Persistence Test Shop',
      code: 'TEST-PERSIST',
      shopNumber: 'Shop #99',
      type: 'RETAIL_STORE',
      city: 'Karachi',
      address: 'Test Address',
      phone: '0300-0000000',
    });

    // Check storage persistence
    const rawData = demoStorage.getItem<Branch[] | null>(STORAGE_KEYS.BRANCHES, null);
    expect(rawData).not.toBeNull();
    const found = rawData?.find((b) => b.code === 'TEST-PERSIST');
    expect(found).toBeDefined();

    const version = demoStorage.getVersion();
    expect(version).toBe(DEMO_DB_VERSION);
  });

  it('9. Restores seed baseline on resetToSeed without corrupting data', () => {
    // Create new branch
    branchesRepository.create({
      name: 'Temporary Branch',
      code: 'TEMP-BR',
      shopNumber: 'Shop #88',
      type: 'RETAIL_STORE',
      city: 'Karachi',
      address: 'Temp Lane',
      phone: '0300-8888888',
    });

    expect(branchesRepository.getAll().length).toBe(6);

    // Trigger reset
    const resetList = branchesRepository.resetToSeed();
    expect(resetList.length).toBe(5);
    expect(branchesRepository.getById('TEMP-BR')).toBeNull();
    expect(branchesRepository.getById('BR-MAIN-01')).not.toBeNull();
  });

  it('10. Accurately evaluates governance permission helper rules', () => {
    const mainBranch = branchesRepository.getById('BR-MAIN-01');
    const wsDepot = branchesRepository.getById('BR-WS-03');

    // Main Branch has retail: true, wholesale: true
    expect(branchesRepository.canBranchRetail(mainBranch)).toBe(true);
    expect(branchesRepository.canBranchWholesale(mainBranch)).toBe(true);
    expect(branchesRepository.isBranchWarehouse(mainBranch)).toBe(false);

    // Wholesale Depot has retail: false, wholesale: true
    expect(branchesRepository.canBranchRetail(wsDepot)).toBe(false);
    expect(branchesRepository.canBranchWholesale(wsDepot)).toBe(true);
    expect(branchesRepository.isBranchWarehouse(wsDepot)).toBe(true);

    // Inactive branch has all sales disallowed
    branchesRepository.toggleStatus('BR-MAIN-01', false);
    const inactiveMain = branchesRepository.getById('BR-MAIN-01');
    expect(branchesRepository.canBranchRetail(inactiveMain)).toBe(false);
    expect(branchesRepository.canBranchWholesale(inactiveMain)).toBe(false);
  });

  it('11. Preserves existing invoices and financial figures unchanged when branches are created or updated', () => {
    const initialKPIs = calculateDashboardKPIs(INITIAL_MOCK_INVOICES);
    const initialInvoiceCount = INITIAL_MOCK_INVOICES.length;

    // Create a new branch
    branchesRepository.create({
      name: 'New Empty Branch',
      code: 'NEW-ZERO-01',
      shopNumber: 'Shop #77',
      type: 'RETAIL_STORE',
      city: 'Karachi',
      address: 'New Plaza',
      phone: '0300-7777777',
    });

    // Invoices must remain completely unchanged
    expect(INITIAL_MOCK_INVOICES.length).toBe(initialInvoiceCount);
    const postKPIs = calculateDashboardKPIs(INITIAL_MOCK_INVOICES);

    expect(postKPIs.totalNetSales).toBe(initialKPIs.totalNetSales);
    expect(postKPIs.totalInvoices).toBe(initialKPIs.totalInvoices);
    expect(postKPIs.retailRevenue).toBe(initialKPIs.retailRevenue);
    expect(postKPIs.wholesaleRevenue).toBe(initialKPIs.wholesaleRevenue);
  });
});
