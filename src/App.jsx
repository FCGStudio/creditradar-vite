import React from "react";
import { Analytics } from '@vercel/analytics/react';

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Your existing app layout and components */}
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight">CreditRadar</h1>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* Your app content */}
      </main>

      {/* Add Analytics at the bottom so it runs globally */}
      <Analytics />
    </div>
  );
}
