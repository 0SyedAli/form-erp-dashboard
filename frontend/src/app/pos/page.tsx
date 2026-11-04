'use client';

import dynamic from 'next/dynamic';

const POSClient = dynamic(() => import('./POSClient'), {
  ssr: false,
  loading: () => (
    <div className="h-screen w-screen bg-slate-900 flex items-center justify-center font-sans text-white text-sm">
      Loading Unified POS...
    </div>
  ),
});

export default function POSPage() {
  return <POSClient />;
}
