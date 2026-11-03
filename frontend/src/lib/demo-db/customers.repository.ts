import { Customer } from '@/types';
import {
  STORAGE_KEYS,
  CreateCustomerDTO,
  UpdateCustomerDTO,
  CustomerFilterOptions,
} from './schema';
import { SEED_CUSTOMERS } from './seed';
import { demoStorage } from './storage';

export class CustomersRepository {
  private getCustomersInternal(): Customer[] {
    const list = demoStorage.getItem<Customer[]>(STORAGE_KEYS.CUSTOMERS, []);
    if (!list || list.length === 0) {
      const seeded = SEED_CUSTOMERS.map((c) => ({
        ...c,
        customerCode: c.code || c.customerCode,
      }));
      demoStorage.setItem(STORAGE_KEYS.CUSTOMERS, seeded);
      return seeded;
    }
    return list.map((c) => ({
      ...c,
      customerCode: c.code || c.customerCode,
    }));
  }

  private saveCustomersInternal(customers: Customer[]): void {
    demoStorage.setItem(STORAGE_KEYS.CUSTOMERS, customers);
  }

  public getAll(filter?: CustomerFilterOptions): Customer[] {
    let list = this.getCustomersInternal();

    if (!filter) {
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }

    if (filter.customerType && filter.customerType !== 'ALL') {
      list = list.filter((c) => {
        if (filter.customerType === 'WALK_IN' && c.customerType === 'RETAIL') return true;
        return c.customerType === filter.customerType;
      });
    }

    if (filter.status && filter.status !== 'ALL') {
      list = list.filter((c) => c.status === filter.status);
    }

    if (filter.hasOutstanding) {
      list = list.filter((c) => c.currentOutstanding > 0);
    }

    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (c.businessName && c.businessName.toLowerCase().includes(q)) ||
          (c.city && c.city.toLowerCase().includes(q))
      );
    }

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }

  public getById(id: string): Customer | null {
    const list = this.getCustomersInternal();
    return list.find((c) => c.id === id || c.code === id) || null;
  }

  public getByCode(code: string): Customer | null {
    const list = this.getCustomersInternal();
    return list.find((c) => c.code.toLowerCase() === code.toLowerCase()) || null;
  }

  public create(dto: CreateCustomerDTO): Customer {
    const list = this.getCustomersInternal();

    // Check duplicate code
    const generatedCode =
      dto.code?.trim().toUpperCase() ||
      `CUST-${(dto.customerType || 'WS').slice(0, 2).toUpperCase()}-${String(list.length + 1).padStart(3, '0')}`;

    if (list.some((c) => c.code.toUpperCase() === generatedCode)) {
      throw new Error(`Customer code "${generatedCode}" is already in use.`);
    }

    const now = new Date().toISOString();
    const creditLimit = dto.creditLimit ?? 100000;
    const openingBalance = dto.openingBalance ?? 0;

    const newCustomer: Customer = {
      id: `CUST-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
      code: generatedCode,
      customerCode: generatedCode,
      name: dto.name.trim(),
      businessName: dto.businessName?.trim() || undefined,
      phone: dto.phone.trim(),
      email: dto.email?.trim() || undefined,
      customerType: dto.customerType,
      address: dto.address?.trim() || undefined,
      city: dto.city?.trim() || 'Lahore',
      ntn: dto.ntn?.trim() || undefined,
      creditEnabled: dto.creditEnabled ?? true,
      creditLimit,
      currentOutstanding: openingBalance,
      availableCredit: Math.max(0, creditLimit - openingBalance),
      creditTerms: dto.creditTerms?.trim() || 'Net 30',
      defaultDueDays: dto.defaultDueDays ?? 30,
      openingBalance,
      status: dto.status || 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    list.unshift(newCustomer);
    this.saveCustomersInternal(list);
    return newCustomer;
  }

  public update(id: string, dto: UpdateCustomerDTO): Customer {
    const list = this.getCustomersInternal();
    const index = list.findIndex((c) => c.id === id);
    if (index === -1) {
      throw new Error(`Customer with ID "${id}" does not exist.`);
    }

    const current = list[index];
    const creditLimit = dto.creditLimit !== undefined ? dto.creditLimit : current.creditLimit;
    const currentOutstanding = current.currentOutstanding;

    const updated: Customer = {
      ...current,
      name: dto.name !== undefined ? dto.name.trim() : current.name,
      businessName: dto.businessName !== undefined ? dto.businessName?.trim() : current.businessName,
      phone: dto.phone !== undefined ? dto.phone.trim() : current.phone,
      email: dto.email !== undefined ? dto.email?.trim() : current.email,
      customerType: dto.customerType !== undefined ? dto.customerType : current.customerType,
      address: dto.address !== undefined ? dto.address?.trim() : current.address,
      city: dto.city !== undefined ? dto.city?.trim() : current.city,
      ntn: dto.ntn !== undefined ? dto.ntn?.trim() : current.ntn,
      creditEnabled: dto.creditEnabled !== undefined ? dto.creditEnabled : current.creditEnabled,
      creditLimit,
      availableCredit: Math.max(0, creditLimit - currentOutstanding),
      creditTerms: dto.creditTerms !== undefined ? dto.creditTerms?.trim() : current.creditTerms,
      defaultDueDays: dto.defaultDueDays !== undefined ? dto.defaultDueDays : current.defaultDueDays,
      status: dto.status !== undefined ? dto.status : current.status,
      updatedAt: new Date().toISOString(),
    };

    list[index] = updated;
    this.saveCustomersInternal(list);
    return updated;
  }

  public adjustOutstanding(id: string, delta: number): Customer {
    const list = this.getCustomersInternal();
    const index = list.findIndex((c) => c.id === id);
    if (index === -1) {
      throw new Error(`Customer with ID "${id}" does not exist.`);
    }

    const current = list[index];
    const newOutstanding = Math.max(0, current.currentOutstanding + delta);
    const updated: Customer = {
      ...current,
      currentOutstanding: newOutstanding,
      availableCredit: Math.max(0, current.creditLimit - newOutstanding),
      updatedAt: new Date().toISOString(),
    };

    list[index] = updated;
    this.saveCustomersInternal(list);
    return updated;
  }

  public resetToSeed(): Customer[] {
    const seed = [...SEED_CUSTOMERS];
    demoStorage.setItem(STORAGE_KEYS.CUSTOMERS, seed);
    return seed;
  }
}

export const customersRepository = new CustomersRepository();
