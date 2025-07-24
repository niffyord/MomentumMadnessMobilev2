import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from 'react'

import { CustomNotification } from './CustomNotification'

interface NotificationData {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  title?: string
  duration?: number
}

interface NotificationContextType {
  showSuccess: (message: string, title?: string, duration?: number) => void
  showError: (message: string, title?: string, duration?: number) => void
  showWarning: (message: string, title?: string, duration?: number) => void
  showInfo: (message: string, title?: string, duration?: number) => void
  dismiss: (id: string) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export const useNotification = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider')
  }
  return context
}

interface NotificationProviderProps {
  children: React.ReactNode
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationData[]>([])

  const generateId = () => `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const addNotification = useCallback((
    type: NotificationData['type'],
    message: string,
    title?: string,
    duration = 3000
  ) => {
    const id = generateId()
    
    const newNotification: NotificationData = {
      id,
      type,
      message,
      title,
      duration,
    }

    setNotifications(prev => {
      // Only show one notification at a time for better UX
      // Remove any existing notifications and add the new one
      return [newNotification]
    })

    // Auto-remove after duration + animation time
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, duration + 500)
  }, [])

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const showSuccess = useCallback((message: string, title?: string, duration?: number) => {
    addNotification('success', message, title, duration)
  }, [addNotification])

  const showError = useCallback((message: string, title?: string, duration?: number) => {
    addNotification('error', message, title, duration)
  }, [addNotification])

  const showWarning = useCallback((message: string, title?: string, duration?: number) => {
    addNotification('warning', message, title, duration)
  }, [addNotification])

  const showInfo = useCallback((message: string, title?: string, duration?: number) => {
    addNotification('info', message, title, duration)
  }, [addNotification])

  const contextValue: NotificationContextType = {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    dismiss,
  }

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      
      {/* Render notifications */}
      {notifications.map(notification => (
        <CustomNotification
          key={notification.id}
          type={notification.type}
          message={notification.message}
          title={notification.title}
          visible={true}
          onDismiss={() => dismiss(notification.id)}
          duration={notification.duration}
        />
      ))}
    </NotificationContext.Provider>
  )
} 