import React from 'react';

// Header alt bileşeni
const Header = ({ children, className = '', ...props }) => {
  return (
    <div className={`border-b border-secondary-200 p-4 sm:p-6 ${className}`} {...props}>
      {children}
    </div>
  );
};

// Body alt bileşeni
const Body = ({ children, className = '', ...props }) => {
  return (
    <div className={`p-4 sm:p-6 ${className}`} {...props}>
      {children}
    </div>
  );
};

// Footer alt bileşeni
const Footer = ({ children, className = '', ...props }) => {
  return (
    <div className={`border-t border-secondary-200 p-4 sm:p-6 ${className}`} {...props}>
      {children}
    </div>
  );
};

const Card = ({
  children,
  title,
  subtitle,
  icon,
  actions,
  className = '',
  bodyClassName = '',
  padding = 'default', // 'default', 'small', 'large', 'none'
  variant = 'default', // 'default', 'bordered', 'flat'
  shadow = true,
  hover = false,
  ...props
}) => {
  // Padding sınıfları
  const paddingClasses = {
    default: 'p-4 sm:p-6',
    small: 'p-3',
    large: 'p-5 sm:p-8',
    none: 'p-0'
  };
  
  // Varyant sınıfları
  const variantClasses = {
    default: 'bg-white',
    bordered: 'bg-white border border-secondary-200',
    flat: 'bg-secondary-50'
  };
  
  // Gölge sınıfları
  const shadowClass = shadow ? 'shadow-card' : '';
  
  // Hover efekti
  const hoverClass = hover ? 'transition-shadow hover:shadow-card-hover' : '';
  
  return (
    <div 
      className={`rounded-lg ${variantClasses[variant] || variantClasses.default} ${shadowClass} ${hoverClass} ${className}`}
      {...props}
    >
      {/* Kart başlığı */}
      {(title || subtitle || icon || actions) && (
        <div className={`flex justify-between items-center border-b border-secondary-200 ${paddingClasses[padding]}`}>
          <div className="flex items-center space-x-3">
            {icon && (
              <div className="text-primary-600">
                {icon}
              </div>
            )}
            <div>
              {title && <h3 className="font-medium text-secondary-900">{title}</h3>}
              {subtitle && <p className="text-sm text-secondary-500">{subtitle}</p>}
            </div>
          </div>
          
          {actions && (
            <div className="flex items-center space-x-2">
              {actions}
            </div>
          )}
        </div>
      )}
      
      {/* Kart içeriği */}
      <div className={`${!title && !subtitle && !icon ? paddingClasses[padding] : ''} ${bodyClassName}`}>
        {children}
      </div>
    </div>
  );
};

// Alt bileşenleri karta ekle
Card.Header = Header;
Card.Body = Body;
Card.Footer = Footer;

export default Card; 