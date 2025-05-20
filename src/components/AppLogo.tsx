import { Coffee } from 'lucide-react';
import Link from 'next/link';

export function AppLogo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-primary">
      <Coffee className="h-7 w-7 text-primary" />
      <span className="hidden md:inline">豆豆账本</span>
    </Link>
  );
}
