const variants = {
  primary:   'bg-brand-gradient text-white shadow-soft hover:opacity-90',
  secondary: 'bg-blush-50 hover:bg-blush-100 text-blush-700',
  danger:    'bg-red-50 hover:bg-red-100 text-red-600',
  ghost:     'hover:bg-gray-100 text-gray-500 hover:text-gray-700',
  outline:   'border border-blush-300 hover:bg-blush-50 text-blush-600',
};

const sizes = {
  xs: 'px-2.5 py-1 text-xs',
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
      className={`inline-flex items-center gap-2 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
