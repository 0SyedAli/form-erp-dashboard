'use client';

import dynamic from 'next/dynamic';

const NewProductClient = dynamic(() => import('./NewProductClient'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
      <div className="text-center p-8">
        <div className="inline-block animate-spin w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full mb-3" />
        <p className="text-slate-600 text-sm font-medium">Loading Product Form...</p>
      </div>
    </div>
  ),
});

export default function NewProductPage() {
  return <NewProductClient />;
}
