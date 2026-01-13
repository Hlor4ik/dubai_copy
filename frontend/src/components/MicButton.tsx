import { motion } from 'framer-motion';
import styles from './MicButton.module.css';

interface Props {
  isRecording: boolean;
  disabled: boolean;
  onMouseDown: () => void;
  onMouseUp: () => void;
}

export function MicButton({ isRecording, disabled, onMouseDown, onMouseUp }: Props) {
  return (
    <div className={styles.container}>
      <motion.button
        className={`${styles.button} ${isRecording ? styles.recording : ''}`}
        disabled={disabled}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onTouchStart={onMouseDown}
        onTouchEnd={onMouseUp}
        whileHover={{ scale: disabled ? 1 : 1.05 }}
        whileTap={{ scale: disabled ? 1 : 0.95 }}
        animate={isRecording ? { scale: [1, 1.1, 1] } : {}}
        transition={{ duration: 0.5, repeat: isRecording ? Infinity : 0 }}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className={styles.icon}>
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
        </svg>
      </motion.button>
      <p className={styles.hint}>
        {isRecording ? 'Отпустите для отправки' : 'Удерживайте для записи'}
      </p>
      
      {isRecording && (
        <motion.div
          className={styles.pulse}
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
    </div>
  );
}

