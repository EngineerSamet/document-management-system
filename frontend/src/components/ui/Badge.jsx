import React from 'react';

const Badge = ({ 
  children, 
  color = 'primary', 
  size = 'default',
  className = '',
  ...props 
}) => {
  // Renk varyantları
  const colorClasses = {
    primary: 'bg-primary-100 text-primary-800',
    secondary: 'bg-secondary-100 text-secondary-800',
    success: 'bg-success-100 text-success-800',
    danger: 'bg-danger-100 text-danger-800',
    warning: 'bg-warning-100 text-warning-800',
    info: 'bg-info-100 text-info-800',
    gray: 'bg-gray-100 text-gray-800',
    light: 'bg-gray-50 text-gray-600 border border-gray-200',
    dark: 'bg-gray-800 text-gray-100',
  };

  // Boyut varyantları
  const sizeClasses = {
    small: 'text-xs px-1.5 py-0.5',
    default: 'text-xs px-2.5 py-0.5',
    large: 'text-sm px-3 py-1',
  };

  return (
    <span 
      className={`
        inline-flex items-center font-medium rounded-full
        ${colorClasses[color]} 
        ${sizeClasses[size]}
        ${className}
      `}
      {...props}
    >
      {children}
    </span>
  );
};

export default Badge; 