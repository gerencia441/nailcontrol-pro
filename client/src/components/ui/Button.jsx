const variants = {
  primary: 'bg-pink-500 hover:bg-pink-600 text-white shadow-sm',
  secondary: 'bg-pink-100 hover:bg-pink-200 text-pink-700',
  danger: 'bg-red-100 hover:bg-red-200 text-red-600',
  ghost: 'hover:bg-pink-50 text-gray-500 hover:text-pink-600',
  outline: 'border border-pink-300 hover:bg-pink-50 text-pink-600',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
