import mongoose from 'mongoose';
import {
  Brand,
  Category,
  Size,
  Thickness,
  Product,
  Variant,
  StockBalance,
  StockLocation,
  StockMovement,
  SalesInvoice,
  Customer,
  CustomerLedgerEntry,
  Payment,
  HeldSale,
  IdempotencyKey,
} from '../../models/index.js';
import {
  SALE_TYPES,
  PAYMENT_STATUSES,
  PaymentStatus,
  PAYMENT_ARRANGEMENTS,
  STOCK_MOVEMENT_TYPES,
  CUSTOMER_TYPES,
} from '../../constants/index.js';
import { AppError } from '../../utils/apiResponse.js';
import { runTransaction } from '../../utils/transaction.js';
import { generateDailySequence } from '../../utils/sequence.js';
import { CheckoutInput, HeldSaleInput } from './pos.schema.js';

export interface UserContext {
  accountId: string;
  loginId: string;
  role: 'SUPER_ADMIN' | 'BRANCH';
  branchId?: string;
}

export class PosService {
  /**
   * 1. GET POS CATALOGUE
   * Returns active brands, categories, sizes, thicknesses, products and active variants
   * with prices formatted for POS and sensitive purchase prices stripped.
   */
  public static async getPOSCatalogue(userContext: UserContext) {
    const [brands, categories, sizes, thicknesses, products, variants] = await Promise.all([
      Brand.find({ status: 'ACTIVE' }).select('name code description').lean(),
      Category.find({ status: 'ACTIVE' }).select('brandId name code description').lean(),
      Size.find({ status: 'ACTIVE' }).select('displayLabel length width unit').lean(),
      Thickness.find({ status: 'ACTIVE' }).select('displayLabel value unit').lean(),
      Product.find({ status: 'ACTIVE' }).select('name code brandId categoryId').lean(),
      Variant.find({ status: 'ACTIVE' })
        .populate('sizeId', 'displayLabel length width')
        .populate('thicknessId', 'displayLabel value')
        .populate('productId', 'name code brandId categoryId')
        .select('-purchasePrice -purchaseDiscountPercent')
        .lean(),
    ]);

    // Map variants for easy POS consumption
    const formattedVariants = variants.map((v: any) => ({
      id: v._id.toString(),
      productId: v.productId?._id?.toString() || v.productId?.toString(),
      sku: v.sku,
      productName: v.productId?.name || 'Product',
      sizeLabel: v.sizeId?.displayLabel || `${v.sizeId?.length}x${v.sizeId?.width}`,
      thicknessLabel: v.thicknessId?.displayLabel || `${v.thicknessId?.value} inch`,
      retailPrice: (v.retailPrice || 0) / 100,
      wholesalePrice: (v.wholesalePrice || 0) / 100,
      distributorPrice: (v.distributorPrice || 0) / 100,
      listPrice: (v.listPrice || 0) / 100,
    }));

    return {
      brands,
      categories,
      sizes,
      thicknesses,
      products,
      variants: formattedVariants,
    };
  }

  /**
   * 2. GET SKU STOCK AVAILABILITY FOR POS
   * Accessible by POS cashier accounts without warehouse viewStock permission.
   */
  public static async getSkuAvailability(skuOrId: string, userContext: UserContext) {
    let sku = skuOrId;
    if (mongoose.Types.ObjectId.isValid(skuOrId)) {
      const v = await Variant.findById(skuOrId).select('sku');
      if (v) sku = v.sku;
    }

    let branchId = userContext.branchId;
    if (userContext.role === 'SUPER_ADMIN' && !branchId) {
      // Find main branch as default
      const mb = await mongoose.model('Branch').findOne({ code: 'SHOP-12-14' }).select('_id');
      if (mb) branchId = mb._id.toString();
    }

    if (!branchId) {
      throw new AppError('Branch context required for stock availability.', 400, 'BRANCH_CONTEXT_REQUIRED');
    }

    const balances = await StockBalance.find({
      branchId: new mongoose.Types.ObjectId(branchId),
      sku: sku.toUpperCase(),
    }).lean();

    let totalOnHand = 0;
    let totalReserved = 0;

    for (const bal of balances) {
      totalOnHand += bal.onHand;
      totalReserved += bal.reserved || 0;
    }

    const available = Math.max(0, totalOnHand - totalReserved);

    return {
      sku: sku.toUpperCase(),
      branchId,
      onHand: totalOnHand,
      reserved: totalReserved,
      available,
    };
  }

  /**
   * 3. ATOMIC POS CHECKOUT
   * Single authoritative financial and inventory transaction:
   * - Authoritative price lookup from DB (ignoring client unitPrice)
   * - Integer-paisa financial calculations
   * - Concurrency-safe atomic stock deduction with $gte conditional check
   * - Customer credit limit enforcement and audit logging
   * - Immutable SalesInvoice and StockMovement creation
   * - Customer ledger posting and receivables update
   */
  public static async checkout(input: CheckoutInput, userContext: UserContext) {
    return await runTransaction(async (session) => {
      // 1. Idempotency Check
      if (input.idempotencyKey) {
        const existingInvoice = await SalesInvoice.findOne({
          idempotencyKey: input.idempotencyKey,
        }).session(session);
        if (existingInvoice) {
          return {
            invoice: existingInvoice,
            message: 'Idempotent replay: original checkout result returned.',
            isReplay: true,
          };
        }
      }

      // 2. Resolve Effective Branch
      let effectiveBranchId: mongoose.Types.ObjectId;
      if (userContext.role === 'SUPER_ADMIN' && input.branchId) {
        effectiveBranchId = new mongoose.Types.ObjectId(input.branchId);
      } else if (userContext.branchId) {
        effectiveBranchId = new mongoose.Types.ObjectId(userContext.branchId);
      } else {
        throw new AppError('Branch identity required for checkout.', 403, 'NO_BRANCH_ASSIGNED');
      }

      // 3. Resolve Target Stock Location
      let targetLocation;
      if (input.stockLocationId) {
        targetLocation = await StockLocation.findOne({
          _id: new mongoose.Types.ObjectId(input.stockLocationId),
          branchId: effectiveBranchId,
          isActive: true,
        }).session(session);
      }

      if (!targetLocation) {
        targetLocation = await StockLocation.findOne({
          branchId: effectiveBranchId,
          isActive: true,
        })
          .sort({ isDefault: -1, createdAt: 1 })
          .session(session);
      }

      if (!targetLocation) {
        throw new AppError('No active stock location available for this branch.', 404, 'STOCK_LOCATION_NOT_FOUND');
      }

      // 4. Resolve Authoritative Prices & Line Items in Integer Paisa
      let subtotalPaisa = 0;
      const resolvedLineItems: Array<{
        variantId: mongoose.Types.ObjectId;
        sku: string;
        productName: string;
        sizeLabel: string;
        thicknessLabel: string;
        quantity: number;
        unitPrice: number; // in Rupees
        lineTotal: number; // in Rupees
        unitPricePaisa: number;
        lineTotalPaisa: number;
      }> = [];

      for (const item of input.items) {
        const variant = await Variant.findOne({
          sku: item.sku.toUpperCase(),
          status: 'ACTIVE',
        })
          .populate('productId')
          .populate('sizeId')
          .populate('thicknessId')
          .session(session);

        if (!variant) {
          throw new AppError(
            `SKU "${item.sku}" not found or is currently inactive.`,
            404,
            'SKU_NOT_FOUND',
            { sku: item.sku }
          );
        }

        // Authoritative Selling Price based on Sale Type (Stored in Paisa)
        let authoritativePricePaisa: number;
        switch (input.saleType) {
          case SALE_TYPES.WHOLESALE:
            authoritativePricePaisa = variant.wholesalePrice;
            break;
          case SALE_TYPES.DISTRIBUTOR:
            authoritativePricePaisa = variant.distributorPrice;
            break;
          case SALE_TYPES.WALK_IN:
          default:
            authoritativePricePaisa = variant.retailPrice;
            break;
        }

        const itemDiscountPaisa = Math.round((item.discount || 0) * 100);
        const itemLineTotalPaisa = Math.max(0, authoritativePricePaisa * item.quantity - itemDiscountPaisa);

        subtotalPaisa += itemLineTotalPaisa;

        const prod = variant.productId as any;
        const sz = variant.sizeId as any;
        const th = variant.thicknessId as any;

        resolvedLineItems.push({
          variantId: variant._id as mongoose.Types.ObjectId,
          sku: variant.sku,
          productName: prod?.name || variant.sku,
          sizeLabel: sz?.displayLabel || `${sz?.length}x${sz?.width}`,
          thicknessLabel: th?.displayLabel || `${th?.value} inch`,
          quantity: item.quantity,
          unitPricePaisa: authoritativePricePaisa,
          lineTotalPaisa: itemLineTotalPaisa,
          unitPrice: authoritativePricePaisa / 100,
          lineTotal: itemLineTotalPaisa / 100,
        });
      }

      // 5. Total Calculations
      const discountPaisa = Math.round((input.discountAmount || 0) * 100);
      const totalPaisa = Math.max(0, subtotalPaisa - discountPaisa);

      const totalRupees = totalPaisa / 100;
      const subtotalRupees = subtotalPaisa / 100;
      const discountRupees = discountPaisa / 100;

      // 6. Payment & Credit Evaluation
      let paidAmountRupees = 0;
      let balanceDueRupees = 0;
      let cashReceivedRupees = input.cashReceived || 0;
      let changeReturnedRupees = 0;
      let paymentStatus: PaymentStatus = PAYMENT_STATUSES.PAID;

      if (input.paymentArrangement === PAYMENT_ARRANGEMENTS.FULL) {
        paidAmountRupees = totalRupees;
        balanceDueRupees = 0;
        paymentStatus = PAYMENT_STATUSES.PAID;
        if (cashReceivedRupees > totalRupees) {
          changeReturnedRupees = Math.round((cashReceivedRupees - totalRupees) * 100) / 100;
        }
      } else if (input.paymentArrangement === PAYMENT_ARRANGEMENTS.PARTIAL) {
        paidAmountRupees = Math.min(totalRupees, Math.max(0, input.amountReceived || 0));
        balanceDueRupees = Math.round((totalRupees - paidAmountRupees) * 100) / 100;
        paymentStatus = balanceDueRupees === 0 ? PAYMENT_STATUSES.PAID : PAYMENT_STATUSES.PARTIAL;
      } else if (input.paymentArrangement === PAYMENT_ARRANGEMENTS.CREDIT) {
        paidAmountRupees = 0;
        balanceDueRupees = totalRupees;
        paymentStatus = PAYMENT_STATUSES.UNPAID;
      }

      // 7. Customer Credit Limit Verification
      let customer: any = null;
      if (input.customerId) {
        customer = await Customer.findById(input.customerId).session(session);
        if (!customer) {
          throw new AppError('Selected customer does not exist.', 404, 'CUSTOMER_NOT_FOUND');
        }
      }

      if (balanceDueRupees > 0) {
        if (!customer) {
          throw new AppError(
            'An identified customer is strictly required for credit or partial sales (Udhaar). Anonymous walk-ins cannot purchase on credit.',
            400,
            'ANONYMOUS_CREDIT_REJECTED'
          );
        }

        if (customer.status !== 'ACTIVE') {
          throw new AppError(
            `Customer account is "${customer.status}". Credit sales are prohibited.`,
            403,
            'CUSTOMER_NOT_ACTIVE'
          );
        }

        // Available credit calculation
        const existingOutstanding = customer.outstandingBalance || 0;
        const availableCredit = Math.max(0, customer.creditLimit - existingOutstanding);

        if (!customer.creditEnabled && !input.creditOverride) {
          throw new AppError(
            `Credit is not enabled for customer "${customer.name}". Supervisor override required.`,
            403,
            'CREDIT_NOT_ENABLED'
          );
        }

        if (balanceDueRupees > availableCredit && !input.creditOverride) {
          throw new AppError(
            `Customer credit limit exceeded. Available credit: Rs. ${availableCredit.toLocaleString()}, required: Rs. ${balanceDueRupees.toLocaleString()}. Supervisor override is required.`,
            400,
            'CREDIT_LIMIT_EXCEEDED',
            {
              customer: customer.name,
              creditLimit: customer.creditLimit,
              existingOutstanding,
              availableCredit,
              requiredCredit: balanceDueRupees,
            }
          );
        }
      }

      // 8. Atomic Concurrency-Safe Stock Deduction
      // Consolidate repeated SKUs across cart lines
      const skuQuantityMap = new Map<string, number>();
      for (const item of input.items) {
        const skuKey = item.sku.toUpperCase();
        skuQuantityMap.set(skuKey, (skuQuantityMap.get(skuKey) || 0) + item.quantity);
      }

      // Generate Invoice Reference early for movement tracking
      const invoiceNumber = await generateDailySequence('INV', session);

      for (const [skuKey, totalRequiredQty] of skuQuantityMap.entries()) {
        const updatedBal = await StockBalance.findOneAndUpdate(
          {
            branchId: effectiveBranchId,
            stockLocationId: targetLocation._id,
            sku: skuKey,
            onHand: { $gte: totalRequiredQty },
          },
          {
            $inc: { onHand: -totalRequiredQty },
          },
          { session, new: true }
        );

        if (!updatedBal) {
          const currentBal = await StockBalance.findOne({
            branchId: effectiveBranchId,
            stockLocationId: targetLocation._id,
            sku: skuKey,
          }).session(session);

          const availableNow = currentBal ? currentBal.onHand - (currentBal.reserved || 0) : 0;
          throw new AppError(
            `Insufficient stock for SKU "${skuKey}". Available: ${availableNow}, Requested: ${totalRequiredQty}. Checkout aborted.`,
            400,
            'INSUFFICIENT_STOCK',
            {
              sku: skuKey,
              available: availableNow,
              requested: totalRequiredQty,
            }
          );
        }

        // Create immutable audit ledger movement entry
        const movementNumber = await generateDailySequence('MOV-POS', session);
        await StockMovement.create(
          [
            {
              movementNumber,
              branchId: effectiveBranchId,
              stockLocationId: targetLocation._id,
              sku: skuKey,
              movementType: STOCK_MOVEMENT_TYPES.SALE_DEDUCTION,
              quantityDifference: -totalRequiredQty,
              previousBalance: updatedBal.onHand + totalRequiredQty,
              newBalance: updatedBal.onHand,
              referenceType: 'SALES_INVOICE',
              referenceId: invoiceNumber,
              reason: `POS sale checkout (${input.saleType})`,
              performedBy: userContext.loginId,
              timestamp: new Date(),
            },
          ],
          { session }
        );
      }

      // 9. Create Sales Invoice Snapshot
      const [invoice] = await SalesInvoice.create(
        [
          {
            invoiceNumber,
            branchId: effectiveBranchId,
            customerId: customer?._id,
            customerName: customer ? customer.name : input.customerName || 'Walk-in Customer',
            customerPhone: customer ? customer.phone : input.customerPhone,
            customerType: customer ? customer.customerType : CUSTOMER_TYPES.WALK_IN,
            saleType: input.saleType,
            items: resolvedLineItems.map((r) => ({
              variantId: r.variantId,
              sku: r.sku,
              productName: r.productName,
              sizeLabel: r.sizeLabel,
              thicknessLabel: r.thicknessLabel,
              quantity: r.quantity,
              unitPrice: r.unitPrice,
              lineTotal: r.lineTotal,
            })),
            subtotal: subtotalRupees,
            discount: discountRupees,
            tax: 0,
            total: totalRupees,
            paidAmount: paidAmountRupees,
            balanceDue: balanceDueRupees,
            paymentStatus,
            paymentArrangement: input.paymentArrangement,
            cashReceived: cashReceivedRupees,
            changeReturned: changeReturnedRupees,
            dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
            creditOverride: input.creditOverride,
            creditApprovedBy: input.creditOverride ? input.creditApprovedBy || userContext.loginId : undefined,
            overrideReason: input.overrideReason,
            cashierName: userContext.loginId,
            notes: input.notes,
            idempotencyKey: input.idempotencyKey,
          },
        ],
        { session }
      );

      // 10. Customer Ledger Posting & Outstanding Balance Update
      if (customer && balanceDueRupees > 0) {
        const newOutstanding = (customer.outstandingBalance || 0) + balanceDueRupees;
        customer.outstandingBalance = newOutstanding;
        await customer.save({ session });

        await CustomerLedgerEntry.create(
          [
            {
              customerId: customer._id,
              branchId: effectiveBranchId,
              entryType: 'INVOICE',
              referenceInvoiceId: invoiceNumber,
              debit: totalRupees,
              credit: paidAmountRupees,
              runningBalance: newOutstanding,
              narration: `POS Invoice #${invoiceNumber} (${input.saleType}) - Invoiced: Rs. ${totalRupees.toLocaleString()}, Received: Rs. ${paidAmountRupees.toLocaleString()}, Outstanding: Rs. ${balanceDueRupees.toLocaleString()}`,
              performedBy: userContext.loginId,
              timestamp: new Date(),
            },
          ],
          { session }
        );
      }

      // 11. Record Payment Document for Cash/Card/Bank received
      if (paidAmountRupees > 0) {
        const paymentNumber = await generateDailySequence('PAY', session);
        await Payment.create(
          [
            {
              paymentNumber,
              invoiceId: invoice._id,
              customerId: customer?._id || new mongoose.Types.ObjectId(),
              branchId: effectiveBranchId,
              amount: paidAmountRupees,
              paymentMethod: input.paymentMethod === 'CREDIT_30D' ? 'CASH' : input.paymentMethod,
              reference: invoiceNumber,
              notes: `Payment for POS invoice ${invoiceNumber}`,
              collectedBy: userContext.loginId,
              paymentDate: new Date(),
            },
          ],
          { session }
        );
      }

      // 12. Persist Idempotency Store
      if (input.idempotencyKey) {
        await IdempotencyKey.create(
          [
            {
              key: input.idempotencyKey,
              endpoint: '/pos/checkout',
              responseStatus: 201,
              responseBody: { invoiceNumber },
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            },
          ],
          { session }
        );
      }

      return {
        invoice,
        message: 'POS checkout completed successfully.',
        isReplay: false,
      };
    });
  }

  /**
   * 4. HELD SALES MANAGEMENT
   */
  public static async getHeldSales(userContext: UserContext) {
    const filter: Record<string, unknown> = {};
    if (userContext.role !== 'SUPER_ADMIN') {
      filter.branchId = new mongoose.Types.ObjectId(userContext.branchId);
    }
    return await HeldSale.find(filter).sort({ createdAt: -1 }).lean();
  }

  public static async createHeldSale(input: HeldSaleInput, userContext: UserContext) {
    if (!userContext.branchId && userContext.role !== 'SUPER_ADMIN') {
      throw new AppError('Branch assignment required to hold sales.', 403, 'NO_BRANCH_ASSIGNED');
    }

    const branchId = userContext.branchId || (await mongoose.model('Branch').findOne().select('_id'))?._id;
    const heldNumber = await generateDailySequence('HOLD');

    const heldSale = await HeldSale.create({
      heldNumber,
      branchId: new mongoose.Types.ObjectId(branchId),
      cashierId: userContext.accountId,
      cashierName: userContext.loginId,
      customerId: input.customerId ? new mongoose.Types.ObjectId(input.customerId) : undefined,
      customerName: input.customerName || 'Walk-in Customer',
      customerPhone: input.customerPhone,
      saleType: input.saleType,
      paymentArrangement: input.paymentArrangement,
      items: input.items,
      subtotal: input.subtotal,
      discountAmount: input.discountAmount || 0,
      taxAmount: input.taxAmount || 0,
      grandTotal: input.grandTotal,
      notes: input.notes,
    });

    return heldSale;
  }

  public static async deleteHeldSale(id: string, userContext: UserContext) {
    const heldSale = await HeldSale.findById(id);
    if (!heldSale) throw new AppError('Held sale not found.', 404, 'HELD_SALE_NOT_FOUND');

    if (userContext.role !== 'SUPER_ADMIN' && heldSale.branchId.toString() !== userContext.branchId) {
      throw new AppError('Unauthorized access to held sale of another branch.', 403, 'FORBIDDEN_BRANCH');
    }

    await HeldSale.findByIdAndDelete(id);
    return { success: true, message: 'Held sale removed successfully.' };
  }

  public static async resumeHeldSale(id: string, userContext: UserContext) {
    const heldSale = await HeldSale.findById(id);
    if (!heldSale) throw new AppError('Held sale not found.', 404, 'HELD_SALE_NOT_FOUND');

    if (userContext.role !== 'SUPER_ADMIN' && heldSale.branchId.toString() !== userContext.branchId) {
      throw new AppError('Unauthorized access to held sale of another branch.', 403, 'FORBIDDEN_BRANCH');
    }

    // Delete from held storage upon resumption
    await HeldSale.findByIdAndDelete(id);
    return heldSale;
  }
}
