import Image from 'next/image';

// Keep the supplied artwork's proportions. The surrounding label or control's
// aria-label supplies the accessible name, so the image itself is decorative.
export default function BrandIcon({ name, className = '', agent = false }) {
  return <Image src={`/brands/${agent ? 'agents/' : ''}${name}.svg`} width={28} height={28} alt="" aria-hidden="true" unoptimized className={`brand-icon ${className}`} />;
}
