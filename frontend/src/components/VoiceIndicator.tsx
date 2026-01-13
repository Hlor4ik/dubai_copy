import { motion } from 'framer-motion';
import { SpeakingState } from '../types';
import styles from './VoiceIndicator.module.css';

interface Props {
  state: SpeakingState;
}

export function VoiceIndicator({ state }: Props) {
  const bars = [0, 1, 2, 3, 4];
  
  const getLabel = () => {
    switch (state) {
      case 'user':
        return 'Вы говорите';
      case 'assistant':
        return 'Консультант говорит';
      default:
        return 'Ожидание';
    }
  };

  const isActive = state !== 'idle';

  return (
    <div className={styles.container}>
      <div className={`${styles.bars} ${isActive ? styles.active : ''}`}>
        {bars.map((i) => (
          <motion.div
            key={i}
            className={`${styles.bar} ${state === 'user' ? styles.user : state === 'assistant' ? styles.assistant : ''}`}
            animate={isActive ? {
              scaleY: [1, 1.5 + Math.random(), 0.5, 1.2 + Math.random() * 0.5, 1],
            } : { scaleY: 1 }}
            transition={{
              duration: 0.5,
              repeat: isActive ? Infinity : 0,
              delay: i * 0.1,
            }}
          />
        ))}
      </div>
      <span className={styles.label}>{getLabel()}</span>
    </div>
  );
}

