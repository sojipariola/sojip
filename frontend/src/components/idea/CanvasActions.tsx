"use client";

import { useState } from "react";
import { Lock, Loader2, Printer, Unlock } from "lucide-react";

interface Props {
  locked: boolean;
  canLock: boolean;
  canUnlock: boolean;
  onLock: () => Promise<void>;
  onUnlock: () => Promise<void>;
}

export function CanvasActions({
  locked,
  canLock,
  canUnlock,
  onLock,
  onUnlock,
}: Props) {
  const [working, setWorking] = useState(false);

  async function handleLock() {
    setWorking(true);
    try {
      await onLock();
    } finally {
      setWorking(false);
    }
  }

  async function handleUnlock() {
    setWorking(true);
    try {
      await onUnlock();
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {locked ? (
        <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <Lock className="w-4 h-4" />
          Locked for review
          {canUnlock && (
            <button
              onClick={handleUnlock}
              disabled={working}
              className="ml-2 text-xs underline hover:no-underline disabled:opacity-50"
            >
              Unlock
            </button>
          )}
        </div>
      ) : (
        canLock && (
          <button
            onClick={handleLock}
            disabled={working}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition disabled:opacity-50"
          >
            {working ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            Lock for review
          </button>
        )
      )}

      <button
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
      >
        <Printer className="w-4 h-4" />
        Print / Export
      </button>
    </div>
  );
}
