import React from 'react';
import { AlertTriangle, CheckCircle, Info, ShieldAlert, X } from 'lucide-react';
import { useGuardian } from '../../context/GuardianContext';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useGuardian();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 space-y-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => {
        const isDanger = t.type === 'danger';
        const isWarning = t.type === 'warning';
        const isSuccess = t.type === 'success';

        return (
          <div
            key={t.id}
            className={`pointer-events-auto p-3.5 rounded-xl border shadow-xl flex items-start justify-between space-x-3 transition-all ${
              isDanger
                ? 'bg-rose-950/95 border-rose-600 text-rose-100'
                : isWarning
                ? 'bg-amber-950/95 border-amber-600 text-amber-100'
                : isSuccess
                ? 'bg-emerald-950/95 border-emerald-600 text-emerald-100'
                : 'bg-slate-900/95 border-slate-700 text-slate-100'
            }`}
          >
            <div className="flex items-start space-x-2.5">
              {isDanger ? (
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              ) : isWarning ? (
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              ) : isSuccess ? (
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
              )}
              <div className="text-xs font-medium leading-relaxed">{t.message}</div>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-slate-400 hover:text-white shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
