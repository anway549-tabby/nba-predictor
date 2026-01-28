'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname?.startsWith(path);
  };

  return (
    <nav className="sticky top-0 z-50 glass border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-glow-accent">
              <span className="text-white font-bold text-xl">🏀</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gradient">
                NBA Props
              </h1>
              <p className="text-xs text-gray-400">Predictor</p>
            </div>
          </Link>

          {/* Navigation Tabs */}
          <div className="flex space-x-1 bg-surface/50 rounded-lg p-1">
            <Link
              href="/"
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                isActive('/') && !pathname?.includes('/players')
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-surface'
              }`}
            >
              Predictions
            </Link>
            <Link
              href="/players"
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                isActive('/players')
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-surface'
              }`}
            >
              Player Research
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
