import { forwardRef } from 'react';

const Input = forwardRef(function Input({ className = '', ...props }, ref) {
  return (
    <input
      ref={ref}
      className={`w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 transition-colors duration-150 focus:border-plum-400 focus:outline-none focus:ring-2 focus:ring-plum-100 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400 ${className}`}
      {...props}
    />
  );
});

export default Input;
