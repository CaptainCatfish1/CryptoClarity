import { Shield, Eye } from "lucide-react";

export default function Logo({ size = 'default' }: { size?: 'small' | 'default' | 'large' }) {
  const sizes = {
    small: { icon: 16, text: 'text-lg' },
    default: { icon: 24, text: 'text-xl' },
    large: { icon: 32, text: 'text-2xl' },
  };

  const selectedSize = sizes[size];

  return (
    <div className="flex items-center">
      <div className="relative">
        <Shield className={`h-${selectedSize.icon} w-${selectedSize.icon} text-purple-600`} />
        <Eye className={`h-${selectedSize.icon/2} w-${selectedSize.icon/2} text-blue-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2`} />
      </div>
      <span className={`ml-2 font-bold ${selectedSize.text} bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent font-orbitron`}>
        My Crypto Clarity
      </span>
    </div>
  );
}