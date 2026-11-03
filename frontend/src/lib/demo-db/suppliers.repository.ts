import { Supplier, SupplierStatus } from '@/types';
import {
  STORAGE_KEYS,
  CreateSupplierDTO,
  UpdateSupplierDTO,
  SupplierFilterOptions,
} from './schema';
import { demoStorage } from './storage';
import { SEED_SUPPLIERS } from './seed';

export class SuppliersRepository {
  private getSuppliersInternal(): Supplier[] {
    const list = demoStorage.getItem<Supplier[]>(STORAGE_KEYS.SUPPLIERS, []);
    if (!list || list.length === 0) {
      demoStorage.setItem(STORAGE_KEYS.SUPPLIERS, [...SEED_SUPPLIERS]);
      return [...SEED_SUPPLIERS];
    }
    return list;
  }

  private saveSuppliersInternal(suppliers: Supplier[]): void {
    demoStorage.setItem(STORAGE_KEYS.SUPPLIERS, suppliers);
  }

  public getAll(filter?: SupplierFilterOptions): Supplier[] {
    let list = this.getSuppliersInternal();

    if (!filter) {
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }

    if (filter.status && filter.status !== 'ALL') {
      list = list.filter((s) => s.status === filter.status);
    }

    if (filter.city && filter.city !== 'ALL') {
      list = list.filter((s) => s.city.toLowerCase() === filter.city!.toLowerCase());
    }

    if (filter.brandId && filter.brandId !== 'ALL') {
      list = list.filter((s) => s.suppliedBrands?.includes(filter.brandId!));
    }

    if (filter.hasOutstanding) {
      list = list.filter((s) => s.currentOutstanding > 0);
    }

    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          s.contactPerson.toLowerCase().includes(q) ||
          s.phone.includes(q) ||
          (s.city && s.city.toLowerCase().includes(q))
      );
    }

    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }

  public getById(id: string): Supplier | null {
    const list = this.getSuppliersInternal();
    return list.find((s) => s.id === id || s.code === id) || null;
  }

  public getByCode(code: string): Supplier | null {
    const list = this.getSuppliersInternal();
    return list.find((s) => s.code.toUpperCase() === code.trim().toUpperCase()) || null;
  }

  public getNextCode(): string {
    const list = this.getSuppliersInternal();
    const nextNum = list.length + 1;
    return `SUP-${String(nextNum).padStart(3, '0')}`;
  }

  public getNextSupplierCode(): string {
    return this.getNextCode();
  }

  public create(dto: CreateSupplierDTO): Supplier {
    const list = this.getSuppliersInternal();

    const code = (dto.code?.trim() || this.getNextCode()).toUpperCase();

    if (list.some((s) => s.code.toUpperCase() === code)) {
      throw new Error(`Supplier with code "${code}" already exists.`);
    }

    if (list.some((s) => s.name.trim().toLowerCase() === dto.name.trim().toLowerCase())) {
      throw new Error(`Supplier with name "${dto.name}" already exists.`);
    }

    const now = new Date().toISOString();
    const opening = Math.max(0, dto.openingPayable || 0);

    const newSupplier: Supplier = {
      id: `SUP-${Date.now().toString().slice(-6)}`,
      code,
      name: dto.name.trim(),
      contactPerson: dto.contactPerson.trim(),
      phone: dto.phone.trim(),
      whatsapp: dto.whatsapp?.trim() || undefined,
      email: dto.email?.trim() || undefined,
      address: dto.address ? dto.address.trim() : '',
      city: dto.city ? dto.city.trim() : 'Lahore',
      taxNumber: dto.taxNumber?.trim() || undefined,
      suppliedBrands: dto.suppliedBrands || [],
      creditEnabled: dto.creditEnabled ?? true,
      defaultCreditDays: dto.defaultCreditDays || dto.defaultDueDays || 30,
      defaultDueDays: dto.defaultDueDays || dto.defaultCreditDays || 30,
      paymentTerms: dto.paymentTerms || 'Net 30',
      creditLimit: dto.creditLimit,
      bankName: dto.bankName?.trim() || undefined,
      bankAccountNumber: dto.bankAccountNumber?.trim() || undefined,
      openingPayable: opening,
      currentOutstanding: opening,
      status: dto.status || 'ACTIVE',
      notes: dto.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    list.unshift(newSupplier);
    this.saveSuppliersInternal(list);
    return newSupplier;
  }

  public update(id: string, dto: UpdateSupplierDTO): Supplier {
    const list = this.getSuppliersInternal();
    const index = list.findIndex((s) => s.id === id);
    if (index === -1) {
      throw new Error(`Supplier with ID "${id}" not found.`);
    }

    const current = list[index];

    if (dto.name && dto.name.trim().toLowerCase() !== current.name.toLowerCase()) {
      const duplicateName = list.some(
        (s) => s.id !== id && s.name.trim().toLowerCase() === dto.name!.trim().toLowerCase()
      );
      if (duplicateName) {
        throw new Error(`Supplier with name "${dto.name}" already exists.`);
      }
    }

    const updated: Supplier = {
      ...current,
      name: dto.name?.trim() ?? current.name,
      contactPerson: dto.contactPerson?.trim() ?? current.contactPerson,
      phone: dto.phone?.trim() ?? current.phone,
      whatsapp: dto.whatsapp !== undefined ? dto.whatsapp.trim() || undefined : current.whatsapp,
      email: dto.email !== undefined ? dto.email.trim() || undefined : current.email,
      address: dto.address?.trim() ?? current.address,
      city: dto.city?.trim() ?? current.city,
      taxNumber: dto.taxNumber !== undefined ? dto.taxNumber.trim() || undefined : current.taxNumber,
      suppliedBrands: dto.suppliedBrands ?? current.suppliedBrands,
      creditEnabled: dto.creditEnabled ?? current.creditEnabled,
      defaultCreditDays: dto.defaultCreditDays ?? current.defaultCreditDays,
      creditLimit: dto.creditLimit !== undefined ? dto.creditLimit : current.creditLimit,
      status: dto.status ?? current.status,
      notes: dto.notes !== undefined ? dto.notes.trim() || undefined : current.notes,
      updatedAt: new Date().toISOString(),
    };

    list[index] = updated;
    this.saveSuppliersInternal(list);
    return updated;
  }

  public toggleStatus(id: string): Supplier {
    const list = this.getSuppliersInternal();
    const index = list.findIndex((s) => s.id === id);
    if (index === -1) {
      throw new Error(`Supplier with ID "${id}" not found.`);
    }

    const newStatus: SupplierStatus = list[index].status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    list[index] = {
      ...list[index],
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };

    this.saveSuppliersInternal(list);
    return list[index];
  }

  public adjustOutstanding(id: string, deltaAmount: number): Supplier {
    const list = this.getSuppliersInternal();
    const index = list.findIndex((s) => s.id === id);
    if (index === -1) {
      throw new Error(`Supplier with ID "${id}" not found.`);
    }

    const current = list[index];
    const newOutstanding = Math.max(0, current.currentOutstanding + deltaAmount);

    const updated: Supplier = {
      ...current,
      currentOutstanding: newOutstanding,
      updatedAt: new Date().toISOString(),
    };

    list[index] = updated;
    this.saveSuppliersInternal(list);
    return updated;
  }

  public getCounts(): {
    total: number;
    active: number;
    inactive: number;
    withOutstanding: number;
    totalPayables: number;
  } {
    const list = this.getSuppliersInternal();
    return {
      total: list.length,
      active: list.filter((s) => s.status === 'ACTIVE').length,
      inactive: list.filter((s) => s.status === 'INACTIVE').length,
      withOutstanding: list.filter((s) => s.currentOutstanding > 0).length,
      totalPayables: list.reduce((sum, s) => sum + s.currentOutstanding, 0),
    };
  }

  public resetToSeed(): Supplier[] {
    const seed = [...SEED_SUPPLIERS];
    demoStorage.setItem(STORAGE_KEYS.SUPPLIERS, seed);
    return seed;
  }
}

export const suppliersRepository = new SuppliersRepository();
