import React from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../../hooks/useAuth';
import { formatDate } from '../../utils/formatters';

/**
 * Onay akışı adımını gösteren bileşen
 */
const ApprovalStep = ({ step, currentStep, currentUserId }) => {
  const isPending = step.status === 'pending';
  const isApproved = step.status === 'approved';
  const isRejected = step.status === 'rejected';
  const isCurrent = step.order === currentStep;
  const isCurrentUser = step.userId?._id === currentUserId;
  
  return (
    <div className={`flex items-center mb-4 ${isCurrent ? 'bg-blue-50 p-2 rounded' : ''}`}>
      <div className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center mr-4
        ${isPending ? 'bg-gray-200' : isApproved ? 'bg-green-100' : 'bg-red-100'}">
        {isPending ? (
          <span className="text-gray-500 font-semibold">{step.order}</span>
        ) : isApproved ? (
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>
      
      <div className="flex-grow">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-900">
              {step.userId?.firstName} {step.userId?.lastName}
              {isCurrentUser && <span className="ml-2 text-xs text-blue-600">(Siz)</span>}
            </h4>
            <p className="text-xs text-gray-500">
              {step.userId?.position || 'Pozisyon Belirtilmemiş'} - {step.userId?.department || 'Departman Belirtilmemiş'}
            </p>
          </div>
          
          <div className="text-right">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
              ${isPending ? 'bg-gray-100 text-gray-800' : 
                isApproved ? 'bg-green-100 text-green-800' : 
                'bg-red-100 text-red-800'}`}>
              {isPending ? 'Bekliyor' : isApproved ? 'Onaylandı' : 'Reddedildi'}
            </span>
            
            {(isApproved || isRejected) && step.actionDate && (
              <p className="text-xs text-gray-500 mt-1">
                {formatDate(step.actionDate)}
              </p>
            )}
          </div>
        </div>
        
        {step.comment && (
          <div className="mt-1 text-sm text-gray-600 bg-gray-50 p-2 rounded">
            "{step.comment}"
          </div>
        )}
        
        {isCurrent && isPending && (
          <div className="mt-2 bg-yellow-50 border-l-4 border-yellow-400 p-2">
            <p className="text-xs text-yellow-700">
              Bu adım onay bekliyor
              {isCurrentUser && ' - Onay vermeniz gerekiyor'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Onay akışı türünü gösteren bileşen
 */
const ApprovalTypeTag = ({ flowType }) => {
  let label, bgColor, textColor;
  
  switch (flowType) {
    case 'quick':
      label = 'Hızlı Onay';
      bgColor = 'bg-green-100';
      textColor = 'text-green-800';
      break;
    case 'standard':
      label = 'Standart Onay';
      bgColor = 'bg-blue-100';
      textColor = 'text-blue-800';
      break;
    default:
      label = 'Standart Onay';
      bgColor = 'bg-blue-100';
      textColor = 'text-blue-800';
  }
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColor} ${textColor}`}>
      {label}
    </span>
  );
};

/**
 * Onay akışı durumunu gösteren bileşen
 */
const ApprovalFlowStatus = ({ approvalFlow, loading }) => {
  const { user } = useAuth();
  
  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }
  
  if (!approvalFlow) {
    return (
      <div className="text-center py-4">
        <p className="text-gray-500">Bu belge için onay akışı bulunmuyor</p>
      </div>
    );
  }
  
  const { steps, currentStep, status, flowType } = approvalFlow;
  
  // Onay durumunu belirle
  let statusLabel, statusColor;
  switch (status) {
    case 'approved':
      statusLabel = 'Onaylandı';
      statusColor = 'text-green-600';
      break;
    case 'rejected':
      statusLabel = 'Reddedildi';
      statusColor = 'text-red-600';
      break;
    case 'pending':
      statusLabel = 'Onay Bekliyor';
      statusColor = 'text-yellow-600';
      break;
    default:
      statusLabel = 'Beklemede';
      statusColor = 'text-gray-600';
  }
  
  // Kullanıcının onay vermesi gereken adımı bul
  const userStep = steps.find(step => 
    step.userId?._id === user.id && step.status === 'pending'
  );
  
  const canUserApprove = userStep && userStep.order === currentStep; // Sadece mevcut adımı onaylayabilir
  
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Onay Akışı</h3>
        <div className="flex items-center">
          <ApprovalTypeTag flowType={flowType} />
          <span className={`ml-2 font-medium ${statusColor}`}>{statusLabel}</span>
        </div>
      </div>
      
      {canUserApprove && (
        <div className="mb-4 bg-blue-50 border-l-4 border-blue-500 p-3">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                Bu belge için onay vermeniz bekleniyor
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="space-y-1">
        {steps.map((step) => (
          <ApprovalStep 
            key={step._id} 
            step={step} 
            currentStep={currentStep} 
            currentUserId={user.id} 
          />
        ))}
      </div>
    </div>
  );
};

ApprovalFlowStatus.propTypes = {
  approvalFlow: PropTypes.shape({
    _id: PropTypes.string,
    documentId: PropTypes.string,
    steps: PropTypes.arrayOf(
      PropTypes.shape({
        _id: PropTypes.string,
        userId: PropTypes.object,
        order: PropTypes.number,
        status: PropTypes.string,
        comment: PropTypes.string,
        actionDate: PropTypes.string
      })
    ),
    currentStep: PropTypes.number,
    status: PropTypes.string,
    flowType: PropTypes.string
  }),
  loading: PropTypes.bool
};

export default ApprovalFlowStatus; 