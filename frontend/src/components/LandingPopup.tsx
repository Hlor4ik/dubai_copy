import { motion, AnimatePresence } from 'framer-motion';
import styles from './LandingPopup.module.css';

interface Props {
  url: string | null;
  onClose: () => void;
}

export function LandingPopup({ url, onClose }: Props) {
  if (!url) return null;

  return (
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className={styles.popup}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.icon}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
          </div>
          <h3 className={styles.title}>Персональная страница создана!</h3>
          <p className={styles.text}>
            Мы подготовили для вас персональную презентацию квартиры
          </p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
          >
            Открыть страницу квартиры
          </a>
          <button className={styles.close} onClick={onClose}>
            Продолжить диалог
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

