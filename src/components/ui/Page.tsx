import React from 'react';
import { AlertCircle, CheckCircle2, Info, Loader2 } from 'lucide-react';

/**
 * Ortak sayfa kabuğu: tüm ekranlarda aynı genişlik, yan boşluk ve
 * alt gezinme çubuğu için güvenli alt boşluk kullanılır.
 */
export const PageContainer: React.FC<{
  children: React.ReactNode;
  width?: 'md' | 'lg' | 'xl';
  className?: string;
}> = ({ children, width = 'lg', className = '' }) => {
  const max = width === 'md' ? 'max-w-4xl' : width === 'xl' ? 'max-w-7xl' : 'max-w-5xl';
  return (
    <div className={`page-shell ${max} mx-auto w-full px-4 pt-4 space-y-5 ${className}`}>
      {children}
    </div>
  );
};

export const PageHeader: React.FC<{
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, description, icon, actions }) => (
  <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
    <div className="min-w-0">
      <h1 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
        {icon}
        <span className="break-words">{title}</span>
      </h1>
      {description && <p className="text-xs text-slate-400 mt-1 leading-relaxed">{description}</p>}
    </div>
    {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
  </div>
);

type NoticeKind = 'success' | 'error' | 'info' | 'warning';

const noticeStyles: Record<NoticeKind, { box: string; icon: React.ReactNode }> = {
  success: { box: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200', icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> },
  error: { box: 'border-rose-500/30 bg-rose-500/10 text-rose-200', icon: <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" /> },
  warning: { box: 'border-amber-500/30 bg-amber-500/10 text-amber-200', icon: <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" /> },
  info: { box: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200', icon: <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" /> }
};

/** Başarı / hata / uyarı / bilgi bildirimi için tek tasarım. */
export const Notice: React.FC<{ kind?: NoticeKind; children: React.ReactNode }> = ({ kind = 'info', children }) => {
  const style = noticeStyles[kind as NoticeKind];
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`rounded-xl border p-3 flex items-start gap-2 text-xs leading-relaxed ${style.box}`}>
      {style.icon}
      <div className="min-w-0 flex-1 break-words">{children}</div>
    </div>
  );
};

/** Yükleniyor durumu. */
export const LoadingState: React.FC<{ label?: string }> = ({ label = 'Yükleniyor…' }) => (
  <div role="status" className="glass-panel rounded-2xl p-6 flex items-center justify-center gap-3 text-sm text-slate-300">
    <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
    <span>{label}</span>
  </div>
);

/** Boş durum. */
export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ icon, title, description, action }) => (
  <div className="glass-panel rounded-2xl px-4 py-12 text-center text-slate-400">
    {icon && <div className="flex justify-center mb-3 text-slate-600">{icon}</div>}
    <h3 className="text-base font-bold text-white">{title}</h3>
    {description && <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">{description}</p>}
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </div>
);
