import { forwardRef } from 'react';

const Select = forwardRef(function Select({ className = '', children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={`w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 transition-colors duration-150 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
});

export default Select;
