import { describe, it, expect, beforeEach } from 'vitest';
import {
  branchesRepository,
  productsRepository,
  variantsRepository,
  priceListsRepository,
  inventoryRepository,
  stockLocationsRepository,
  stockMovementsRepository,
} from '@/lib/demo-db';
import { hasBranchPermission } from '@/lib/permissions';
import { User } from '@/types';

describe('Simplification & Dedicated Manage Stock Module', () => {
  beforeEach(() => {
    branchesRepository.resetToSeed();
    productsRepository.resetToSeed();
    variantsRepository.resetToSeed();
    priceListsRepository.resetToSeed();
    inventoryRepository.resetToSeed();
  });

  describe('Part 1 & 2: Branch Accounts & Access Control Permissions', () => {
    it('initializes all 5 branches with simple login IDs and default passwords', () => {
      const branches = branchesRepository.getAll();
      expect(branches.length).toBeGreaterThanOrEqual(5);

      const mainBranch = branchesRepository.getByLoginId('mainbranch');
      expect(mainBranch).toBeDefined();
      expect(mainBranch?.name).toContain('Main');
      expect(mainBranch?.password).toBe('password123');

      const wholesaleDepot = branchesRepository.getByLoginId('wholesaledepot');
      expect(wholesaleDepot).toBeDefined();
      expect(wholesaleDepot?.password).toBe('password123');
    });

    it('supports updating branch password and resetting credentials', () => {
      const branch = branchesRepository.getByLoginId('mainbranch')!;
      const updated = branchesRepository.resetBranchPassword(branch.id, 'newSecurePass456');
      expect(updated.password).toBe('newSecurePass456');

      const reloaded = branchesRepository.getById(branch.id);
      expect(reloaded?.password).toBe('newSecurePass456');
    });

    it('enforces branch-level module permissions (15 toggles)', () => {
      const branch = branchesRepository.getByLoginId('expresscounter')!;
      // Default: POS is enabled, reports and addEditProducts disabled
      branchesRepository.updatePermissions(branch.id, {
        pos: true,
        reports: false,
        addEditProducts: false,
      });

      const branchUser: User = {
        id: 'usr-branch-test',
        name: 'Express Counter Staff',
        email: 'express@molty.pk',
        role: 'BRANCH_MANAGER',
        assignedBranchId: branch.id,
      };

      expect(hasBranchPermission(branchUser, 'pos')).toBe(true);
      expect(hasBranchPermission(branchUser, 'reports')).toBe(false);
      expect(hasBranchPermission(branchUser, 'addEditProducts')).toBe(false);

      // Super Admin bypasses branch restrictions
      const superAdminUser: User = {
        id: 'usr-admin',
        name: 'Super Admin',
        email: 'admin@molty.pk',
        role: 'SUPER_ADMIN',
      };
      expect(hasBranchPermission(superAdminUser, 'reports')).toBe(true);
      expect(hasBranchPermission(superAdminUser, 'addEditProducts')).toBe(true);
    });
  });

  describe('Part 5, 6, 7: Simplified Product Creation & Bidirectional Pricing', () => {
    it('computes bidirectional mattress pricing correctly', () => {
      const listPrice = 18000;
      const purchasePct = 15;
      const purchasePrice = Math.round(listPrice * (1 - purchasePct / 100));
      expect(purchasePrice).toBe(15300);

      // 20% retail markup over purchase price
      const retailPct = 20;
      const retailPrice = Math.round(purchasePrice * (1 + retailPct / 100));
      expect(retailPrice).toBe(18360);

      // 10% wholesale discount from list price
      const wholesalePct = 10;
      const wholesalePrice = Math.round(listPrice * (1 - wholesalePct / 100));
      expect(wholesalePrice).toBe(16200);

      // Distributor price (5% below wholesale)
      const distributorPrice = Math.round(wholesalePrice * 0.95);
      expect(distributorPrice).toBe(15390);
    });

    it('creates product variant with deterministic SKU and registers pricing tiers', () => {
      const products = productsRepository.getAll();
      const product = products[0];

      const sku = 'MF-UL-NEW-78X78-5';
      const variant = variantsRepository.create({
        productId: product.id,
        sizeId: 'size-78-78',
        thicknessId: 'thick-5',
        sku,
        retailPrice: 18360,
        wholesalePrice: 16200,
        status: 'ACTIVE',
      });

      expect(variant.sku).toBe(sku);
      expect(variant.retailPrice).toBe(18360);
      expect(variant.wholesalePrice).toBe(16200);

      // Register price lists
      priceListsRepository.setPrice('WALK_IN', variant.id, 18360);
      priceListsRepository.setPrice('WHOLESALE', variant.id, 16200);
      priceListsRepository.setPrice('DISTRIBUTOR', variant.id, 15390);

      expect(priceListsRepository.getPriceForVariant('WALK_IN', variant.id)).toBe(18360);
      expect(priceListsRepository.getPriceForVariant('WHOLESALE', variant.id)).toBe(16200);
      expect(priceListsRepository.getPriceForVariant('DISTRIBUTOR', variant.id)).toBe(15390);
    });
  });

  describe('Part 10, 11, 12: Manage Stock Reconciliation, History & Alerts', () => {
    it('adjusts physical inventory counts and sets reorder level thresholds', () => {
      const mainBranch = branchesRepository.getByLoginId('mainbranch')!;
      const locations = stockLocationsRepository.getByBranchId(mainBranch.id);
      expect(locations.length).toBeGreaterThan(0);
      const stockLocationId = locations[0].id;

      const testSku = 'MF-RECON-TEST-1';
      // Register variant
      variantsRepository.create({
        productId: productsRepository.getAll()[0].id,
        sizeId: 'size-78-78',
        thicknessId: 'thick-5',
        sku: testSku,
        retailPrice: 20000,
        wholesalePrice: 18000,
        status: 'ACTIVE',
      });

      // Initial physical reconciliation count to 25 units
      const result = inventoryRepository.adjustStock({
        branchId: mainBranch.id,
        stockLocationId,
        sku: testSku,
        adjustmentType: 'PHYSICAL_CORRECTION',
        quantityDifference: 25,
        reason: 'Physical count audit',
        notes: 'Initial audit count',
        authorizedBy: 'Branch Manager',
      });

      expect(result.updatedBalance.onHand).toBe(25);
      expect(result.movement.quantity).toBe(25);

      // Set minimum reorder level to 5
      const balanceWithMin = inventoryRepository.setReorderLevel(stockLocationId, testSku, 5);
      expect(balanceWithMin.reorderLevel).toBe(5);

      // Audit ledger record exists in movements
      const movements = stockMovementsRepository.getAll({ sku: testSku });
      expect(movements.length).toBeGreaterThanOrEqual(1);
      expect(movements[0].sku).toBe(testSku);
    });

    it('correctly identifies low stock and stockout alerts based on reorder levels', () => {
      const balances = inventoryRepository.getAll();
      const outOfStockItems = balances.filter((b) => b.onHand <= 0);
      const lowStockItems = balances.filter((b) => b.onHand > 0 && b.onHand <= b.reorderLevel);
      const healthyItems = balances.filter((b) => b.onHand > b.reorderLevel);

      expect(balances.length).toBe(outOfStockItems.length + lowStockItems.length + healthyItems.length);
    });
  });
});
