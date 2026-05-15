export default function Select({ label, id, children, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-gray-600">
          {label}
        </label>
      )}
      <select
        id={id}
        className={`w-full px-3 py-2 rounded-xl border border-pink-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent transition appearance-none cursor-pointer ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
