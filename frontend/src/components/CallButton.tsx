import { motion } from 'framer-motion';
import { CallState } from '../types';
import styles from './CallButton.module.css';

interface Props {
  callState: CallState;
  onStart: () => void;
  onEnd: () => void;
}

export function CallButton({ callState, onStart, onEnd }: Props) {
  const isActive = callState === 'active';
  const isConnecting = callState === 'connecting';
  const isEnded = callState === 'ended';

  const handleClick = () => {
    if (callState === 'idle') {
      onStart();
    } else if (callState === 'active') {
      onEnd();
    }
  };

  const getButtonText = () => {
    switch (callState) {
      case 'connecting':
        return 'Подключение...';
      case 'active':
        return 'Завершить звонок';
      case 'ended':
        return 'Звонок завершён';
      default:
        return 'Начать звонок';
    }
  };

  return (
    <motion.button
      className={`${styles.button} ${isActive ? styles.active : ''} ${isEnded ? styles.ended : ''}`}
      onClick={handleClick}
      disabled={isConnecting || isEnded}
      whileHover={{ scale: isConnecting || isEnded ? 1 : 1.05 }}
      whileTap={{ scale: isConnecting || isEnded ? 1 : 0.95 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <span className={styles.icon}>
        {isActive ? (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
          </svg>
        )}
      </span>
      <span className={styles.text}>{getButtonText()}</span>
      
      {isConnecting && (
        <motion.span
          className={styles.spinner}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </motion.button>
  );
}

