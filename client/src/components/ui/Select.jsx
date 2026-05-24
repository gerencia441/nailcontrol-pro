export default function Select({ label, id, children, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {label}
        </label>
      )}
      <select
        id={id}
        className={`w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blush-300 focus:border-blush-300 transition appearance-none cursor-pointer ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
