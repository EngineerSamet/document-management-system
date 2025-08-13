# Document Management System - Comprehensive Frontend Documentation

## 1. System Architecture Overview

The Document Management System frontend is a sophisticated React-based application designed to provide an intuitive user interface for document workflow management, approvals, and organizational document handling. The application follows a well-structured modular architecture with clear separation of concerns.

### 1.1 Technology Stack

- **Framework**: React.js
- **Routing**: React Router v6
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios
- **State Management**: React Context API
- **UI Components**: Custom components with Tailwind
- **Notifications**: React-Toastify
- **JWT Handling**: jwt-decode

### 1.2 Architectural Pattern

The frontend follows a layered architecture with clear separation of concerns:

1. **Routing Layer**: Manages navigation and route protection with React Router
2. **Layout Layer**: Provides consistent page structure and responsive design
3. **Component Layer**: Reusable UI components organized by functionality
4. **Context Layer**: Global state management with React Context API
5. **Hook Layer**: Custom hooks for business logic and API interaction
6. **API Layer**: Axios-based API clients with error handling and retry logic
7. **Utility Layer**: Helper functions and shared utilities

## 2. Application Structure

### 2.1 Directory Structure

```
frontend/
├── public/              # Static assets
├── src/
│   ├── api/             # API client modules
│   ├── components/      # Reusable UI components
│   │   ├── admin/       # Admin-specific components
│   │   ├── approval/    # Approval workflow components
│   │   ├── dashboard/   # Dashboard components
│   │   ├── layout/      # Layout components
│   │   └── ui/          # Base UI components
│   ├── context/         # React Context providers
│   ├── hooks/           # Custom React hooks
│   ├── layouts/         # Page layout templates
│   ├── models/          # Data models and types
│   ├── pages/           # Page components
│   │   ├── admin/       # Admin pages
│   │   ├── auth/        # Authentication pages
│   │   └── documents/   # Document management pages
│   ├── styles/          # Global styles
│   ├── utils/           # Utility functions
│   ├── App.js           # Main application component
│   ├── index.js         # Application entry point
│   └── routes.js        # Route definitions
└── tailwind.config.js   # Tailwind CSS configuration
```

### 2.2 Key Application Files

- **App.js**: Main application component with authentication state management and user session refresh logic
- **routes.js**: Route definitions with protected routes and layout assignments
- **index.js**: Application entry point with provider wrapping

## 3. Authentication System

### 3.1 Authentication Context

The `AuthContext.js` provides a comprehensive authentication system with the following features:

- JWT token management with automatic refresh
- User session persistence with localStorage
- Token expiration handling
- User profile management
- Secure logout process
- Session recovery after network issues

```javascript
// Key methods provided by AuthContext
login(email, password)       // User login with credentials
logout()                     // Secure logout with token invalidation
register(userData)           // New user registration
updateProfile(userData)      // User profile updates
checkAuth()                  // Verify authentication status
refreshUserInfo()            // Refresh user data from API
```

### 3.2 Authentication Flow

1. **Initial Load**: Check localStorage for existing token
2. **Token Validation**: Decode and verify token expiration
3. **Session Recovery**: Load user data from localStorage or API
4. **Automatic Refresh**: Schedule token refresh before expiration
5. **Background Updates**: Periodically refresh user data
6. **Visibility Handling**: Refresh data when tab becomes visible

### 3.3 Protected Routes

Routes are protected using the `MainLayout` component which checks authentication status:

```javascript
// Route protection logic in MainLayout.jsx
if (!loading && !isAuthenticated) {
  return <Navigate to="/giris" replace state={{ from: location }} />;
}
```

## 4. API Client Architecture

### 4.1 API Client Structure

Each domain area has a dedicated API client module with consistent error handling and retry logic:

- **auth.js**: Authentication operations
- **documents.js**: Document management
- **admin.js**: Administrative functions
- **users.js**: User management
- **logs.js**: System logs
- **activities.js**: User activity tracking

### 4.2 API Client Features

- **Request Interceptors**: Automatically attach authentication tokens
- **Response Interceptors**: Handle common error scenarios (401, 403, 429)
- **Retry Logic**: Exponential backoff for failed requests
- **Error Enhancement**: Detailed error information with type classification
- **Cooldown Mechanism**: Prevent API flooding during outages
- **Timeout Handling**: Abort long-running requests
- **Network Error Recovery**: Graceful handling of network issues

### 4.3 Example API Client (documents.js)

The document API client demonstrates sophisticated error handling and retry logic:

```javascript
// Retry mechanism with exponential backoff
const withRetry = async (apiCall, maxRetries = 2, initialDelay = 2000) => {
  let retryCount = 0;
  let delayTime = initialDelay;
  
  // Check cooldown period from previous failures
  const lastFailedApiCall = localStorage.getItem('lastFailedDocumentsApiCall');
  const cooldownPeriod = 60000; // 60 seconds
  
  if (lastFailedApiCall) {
    const timeSinceLastFailure = Date.now() - parseInt(lastFailedApiCall);
    if (timeSinceLastFailure < cooldownPeriod) {
      console.warn(`Documents API: Last failure ${Math.round(timeSinceLastFailure/1000)} seconds ago, waiting ${Math.round((cooldownPeriod - timeSinceLastFailure)/1000)} more seconds`);
      return { 
        data: { 
          status: 'cooldown',
          message: 'API call cooldown period not expired',
          data: null
        } 
      };
    }
  }
  
  // Create AbortController for timeout
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 5000);
  
  try {
    while (retryCount <= maxRetries) {
      try {
        const result = await apiCall(abortController.signal);
        clearTimeout(timeoutId);
        localStorage.removeItem('lastFailedDocumentsApiCall');
        return result;
      } catch (error) {
        // Handle various error types with appropriate strategies
        // ...retry logic implementation...
      }
    }
  } finally {
    clearTimeout(timeoutId);
  }
};
```

## 5. Custom Hooks

### 5.1 useAuth Hook

Provides access to authentication context with user state and methods:

```javascript
// Usage example
const { user, isAuthenticated, login, logout } = useAuth();
```

### 5.2 useDocuments Hook

Encapsulates document management logic with loading states and error handling:

```javascript
// Available methods
const {
  loading,
  error,
  getDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  deleteDocument,
  submitForApproval,
  getPendingApprovals,
  approveDocument,
  rejectDocument
} = useDocuments();
```

Key features:
- Loading state management
- Consistent error handling
- Form validation
- API call abstraction
- Retry mechanisms for network issues
- Role-based access control integration

### 5.3 useAdmin Hook

Provides administrative functionality:

```javascript
const {
  loading,
  getSystemStats,
  getAllUsers,
  updateUser,
  deleteUser,
  getActiveUsers,
  getSystemHealth
} = useAdmin();
```

### 5.4 useNotification Hook

Provides toast notification functions:

```javascript
const { successToast, errorToast, warningToast, infoToast } = useNotification();
```

## 6. Component Architecture

### 6.1 Layout Components

#### 6.1.1 MainLayout

Primary authenticated layout with:
- Header component
- Sidebar navigation
- Main content area
- Role-based access control
- Authentication verification
- Loading state handling

```javascript
// Role-based access control in MainLayout
const isAdminRoute = location.pathname.startsWith('/admin');
const hasAdminAccess = user && user.role === 'ADMIN';

if (isAdminRoute && !hasAdminAccess && !loading && isAuthenticated) {
  return <Navigate to="/dashboard" replace />;
}
```

#### 6.1.2 AuthLayout

Layout for unauthenticated pages with:
- Centered content
- Logo and branding
- Background styling
- Responsive design

#### 6.1.3 Sidebar

Navigation sidebar with:
- Dynamic menu based on user role
- Notification badges for pending approvals
- User information display
- Mobile responsiveness with slide-in animation
- Automatic refresh of pending approval counts

```javascript
// Dynamic menu generation based on user role
const renderMenuItems = () => {
  // Common items for all users
  const commonItems = [
    { path: '/dashboard', label: 'Gösterge Paneli', icon: '...' },
    // ...other common items
  ];

  // Admin-only items
  const adminItems = user && user.role === 'ADMIN' ? [
    { separator: true, label: 'Yönetim' },
    { path: '/admin', label: 'Admin Paneli', icon: '...' },
    // ...other admin items
  ] : [];

  return [...commonItems, ...adminItems];
};
```

### 6.2 UI Components

#### 6.2.1 Button Component

Reusable button with variants:
- Primary, secondary, danger, success styles
- Size options (small, medium, large)
- Loading state with spinner
- Icon support
- Disabled state handling

#### 6.2.2 Input Component

Form input with:
- Label and placeholder
- Error state and message display
- Icon support
- Different input types
- Validation integration

#### 6.2.3 Modal Component

Dialog component with:
- Customizable header and footer
- Close button
- Backdrop click handling
- Animation effects
- Size options

#### 6.2.4 Card Component

Content container with:
- Header and footer options
- Shadow and border styling
- Padding and margin control
- Clickable variant

### 6.3 Document Components

#### 6.3.1 ApprovalFlowSelector

Component for selecting approval workflows:
- List of available approval flows
- Flow type indicators (sequential, quick)
- User selection for custom flows
- Preview of selected flow

#### 6.3.2 ApprovalFlowStatus

Displays approval flow status:
- Visual representation of approval steps
- Current step indicator
- Completed and pending steps
- User information for each step

### 6.4 Admin Components

#### 6.4.1 LogDashboard

Dashboard for system logs:
- Log entry listing
- Severity indicators
- Timestamp formatting
- User and action information

#### 6.4.2 LogFilters

Filtering interface for logs:
- Date range selection
- Log level filters
- Module and category filters
- User filter
- Search functionality

## 7. Routing System

### 7.1 Route Structure

The application uses React Router v6 with nested routes:

```javascript
const routes = [
  {
    path: '/',
    element: <Navigate to="/dashboard" />
  },
  {
    path: '/',
    element: <AuthLayout />,
    children: [
      { path: 'giris', element: <Login /> },
      { path: 'sifremi-unuttum', element: <ForgotPassword /> },
      { path: 'sifre-sifirlama/:token', element: <ResetPassword /> }
    ]
  },
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'belgeler', element: <Documents /> },
      // ...other protected routes
      { path: 'admin', element: <AdminDashboard /> },
      { path: 'admin/kullanicilar', element: <UserManagement /> },
      // ...other admin routes
    ]
  },
  {
    path: 'verify',
    element: <VerifyEmail />
  },
  {
    path: '*',
    element: <NotFound />
  }
];
```

### 7.2 Route Categories

#### 7.2.1 Public Routes

- `/giris` - Login page
- `/sifremi-unuttum` - Forgot password page
- `/sifre-sifirlama/:token` - Password reset page
- `/verify` - Email verification page

#### 7.2.2 Protected Routes

- `/dashboard` - User dashboard
- `/belgeler` - Document listing
- `/belge-olustur` - Document creation
- `/belgeler/:id` - Document details
- `/onay-bekleyenler` - Pending approvals
- `/profil` - User profile

#### 7.2.3 Admin Routes

- `/admin` - Admin dashboard
- `/admin/kullanicilar` - User management
- `/admin/kullanicilar/yeni` - Create user
- `/admin/onay-akislari` - Approval flows
- `/admin/onay-akislari/yeni` - Create approval flow
- `/admin/sistem-loglari` - System logs

## 8. State Management

### 8.1 Context API Implementation

The application uses React Context API for global state management:

#### 8.1.1 AuthContext

Manages authentication state:
- User information
- Authentication status
- Token management
- Login/logout functions
- Profile update functions

#### 8.1.2 NotificationContext

Provides toast notification system:
- Success notifications
- Error notifications
- Warning notifications
- Info notifications
- Customizable duration and position

### 8.2 Local Component State

Used for UI-specific state:
- Form input values
- Validation errors
- Modal visibility
- Pagination controls
- Sort and filter options

### 8.3 URL Parameters

Used for shareable state:
- Filter criteria
- Page numbers
- Sort order
- Search queries
- Detail view IDs

## 9. Document Workflow Implementation

### 9.1 Document Creation

1. User fills document form with metadata
2. File is uploaded (PDF only)
3. Document is created in draft status
4. User can edit or submit for approval

### 9.2 Approval Process

1. Document is submitted with approval flow selection
2. Approvers receive notification
3. Each approver reviews and approves/rejects
4. Document status updates based on approvals
5. Final approval changes status to approved

### 9.3 Document States

- **Draft**: Initial document state
- **Pending**: Submitted for approval
- **In Review**: Currently being reviewed
- **Approved**: Fully approved document
- **Rejected**: Rejected by an approver
- **Archived**: No longer active

## 10. Performance Optimizations

### 10.1 Memoization

The application uses React's memoization features:

```javascript
// Memoized user display data
const userDisplayData = useMemo(() => {
  if (!user) {
    return {
      initials: 'KK',
      name: 'Kullanıcı Adı',
      deptPos: 'Departman / Pozisyon'
    };
  }
  
  return {
    initials: getUserInitials(user),
    name: getFullName(user),
    deptPos: getDepartmentPosition(user)
  };
}, [user, getUserInitials, getFullName, getDepartmentPosition]);
```

### 10.2 API Call Optimization

- **Cooldown Periods**: Prevent API flooding during errors
- **Caching**: Store and reuse API responses
- **Debouncing**: Limit frequency of API calls
- **Batching**: Combine related API calls
- **Background Refreshing**: Update data when tab becomes visible

### 10.3 Lazy Loading

- Route-based code splitting
- Dynamic imports for large components
- Progressive loading of dashboard data

## 11. Security Features

### 11.1 Authentication Security

- JWT token with expiration
- Secure token storage
- Automatic token refresh
- Session invalidation on logout
- CSRF protection

### 11.2 Input Validation

- Client-side validation for immediate feedback
- Server-side validation for security
- File type and size restrictions
- Input sanitization

### 11.3 Role-Based Access Control

- Route protection based on user role
- Component-level permission checks
- API call authorization
- UI adaptation based on permissions

## 12. Error Handling

### 12.1 API Error Handling

- Consistent error response format
- Error classification (auth, permission, validation, network)
- Retry logic for transient errors
- Graceful degradation during API outages
- User-friendly error messages

### 12.2 Form Validation Errors

- Field-level error messages
- Form-level error summary
- Inline validation feedback
- Error state persistence during navigation

### 12.3 Global Error Boundary

- Catch and display unhandled errors
- Prevent complete UI crashes
- Error reporting mechanism
- Recovery options

## 13. Responsive Design

### 13.1 Mobile-First Approach

- Tailwind CSS breakpoints
- Responsive layout components
- Touch-friendly UI elements
- Optimized for various screen sizes

### 13.2 Adaptive Components

- Sidebar collapses to menu on mobile
- Tables convert to cards on small screens
- Simplified forms on mobile devices
- Touch-optimized controls

## 14. Internationalization

The application is currently implemented in Turkish with infrastructure ready for multilingual support:

- Text constants in Turkish
- Date/time formatting for Turkish locale
- Number formatting for Turkish locale
- Right-to-left (RTL) support readiness

## 15. Accessibility

### 15.1 Keyboard Navigation

- Focusable elements
- Logical tab order
- Keyboard shortcuts
- Focus management

### 15.2 Screen Reader Support

- Semantic HTML
- ARIA attributes
- Alternative text for images
- Meaningful form labels

## 16. Integration with Backend

### 16.1 API Integration

- RESTful API communication
- JWT authentication
- Structured request/response formats
- Error handling protocol

### 16.2 File Handling

- PDF file upload
- File size and type validation
- Download functionality
- Preview integration

## 17. Development Workflow

### 17.1 Project Setup

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

### 17.2 Code Organization

- Feature-based directory structure
- Consistent naming conventions
- Component isolation
- Reusable hooks and utilities

## 18. Conclusion

The Document Management System frontend is a sophisticated React application with comprehensive features for document workflow management. It follows best practices in modern React development, with a focus on maintainability, performance, and user experience.

The modular architecture allows for easy extension and modification, while the robust error handling and security features ensure a reliable and secure user experience. The responsive design ensures usability across various devices, making it suitable for organizations of all sizes.