import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { Branch, Account, StockLocation } from '../models/index.js';
import { ACCOUNT_ROLES, STANDARD_BRANCH_PERMISSIONS, StockLocationType } from '../constants/index.js';
import { logger } from '../utils/logger.js';

interface BranchSeedData {
  code: string;
  name: string;
  shopNumber: string;
  type: 'MAIN' | 'SHOWROOM' | 'DEPOT' | 'STUDIO' | 'EXPRESS' | 'RETAIL_STORE' | 'WAREHOUSE' | 'WHOLESALE_DEPOT' | 'EXPRESS_COUNTER';
  city: string;
  address: string;
  phone: string;
  loginId: string;
  targetMonthlySales: number;
}

/**
 * All five branches belong to the same local commercial market cluster in Karachi.
 * Distant city allocations (Lahore, Islamabad, Rawalpindi, Faisalabad) are removed.
 */
const SEED_BRANCHES: BranchSeedData[] = [
  {
    code: 'SHOP-12',
    name: 'Main Branch',
    shopNumber: 'Shop #12–14',
    type: 'RETAIL_STORE',
    city: 'Karachi',
    address: 'Shop #12–14, Karachi',
    phone: '0300-1111111',
    loginId: 'mainbranch',
    targetMonthlySales: 4500000,
  },
  {
    code: 'SHOP-18',
    name: 'Display Center',
    shopNumber: 'Shop #18',
    type: 'SHOWROOM',
    city: 'Karachi',
    address: 'Shop #18, Karachi',
    phone: '0300-2222222',
    loginId: 'displaycenter',
    targetMonthlySales: 3500000,
  },
  {
    code: 'SHOP-24A',
    name: 'Wholesale Depot',
    shopNumber: 'Shop #24-A',
    type: 'WHOLESALE_DEPOT',
    city: 'Karachi',
    address: 'Shop #24-A, Karachi',
    phone: '0300-3333333',
    loginId: 'wholesaledepot',
    targetMonthlySales: 2500000,
  },
  {
    code: 'SHOP-06',
    name: 'Ortho Bedding Studio',
    shopNumber: 'Shop #06',
    type: 'STUDIO',
    city: 'Karachi',
    address: 'Shop #06, Karachi',
    phone: '0300-4444444',
    loginId: 'orthostudio',
    targetMonthlySales: 2000000,
  },
  {
    code: 'SHOP-31',
    name: 'Express Counter',
    shopNumber: 'Shop #31',
    type: 'EXPRESS_COUNTER',
    city: 'Karachi',
    address: 'Shop #31, Karachi',
    phone: '0300-5555555',
    loginId: 'expresscounter',
    targetMonthlySales: 1500000,
  },
];

export async function runSeed(customUri?: string) {
  logger.info('Starting idempotent MongoDB seed and correction process...');
  await connectDatabase(customUri);

  try {
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    const branchPassword = process.env.SEED_BRANCH_PASSWORD;

    // 1. Seed Super Admin Account
    const existingAdmin = await Account.findOne({ role: ACCOUNT_ROLES.SUPER_ADMIN });
    if (!existingAdmin) {
      if (!adminPassword) {
        throw new Error(
          'CRITICAL CONFIG ERROR: SEED_ADMIN_PASSWORD environment variable is required to provision the initial Super Admin account. Halting.'
        );
      }
      const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
      const adminAccount = await Account.create({
        loginId: 'admin',
        name: 'Super Administrator',
        email: 'admin@moltyfoam.store',
        passwordHash: adminPasswordHash,
        role: ACCOUNT_ROLES.SUPER_ADMIN,
        permissions: {
          pos: true,
          viewOwnSales: true,
          viewProducts: true,
          addEditProducts: true,
          viewStock: true,
          manageStock: true,
          stockTransfers: true,
          customers: true,
          customerCredit: true,
          purchases: true,
          suppliers: true,
          reports: true,
          returns: true,
          discountsOverrides: true,
        },
        isActive: true,
      });
      logger.info({ id: adminAccount._id, loginId: adminAccount.loginId }, 'Created Super Admin account');
    } else {
      logger.info({ loginId: existingAdmin.loginId }, 'Super Admin account already exists. Preserving credentials.');
    }

    // 2. Seed Branches and Branch Accounts with Location Correction Migration
    for (const item of SEED_BRANCHES) {
      let branch = await Branch.findOne({ code: item.code });
      if (!branch) {
        branch = await Branch.create({
          code: item.code,
          name: item.name,
          shopNumber: item.shopNumber,
          type: item.type,
          city: item.city,
          address: item.address,
          phone: item.phone,
          loginId: item.loginId,
          targetMonthlySales: item.targetMonthlySales,
          permissions: { ...STANDARD_BRANCH_PERMISSIONS },
          isActive: true,
        });
        logger.info({ code: branch.code, name: branch.name }, 'Created Branch record in Karachi cluster');
      } else {
        // Safe correction migration: check if previously seeded with distant city or unverified market artifacts
        const isDistantCity = ['Lahore', 'Rawalpindi', 'Islamabad', 'Faisalabad'].some(
          (distant) => (branch?.city || '').includes(distant) || (branch?.address || '').includes(distant)
        );
        const hasUnverifiedMarketAddress = (branch?.address || '').includes('Central Mattress Market');
        const hasOutdatedName = branch?.name !== item.name;

        if (isDistantCity || hasUnverifiedMarketAddress || hasOutdatedName) {
          logger.info(
            { code: branch.code, previousAddress: branch.address, newAddress: item.address },
            'Migrating branch address/name to verified local cluster shop specification'
          );
          branch.name = item.name;
          branch.shopNumber = item.shopNumber;
          branch.city = item.city;
          branch.address = item.address;
          await branch.save();
        } else {
          logger.info({ code: branch.code }, 'Branch record verified in local cluster.');
        }
      }

      // Check branch account
      const existingBranchAccount = await Account.findOne({ branchId: branch._id });
      if (!existingBranchAccount) {
        if (!branchPassword) {
          throw new Error(
            `CRITICAL CONFIG ERROR: SEED_BRANCH_PASSWORD environment variable is required to provision account for branch '${item.name}'. Halting.`
          );
        }
        const branchPasswordHash = await bcrypt.hash(branchPassword, 10);
        const branchAccount = await Account.create({
          loginId: item.loginId,
          name: item.name,
          email: `${item.loginId}@moltyfoam.store`,
          passwordHash: branchPasswordHash,
          role: ACCOUNT_ROLES.BRANCH,
          branchId: branch._id,
          permissions: { ...STANDARD_BRANCH_PERMISSIONS },
          isActive: true,
        });
        logger.info({ loginId: branchAccount.loginId, branch: branch.name }, 'Created Branch Account');
      } else {
        logger.info({ loginId: existingBranchAccount.loginId }, 'Branch Account already exists. Preserving credentials.');
      }

      // Ensure default Stock Locations exist for each branch
      const defaultLocations: { code: string; name: string; type: StockLocationType }[] = [
        { code: 'LOC-FLOOR', name: 'Sales Floor', type: 'SALES_FLOOR' },
        { code: 'LOC-BACKROOM', name: 'Store Backroom', type: 'BACK_ROOM' },
      ];

      for (const loc of defaultLocations) {
        const existingLoc = await StockLocation.findOne({ branchId: branch._id, code: loc.code });
        if (!existingLoc) {
          await StockLocation.create({
            branchId: branch._id,
            code: loc.code,
            name: `${branch.name} - ${loc.name}`,
            type: loc.type,
            isActive: true,
          });
        }
      }
    }

    logger.info('MongoDB seed and location migration completed successfully.');
  } catch (error) {
    logger.error({ error }, 'Error during MongoDB seeding process');
    throw error;
  } finally {
    await disconnectDatabase();
  }
}

// Allow direct CLI invocation
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  runSeed().catch((err) => {
    console.error('Fatal seed error:', err);
    process.exit(1);
  });
}
