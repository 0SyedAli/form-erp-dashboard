'use client';

import React, { useState, useMemo } from 'react';
import { CatalogueProduct } from '@/types';
import {
  useGetProductsQuery,
  useGetSizesQuery,
  useGetThicknessQuery,
  useGetVariantsQuery,
  useGetBrandsQuery,
  useGenerateVariantsMutation,
} from '@/store/services/apiSlice';
import {
  X,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Trash2,
  AlertTriangle,
  Check,
  CheckCircle2,
} from 'lucide-react';

interface VariantGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedProduct?: CatalogueProduct | null;
  onSuccess: (count: number) => void;
}

interface CombinationItem {
  id: string; // temp id
  sizeId: string;
  sizeLabel: string;
  length: number;
  width: number;
  thicknessId: string;
  thicknessLabel: string;
  thicknessValue: number;
  sku: string;
  retailPrice: number;
  wholesalePrice: number;
  isExisting: boolean;
}

export default function VariantGeneratorModal(props: VariantGeneratorModalProps) {
  if (!props.isOpen) return null;
  return (
    <VariantGeneratorInnerModal
      key={`${props.isOpen}-${props.preselectedProduct?.id || 'default'}`}
      {...props}
    />
  );
}

function VariantGeneratorInnerModal({
  onClose,
  preselectedProduct,
  onSuccess,
}: VariantGeneratorModalProps) {
  const { data: products = [] } = useGetProductsQuery();
  const { data: brands = [] } = useGetBrandsQuery();
  const { data: sizes = [] } = useGetSizesQuery();
  const { data: thicknessList = [] } = useGetThicknessQuery();
  const { data: existingVariants = [] } = useGetVariantsQuery();

  const [generateVariants, { isLoading }] = useGenerateVariantsMutation();

  const brandMap = useMemo(() => new Map(brands.map((b) => [b.id, b])), [brands]);
  const activeSizes = useMemo(
    () => sizes.filter((s) => s.status === 'active' || s.status === 'ACTIVE'),
    [sizes]
  );
  const activeThickness = useMemo(
    () => thicknessList.filter((t) => t.status === 'active' || t.status === 'ACTIVE'),
    [thicknessList]
  );

  // Wizard state initialized on mount
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedProductId, setSelectedProductId] = useState<string>(
    () => preselectedProduct?.id || products[0]?.id || ''
  );
  const [selectedSizeIds, setSelectedSizeIds] = useState<string[]>(() =>
    activeSizes.slice(0, 3).map((s) => s.id)
  );
  const [selectedThicknessIds, setSelectedThicknessIds] = useState<string[]>(() =>
    activeThickness.slice(0, 3).map((t) => t.id)
  );
  const [defaultRetail, setDefaultRetail] = useState<number>(35000);
  const [defaultWholesale, setDefaultWholesale] = useState<number>(30000);

  // Matrix items
  const [combinations, setCombinations] = useState<CombinationItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const selectedProductBrand = selectedProduct ? brandMap.get(selectedProduct.brandId) : null;

  // Toggle size selection
  const toggleSize = (id: string) => {
    setSelectedSizeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Toggle thickness selection
  const toggleThickness = (id: string) => {
    setSelectedThicknessIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Generate Matrix
  const handleProceedToMatrix = () => {
    setErrorMsg(null);

    if (!selectedProductId) {
      setErrorMsg('Please select a product.');
      return;
    }
    if (selectedSizeIds.length === 0) {
      setErrorMsg('Please select at least one mattress size dimension.');
      return;
    }
    if (selectedThicknessIds.length === 0) {
      setErrorMsg('Please select at least one thickness level.');
      return;
    }

    const prod = selectedProduct;
    if (!prod) return;

    // Check existing variants for this product
    const prodExistingVariants = existingVariants.filter((v) => v.productId === prod.id);

    const generated: CombinationItem[] = [];

    selectedSizeIds.forEach((sId) => {
      const sz = sizes.find((s) => s.id === sId);
      if (!sz) return;

      selectedThicknessIds.forEach((tId) => {
        const th = thicknessList.find((t) => t.id === tId);
        if (!th) return;

        // Check if combination already exists
        const exists = prodExistingVariants.some(
          (v) => v.sizeId === sz.id && v.thicknessId === th.id
        );

        // Standard deterministic SKU formula: PRODCODE-LENGTHWIDTH-TTHICKNESS
        const dimStr = `${sz.length}${sz.width}`.replace(/[^0-9]/g, '');
        const thickStr = `T${th.value}`.replace(/[^0-9A-Z]/gi, '');
        const suggestedSku = `${prod.code}-${dimStr}-${thickStr}`.toUpperCase();

        generated.push({
          id: `${sz.id}_${th.id}`,
          sizeId: sz.id,
          sizeLabel: sz.displayLabel,
          length: sz.length,
          width: sz.width,
          thicknessId: th.id,
          thicknessLabel: th.displayLabel,
          thicknessValue: th.value,
          sku: suggestedSku,
          retailPrice: defaultRetail > 0 ? defaultRetail : 30000,
          wholesalePrice: defaultWholesale > 0 ? defaultWholesale : 25000,
          isExisting: exists,
        });
      });
    });

    setCombinations(generated);
    setStep(2);
  };

  // Remove individual combination before saving
  const handleRemoveCombination = (id: string) => {
    setCombinations((prev) => prev.filter((c) => c.id !== id));
  };

  // Update item field in matrix
  const handleUpdateCombination = (
    id: string,
    field: 'sku' | 'retailPrice' | 'wholesalePrice',
    val: string | number
  ) => {
    setCombinations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: val } : c))
    );
  };

  // Final Save
  const handleSave = async () => {
    setErrorMsg(null);

    if (combinations.length === 0) {
      setErrorMsg('No variant combinations in the matrix to generate.');
      return;
    }

    // Validate unique SKUs within matrix
    const skus = combinations.map((c) => c.sku.trim().toUpperCase());
    const duplicatesInMatrix = skus.filter((sku, i) => skus.indexOf(sku) !== i);
    if (duplicatesInMatrix.length > 0) {
      setErrorMsg(`Duplicate SKU in combinations table: ${duplicatesInMatrix[0]}`);
      return;
    }

    // Validate collision against other existing variants in the database
    const collisions = combinations.filter((c) =>
      existingVariants.some((ev) => ev.sku.toUpperCase() === c.sku.trim().toUpperCase())
    );
    if (collisions.length > 0) {
      setErrorMsg(`SKU "${collisions[0].sku}" already exists in the system catalogue.`);
      return;
    }

    try {
      const combinationsPayload = combinations.map((c) => ({
        sizeId: c.sizeId,
        thicknessId: c.thicknessId,
        sku: c.sku.trim().toUpperCase(),
        retailPrice: Number(c.retailPrice) || 0,
        wholesalePrice: Number(c.wholesalePrice) || 0,
      }));

      const res = await generateVariants({
        productId: selectedProductId,
        sizeIds: selectedSizeIds,
        thicknessIds: selectedThicknessIds,
        combinations: combinationsPayload,
      }).unwrap();

      onSuccess(res.length);
      onClose();
    } catch (err: unknown) {
      const e = err as { data?: { message?: string } | string; message?: string };
      const msg = typeof e?.data === 'string' ? e.data : e?.data?.message || e?.message || 'Failed to generate variants';
      setErrorMsg(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[92vh]"
        role="dialog"
        aria-labelledby="variant-generator-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-brand-blue font-semibold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 id="variant-generator-modal-title" className="text-lg font-semibold text-gray-900 tracking-tight">
                Product Variant Generator
              </h2>
              <p className="text-xs text-gray-500">
                {step === 1
                  ? 'Step 1 of 2: Select mattress dimensions and thickness levels'
                  : 'Step 2 of 2: Preview generated SKUs, calibrate pricing and save'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMsg && (
            <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {step === 1 ? (
            <div className="space-y-6">
              {/* Product Selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  1. Target Product *
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-900 focus:outline-hidden focus:border-brand-blue focus:bg-white"
                >
                  {products.map((p) => {
                    const b = brandMap.get(p.brandId);
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code}) — Brand: {b?.name || 'Molty'}
                      </option>
                    );
                  })}
                </select>
                {selectedProduct && (
                  <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
                    <span className="font-semibold text-gray-700">Code:</span> {selectedProduct.code}
                    <span>•</span>
                    <span className="font-semibold text-gray-700">Brand:</span>{' '}
                    {selectedProductBrand?.name}
                  </div>
                )}
              </div>

              {/* Sizes Multi-Select */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    2. Available Mattress Sizes ({selectedSizeIds.length} selected)
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedSizeIds(activeSizes.map((s) => s.id))}
                      className="text-brand-blue hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedSizeIds([])}
                      className="text-gray-500 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {activeSizes.map((size) => {
                    const isSelected = selectedSizeIds.includes(size.id);
                    return (
                      <button
                        key={size.id}
                        type="button"
                        onClick={() => toggleSize(size.id)}
                        className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/80 border-brand-blue text-brand-blue shadow-2xs'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-sm">{size.displayLabel}</div>
                          <div className="text-xs text-gray-500">
                            {size.length} &times; {size.width} {size.unit}
                          </div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center ${
                            isSelected ? 'bg-brand-blue text-white' : 'border border-gray-300'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Thickness Multi-Select */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    3. Thickness Levels ({selectedThicknessIds.length} selected)
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedThicknessIds(activeThickness.map((t) => t.id))}
                      className="text-brand-blue hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedThicknessIds([])}
                      className="text-gray-500 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {activeThickness.map((t) => {
                    const isSelected = selectedThicknessIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleThickness(t.id)}
                        className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50/80 border-indigo-600 text-indigo-700 shadow-2xs'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-sm">{t.displayLabel}</div>
                          <div className="text-xs text-gray-500">
                            {t.value} {t.unit}
                          </div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center ${
                            isSelected ? 'bg-indigo-600 text-white' : 'border border-gray-300'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Default Prices */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                <span className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  4. Base Price Templates (Auto-fill Matrix)
                </span>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Default Retail Price (PKR)
                    </label>
                    <input
                      type="number"
                      step="500"
                      value={defaultRetail}
                      onChange={(e) => setDefaultRetail(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-900 focus:outline-hidden focus:border-brand-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Default Wholesale Price (PKR)
                    </label>
                    <input
                      type="number"
                      step="500"
                      value={defaultWholesale}
                      onChange={(e) => setDefaultWholesale(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-900 focus:outline-hidden focus:border-brand-blue"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mt-2">
                  Estimated matrix yield: {selectedSizeIds.length} sizes &times;{' '}
                  {selectedThicknessIds.length} thicknesses ={' '}
                  <strong>{selectedSizeIds.length * selectedThicknessIds.length} variants</strong>
                </p>
              </div>
            </div>
          ) : (
            /* STEP 2: Matrix Review */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Matrix Combinations Preview ({combinations.length} SKUs)
                  </h3>
                  <p className="text-xs text-gray-500">
                    Review generated SKUs, adjust individual prices or remove unwanted options before
                    saving.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1 text-xs text-brand-blue hover:underline cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Modify Selection</span>
                </button>
              </div>

              <div className="border border-gray-200/80 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-semibold text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Size</th>
                      <th className="py-2.5 px-3">Thickness</th>
                      <th className="py-2.5 px-3">Generated SKU *</th>
                      <th className="py-2.5 px-3">Retail (PKR)</th>
                      <th className="py-2.5 px-3">Wholesale (PKR)</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {combinations.map((comb) => (
                      <tr key={comb.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-2 px-3 font-semibold text-gray-900">{comb.sizeLabel}</td>
                        <td className="py-2 px-3 text-gray-700">{comb.thicknessLabel}</td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={comb.sku}
                            onChange={(e) =>
                              handleUpdateCombination(comb.id, 'sku', e.target.value.toUpperCase())
                            }
                            className="w-full font-mono font-semibold px-2 py-1 bg-white border border-gray-200 rounded text-xs text-brand-blue uppercase focus:outline-hidden focus:border-brand-blue"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="500"
                            value={comb.retailPrice}
                            onChange={(e) =>
                              handleUpdateCombination(
                                comb.id,
                                'retailPrice',
                                Number(e.target.value)
                              )
                            }
                            className="w-24 px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-900 font-medium focus:outline-hidden focus:border-brand-blue"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="500"
                            value={comb.wholesalePrice}
                            onChange={(e) =>
                              handleUpdateCombination(
                                comb.id,
                                'wholesalePrice',
                                Number(e.target.value)
                              )
                            }
                            className="w-24 px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-900 font-medium focus:outline-hidden focus:border-brand-blue"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          {comb.isExisting ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              Already Exists
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                              New
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveCombination(comb.id)}
                            className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                            title="Remove combination"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>

          {step === 1 ? (
            <button
              type="button"
              onClick={handleProceedToMatrix}
              className="flex items-center gap-2 px-5 py-2 bg-brand-blue hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer shadow-xs"
            >
              <span>Generate Combinations Matrix</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isLoading || combinations.length === 0}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isLoading ? 'Creating Variants...' : `Confirm & Save ${combinations.length} SKUs`}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
