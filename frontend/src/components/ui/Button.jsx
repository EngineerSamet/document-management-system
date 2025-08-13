import React from 'react';

const variants = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
  secondary: 'bg-secondary-200 text-secondary-800 hover:bg-secondary-300 focus:ring-secondary-500',
  danger: 'bg-danger-500 text-white hover:bg-danger-700 focus:ring-danger-500',
  success: 'bg-success-500 text-white hover:bg-success-700 focus:ring-success-500',
  warning: 'bg-warning-500 text-white hover:bg-warning-700 focus:ring-warning-500',
  outline: 'border border-secondary-300 bg-white text-secondary-700 hover:bg-secondary-50 focus:ring-primary-500',
  ghost: 'bg-transparent text-secondary-700 hover:bg-secondary-100 focus:ring-secondary-500',
};

const sizes = {
  xs: 'px-2 py-1 text-xs',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
  xl: 'px-6 py-3 text-lg',
};

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  type = 'button',
  fullWidth = false,
  className = '',
  icon = null,
  iconPosition = 'left',
  loading = false,
  onClick,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  const variantClasses = variants[variant] || variants.primary;
  const sizeClasses = sizes[size] || sizes.md;
  const widthClass = fullWidth ? 'w-full' : '';
  const disabledClasses = disabled || loading ? 'opacity-60 cursor-not-allowed' : '';
  
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses} ${sizeClasses} ${widthClass} ${disabledClasses} ${className}`}
      onClick={!disabled && !loading ? onClick : undefined}
      {...props}
    >
      {loading && (
        <svg className={`animate-spin -ml-1 h-4 w-4 ${iconPosition === 'left' ? 'mr-2' : 'ml-2 order-2'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      
      {!loading && icon && iconPosition === 'left' && (
        <span className="mr-2">{icon}</span>
      )}
      
      <span>{children}</span>
      
      {!loading && icon && iconPosition === 'right' && (
        <span className="ml-2">{icon}</span>
      )}
    </button>
  );
};

export default Button; 