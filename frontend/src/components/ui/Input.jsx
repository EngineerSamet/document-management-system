import React, { forwardRef } from 'react';

const Input = forwardRef(({
  type = 'text',
  label,
  id,
  name,
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  helperText,
  disabled = false,
  readOnly = false,
  required = false,
  className = '',
  leftIcon = null,
  rightIcon = null,
  as,
  children,
  ...props
}, ref) => {
  const inputId = id || name;
  
  const baseClasses = `block w-full rounded-md shadow-sm sm:text-sm
    ${leftIcon ? 'pl-10' : ''}
    ${rightIcon ? 'pr-10' : ''}
    ${error
      ? 'border-danger-500 pr-10 focus:border-danger-500 focus:ring-danger-500'
      : 'border-secondary-300 focus:border-primary-500 focus:ring-primary-500'
    }
    ${disabled ? 'bg-secondary-100 text-secondary-500 cursor-not-allowed' : ''}
    ${readOnly ? 'bg-secondary-50' : ''}
  `;
  
  return (
    <div className={className}>
      {label && (
        <label 
          htmlFor={inputId} 
          className="mb-1 block text-sm font-medium text-secondary-700"
        >
          {label}
          {required && <span className="text-danger-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            {leftIcon}
          </div>
        )}
        
        {as === 'select' ? (
          <select
            ref={ref}
            id={inputId}
            name={name}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            disabled={disabled}
            required={required}
            className={baseClasses}
            {...props}
          >
            {children}
          </select>
        ) : as === 'textarea' ? (
          <textarea
            ref={ref}
            id={inputId}
            name={name}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            className={baseClasses}
            {...props}
          />
        ) : (
          <input
            ref={ref}
            type={type}
            id={inputId}
            name={name}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            className={baseClasses}
            {...props}
          />
        )}
        
        {rightIcon && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            {rightIcon}
          </div>
        )}
        
        {error && !rightIcon && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg className="h-5 w-5 text-danger-500" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
      </div>
      
      {(error || helperText) && (
        <p className={`mt-1 text-sm ${error ? 'text-danger-500' : 'text-secondary-500'}`}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input; 