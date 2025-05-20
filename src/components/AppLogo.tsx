import Image from 'next/image';
import Link from 'next/link';

export function AppLogo() {
  return (
    <Link href="/" className="flex items-center text-lg font-semibold text-primary">
      <Image
        src="/logo.png"
        alt="傲慢与偏见咖啡庄园 Logo"
        width={150} // 您可以根据您Logo的实际宽高比调整这里的宽度
        height={35} // 这个高度大致与原先的文本Logo高度接近
        priority // Preload the logo image as it's likely important
        className="object-contain" // Ensures the image scales nicely within the dimensions
        data-ai-hint="app logo"
      />
      {/* The text part of the logo is removed as per the request to replace the title with the image logo */}
    </Link>
  );
}
