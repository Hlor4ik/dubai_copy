import { useState } from 'react';
import styles from './PhoneModal.module.css';

interface PhoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (phoneNumber: string) => void;
  isLoading?: boolean;
}

export default function PhoneModal({ isOpen, onClose, onSubmit, isLoading }: PhoneModalProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Простая валидация
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.length < 10) {
      setError('Введите корректный номер телефона');
      return;
    }

    setError('');
    onSubmit(cleaned);
  };

  const formatPhoneNumber = (value: string) => {
    // Автоформатирование при вводе
    const cleaned = value.replace(/\D/g, '');
    return cleaned;
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>✕</button>
        
        <h2 className={styles.title}>Получить презентацию</h2>
        <p className={styles.subtitle}>
          Введите номер WhatsApp для получения детальной презентации квартиры
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <input
              type="tel"
              placeholder="+7 999 123 45 67"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
              className={styles.input}
              disabled={isLoading}
              autoFocus
            />
            {error && <p className={styles.error}>{error}</p>}
          </div>

          <button 
            type="submit" 
            className={styles.submitButton}
            disabled={isLoading}
          >
            {isLoading ? 'Отправка...' : 'Отправить в WhatsApp'}
          </button>

          <p className={styles.note}>
            📱 PDF-презентация будет отправлена на указанный номер
          </p>
        </form>
      </div>
    </div>
  );
}
