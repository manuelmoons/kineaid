import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth';
import { isSupabaseConfigured } from '../lib/supabase';
import LanguageSwitcher from './LanguageSwitcher';

export default function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { session, signOut } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-bold text-brand-800">
            <img src="/icon.svg" alt="" className="h-8 w-8" />
            KineAid
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            {isSupabaseConfigured && session && (
              <button onClick={signOut} className="text-sm text-slate-600 hover:text-slate-900">
                {t('app.signOut')}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>

      <footer className="border-t border-slate-200 py-4 text-center text-sm text-slate-500">
        <Link to="/credits" className="hover:text-slate-800 hover:underline">
          {t('app.credits')}
        </Link>
      </footer>
    </div>
  );
}
