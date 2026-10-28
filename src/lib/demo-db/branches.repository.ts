import { Branch, BranchSettings } from '@/types';
import { DEMO_USERS } from '@/data/mockData';
import {
  CreateBranchDTO,
  UpdateBranchDTO,
  BranchFilterOptions,
  STORAGE_KEYS,
  DEMO_DB_VERSION,
  DEFAULT_BRANCH_SETTINGS,
  BranchValidationError,
  ValidationErrorDetail,
} from './schema';
import { SEED_BRANCHES } from './seed';
import { demoStorage } from './storage';

export class BranchesRepository {
  /**
   * Ensure repository is hydrated.
   * Initializes with seed data if uninitialized or if schema version changed.
   */
  private getBranchesInternal(): Branch[] {
    const version = demoStorage.getVersion();
    if (version !== DEMO_DB_VERSION) {
      this.resetToSeed();
      return [...SEED_BRANCHES];
    }

    const branches = demoStorage.getItem<Branch[] | null>(STORAGE_KEYS.BRANCHES, null);
    if (!branches || !Array.isArray(branches) || branches.length === 0) {
      this.resetToSeed();
      return [...SEED_BRANCHES];
    }

    return branches;
  }

  private saveBranchesInternal(branches: Branch[]): void {
    demoStorage.setItem(STORAGE_KEYS.BRANCHES, branches);
    demoStorage.setVersion(DEMO_DB_VERSION);
  }

  /**
   * Retrieve all branches with optional filtering and sorting.
   */
  public getAll(options?: BranchFilterOptions): Branch[] {
    let list = this.getBranchesInternal();

    if (!options) {
      return list;
    }

    // 1. Text Search across name, code, shopNumber, managerName, address
    if (options.search && options.search.trim()) {
      const q = options.search.toLowerCase().trim();
      list = list.filter((b) => {
        return (
          b.name.toLowerCase().includes(q) ||
          b.code.toLowerCase().includes(q) ||
          (b.shopNumber && b.shopNumber.toLowerCase().includes(q)) ||
          b.managerName.toLowerCase().includes(q) ||
          b.address.toLowerCase().includes(q) ||
          b.city.toLowerCase().includes(q)
        );
      });
    }

    // 2. Type filtering
    if (options.type && options.type !== 'all') {
      if (options.type === 'retail') {
        list = list.filter(
          (b) =>
            b.type === 'RETAIL_STORE' ||
            b.type === 'SHOWROOM' ||
            b.type === 'EXPRESS_COUNTER' ||
            !b.type // default fallback to retail
        );
      } else if (options.type === 'warehouse') {
        list = list.filter(
          (b) => b.type === 'WAREHOUSE' || b.type === 'WHOLESALE_DEPOT'
        );
      } else {
        list = list.filter((b) => b.type === options.type);
      }
    }

    // 3. Status filtering
    if (options.status && options.status !== 'all') {
      if (options.status === 'active') {
        list = list.filter((b) => b.isActive);
      } else if (options.status === 'inactive') {
        list = list.filter((b) => !b.isActive);
      }
    }

    // 4. Sorting
    if (options.sortBy) {
      const order = options.sortOrder === 'desc' ? -1 : 1;
      list.sort((a, b) => {
        if (options.sortBy === 'name') {
          return a.name.localeCompare(b.name) * order;
        }
        if (options.sortBy === 'code') {
          return a.code.localeCompare(b.code) * order;
        }
        if (options.sortBy === 'shopNumber') {
          return (a.shopNumber || '').localeCompare(b.shopNumber || '') * order;
        }
        if (options.sortBy === 'targetMonthlySales') {
          return (a.targetMonthlySales - b.targetMonthlySales) * order;
        }
        if (options.sortBy === 'status') {
          return (Number(b.isActive) - Number(a.isActive)) * order;
        }
        return 0;
      });
    }

    return list;
  }

  /**
   * Get dynamic category counts derived from real stored branch types.
   */
  public getCounts(): {
    total: number;
    retail: number;
    warehouse: number;
    active: number;
    inactive: number;
  } {
    const list = this.getBranchesInternal();
    let retail = 0;
    let warehouse = 0;
    let active = 0;
    let inactive = 0;

    for (const b of list) {
      if (b.isActive) active++;
      else inactive++;

      if (b.type === 'WAREHOUSE' || b.type === 'WHOLESALE_DEPOT') {
        warehouse++;
      } else {
        retail++;
      }
    }

    return {
      total: list.length,
      retail,
      warehouse,
      active,
      inactive,
    };
  }

  /**
   * Get branch by unique ID.
   */
  public getById(id: string): Branch | null {
    const list = this.getBranchesInternal();
    return list.find((b) => b.id === id) || null;
  }

  /**
   * Get branch by unique Code (case-insensitive).
   */
  public getByCode(code: string): Branch | null {
    const list = this.getBranchesInternal();
    const normalized = code.toUpperCase().trim();
    return list.find((b) => b.code.toUpperCase() === normalized) || null;
  }

  /**
   * Validate branch inputs before create or update.
   */
  public validate(
    input: Partial<CreateBranchDTO>,
    existingBranchId?: string
  ): ValidationErrorDetail[] {
    const errors: ValidationErrorDetail[] = [];

    // Branch Name
    if (!input.name || input.name.trim().length < 3) {
      errors.push({
        field: 'name',
        message: 'Branch name is required and must be at least 3 characters',
      });
    }

    // Branch Code
    if (!input.code || input.code.trim().length < 2) {
      errors.push({
        field: 'code',
        message: 'Branch code is required (e.g., SHOP-35 or BR-EXP)',
      });
    } else {
      const codeRegex = /^[A-Za-z0-9\-_#]+$/;
      if (!codeRegex.test(input.code.trim())) {
        errors.push({
          field: 'code',
          message: 'Branch code can only contain letters, numbers, hyphens, and underscores',
        });
      } else {
        // Check uniqueness
        const existing = this.getByCode(input.code);
        if (existing && existing.id !== existingBranchId) {
          errors.push({
            field: 'code',
            message: `Branch code "${input.code}" is already in use by ${existing.name}`,
          });
        }
      }
    }

    // Shop Number
    if (!input.shopNumber || input.shopNumber.trim().length < 2) {
      errors.push({
        field: 'shopNumber',
        message: 'Shop / location number is required (e.g. Shop #18)',
      });
    }

    // Phone / Contact
    if (!input.phone || input.phone.trim().length < 7) {
      errors.push({
        field: 'phone',
        message: 'Valid contact number is required',
      });
    }

    // Address
    if (!input.address || input.address.trim().length < 5) {
      errors.push({
        field: 'address',
        message: 'Detailed commercial address is required',
      });
    }

    return errors;
  }

  /**
   * Create a new branch.
   */
  public create(input: CreateBranchDTO): Branch {
    const errors = this.validate(input);
    if (errors.length > 0) {
      throw new BranchValidationError('Branch validation failed', errors);
    }

    const list = this.getBranchesInternal();

    // Resolve Manager info if managerId passed
    let managerName = input.managerName || 'Unassigned Manager';
    let managerEmail = input.managerEmail || 'manager@moltyfoam.store';

    if (input.managerId) {
      const user = DEMO_USERS.find((u) => u.id === input.managerId);
      if (user) {
        managerName = user.name;
        managerEmail = user.email;
      }
    }

    const now = new Date().toISOString();
    const cleanCode = input.code.trim().toUpperCase();
    const newId = `BR-${cleanCode.replace(/[^A-Z0-9]/g, '')}-${Date.now().toString(36).slice(-4).toUpperCase()}`;

    const newBranch: Branch = {
      id: newId,
      code: cleanCode,
      shopNumber: input.shopNumber.trim(),
      name: input.name.trim(),
      type: input.type || 'RETAIL_STORE',
      city: input.city?.trim() || 'Karachi (Central Market)',
      address: input.address.trim(),
      phone: input.phone.trim(),
      managerId: input.managerId,
      managerName,
      managerEmail,
      isActive: true,
      targetMonthlySales: input.targetMonthlySales || 2000000,
      imageUrl: input.imageUrl || 'https://images.unsplash.com/photo-1555529771-7888783a18d3?auto=format&fit=crop&w=600&q=80',
      settings: {
        allowRetailSales: input.settings?.allowRetailSales ?? DEFAULT_BRANCH_SETTINGS.allowRetailSales,
        allowWholesaleSales: input.settings?.allowWholesaleSales ?? DEFAULT_BRANCH_SETTINGS.allowWholesaleSales,
        manageOwnInventory: input.settings?.manageOwnInventory ?? DEFAULT_BRANCH_SETTINGS.manageOwnInventory,
        showInReports: input.settings?.showInReports ?? DEFAULT_BRANCH_SETTINGS.showInReports,
      },
      createdAt: now,
      updatedAt: now,
    };

    list.push(newBranch);
    this.saveBranchesInternal(list);
    return newBranch;
  }

  /**
   * Update an existing branch.
   */
  public update(id: string, input: UpdateBranchDTO): Branch {
    const list = this.getBranchesInternal();
    const index = list.findIndex((b) => b.id === id);

    if (index === -1) {
      throw new Error(`Branch with ID "${id}" not found.`);
    }

    const current = list[index];

    // Validate if any key fields are being updated
    const errors = this.validate(
      {
        name: input.name ?? current.name,
        code: input.code ?? current.code,
        shopNumber: input.shopNumber ?? current.shopNumber,
        phone: input.phone ?? current.phone,
        address: input.address ?? current.address,
      },
      id
    );

    if (errors.length > 0) {
      throw new BranchValidationError('Branch update validation failed', errors);
    }

    // Resolve Manager info if managerId updated
    let managerName = input.managerName ?? current.managerName;
    let managerEmail = input.managerEmail ?? current.managerEmail;

    if (input.managerId !== undefined) {
      if (input.managerId) {
        const user = DEMO_USERS.find((u) => u.id === input.managerId);
        if (user) {
          managerName = user.name;
          managerEmail = user.email;
        }
      } else {
        managerName = 'Unassigned';
        managerEmail = 'unassigned@moltyfoam.store';
      }
    }

    const updated: Branch = {
      ...current,
      name: input.name?.trim() ?? current.name,
      code: input.code?.trim().toUpperCase() ?? current.code,
      shopNumber: input.shopNumber?.trim() ?? current.shopNumber,
      type: input.type ?? current.type,
      city: input.city?.trim() ?? current.city,
      address: input.address?.trim() ?? current.address,
      phone: input.phone?.trim() ?? current.phone,
      managerId: input.managerId !== undefined ? input.managerId : current.managerId,
      managerName,
      managerEmail,
      targetMonthlySales: input.targetMonthlySales ?? current.targetMonthlySales,
      imageUrl: input.imageUrl ?? current.imageUrl,
      isActive: input.isActive !== undefined ? input.isActive : current.isActive,
      settings: {
        ...current.settings,
        ...input.settings,
        allowRetailSales: input.settings?.allowRetailSales ?? current.settings?.allowRetailSales ?? true,
        allowWholesaleSales: input.settings?.allowWholesaleSales ?? current.settings?.allowWholesaleSales ?? true,
        manageOwnInventory: input.settings?.manageOwnInventory ?? current.settings?.manageOwnInventory ?? false,
        showInReports: input.settings?.showInReports ?? current.settings?.showInReports ?? true,
      },
      updatedAt: new Date().toISOString(),
    };

    list[index] = updated;
    this.saveBranchesInternal(list);
    return updated;
  }

  /**
   * Soft activation / deactivation of a branch.
   * Preserves historical financial and invoice data.
   */
  public toggleStatus(id: string, isActive: boolean): Branch {
    const list = this.getBranchesInternal();
    const index = list.findIndex((b) => b.id === id);

    if (index === -1) {
      throw new Error(`Branch with ID "${id}" not found.`);
    }

    list[index] = {
      ...list[index],
      isActive,
      updatedAt: new Date().toISOString(),
    };

    this.saveBranchesInternal(list);
    return list[index];
  }

  /**
   * Update operational settings for a branch.
   */
  public updateSettings(id: string, settings: Partial<BranchSettings>): Branch {
    const list = this.getBranchesInternal();
    const index = list.findIndex((b) => b.id === id);

    if (index === -1) {
      throw new Error(`Branch with ID "${id}" not found.`);
    }

    const current = list[index];
    const updatedSettings: BranchSettings = {
      allowRetailSales: settings.allowRetailSales ?? current.settings?.allowRetailSales ?? true,
      allowWholesaleSales: settings.allowWholesaleSales ?? current.settings?.allowWholesaleSales ?? true,
      manageOwnInventory: settings.manageOwnInventory ?? current.settings?.manageOwnInventory ?? false,
      showInReports: settings.showInReports ?? current.settings?.showInReports ?? true,
    };

    list[index] = {
      ...current,
      settings: updatedSettings,
      updatedAt: new Date().toISOString(),
    };

    this.saveBranchesInternal(list);
    return list[index];
  }

  /**
   * Reset database to original 5 market cluster seed shops.
   */
  public resetToSeed(): Branch[] {
    demoStorage.setItem(STORAGE_KEYS.BRANCHES, SEED_BRANCHES);
    demoStorage.setVersion(DEMO_DB_VERSION);
    demoStorage.setItem(STORAGE_KEYS.LAST_RESET, new Date().toISOString());
    return [...SEED_BRANCHES];
  }

  // --- Domain & Permission Rule Helpers ---

  public canBranchRetail(branch?: Branch | null): boolean {
    if (!branch || !branch.isActive) return false;
    return branch.settings?.allowRetailSales !== false;
  }

  public canBranchWholesale(branch?: Branch | null): boolean {
    if (!branch || !branch.isActive) return false;
    return branch.settings?.allowWholesaleSales !== false;
  }

  public isBranchWarehouse(branch?: Branch | null): boolean {
    if (!branch) return false;
    return branch.type === 'WAREHOUSE' || branch.type === 'WHOLESALE_DEPOT';
  }

  public isBranchVisibleInReports(branch?: Branch | null): boolean {
    if (!branch) return false;
    return branch.settings?.showInReports !== false;
  }
}

export const branchesRepository = new BranchesRepository();
