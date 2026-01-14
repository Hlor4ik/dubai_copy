import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoiceChat } from '../hooks/useVoiceChat';
import { CallButton } from '../components/CallButton';
import { MicButton } from '../components/MicButton';
import { VoiceIndicator } from '../components/VoiceIndicator';
import { LandingPopup } from '../components/LandingPopup';
import PhoneModal from '../components/PhoneModal';
import styles from './HomePage.module.css';

export default function HomePage() {
  const {
    callState,
    speakingState,
    isProcessing,
    error,
    landingUrl,
    lastResponse,
    startCall,
    startRecording,
    stopRecording,
    endCall,
    restart,
    sendPresentation,
  } = useVoiceChat();

  const [showPopup, setShowPopup] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [currentApartmentId, setCurrentApartmentId] = useState<string | null>(null);
  const [isSendingPresentation, setIsSendingPresentation] = useState(false);
  const [presentationSent, setPresentationSent] = useState(false);

  // Показываем попап когда появляется landingUrl
  useEffect(() => {
    if (landingUrl) {
      console.log('[UI] Landing URL received:', landingUrl);
      // Извлекаем apartment ID из URL
      const match = landingUrl.match(/\/apartment\/([^/]+)/);
      if (match) {
        setCurrentApartmentId(match[1]);
      }
      setShowPopup(true);
    }
  }, [landingUrl]);

  return (
    <div className={styles.page}>
      {/* Background Effects */}
      <div className={styles.bgGlow} />
      <div className={styles.bgPattern} />

      {/* Header */}
      <motion.header
        className={styles.header}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className={styles.logo}>
          <span className={styles.logoIcon}>◆</span>
          <span className={styles.logoText}>Dubai AI</span>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className={styles.main}>
        <motion.div
          className={styles.content}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <h1 className={styles.title}>
            <span className={styles.titleSmall}>Ваш персональный</span>
            <span className={styles.titleLarge}>ИИ-консультант</span>
            <span className={styles.titleAccent}>по недвижимости в Дубае</span>
          </h1>

          <p className={styles.subtitle}>
            Расскажите о своих предпочтениях голосом — искусственный интеллект
            подберёт идеальную квартиру специально для вас
          </p>

          {/* Call Interface */}
          <div className={styles.callInterface}>
            {callState === 'idle' && (
              <CallButton
                callState={callState}
                onStart={startCall}
                onEnd={endCall}
              />
            )}

            {(callState === 'connecting' || callState === 'active' || callState === 'ended') && (
              <motion.div
                className={styles.activeCall}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                {/* Processing Indicator */}
                <AnimatePresence>
                  {isProcessing && (
                    <motion.div
                      className={styles.processing}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <div className={styles.processingDots}>
                        <span />
                        <span />
                        <span />
                      </div>
                      <p>Обрабатываю...</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Response Text */}
                <AnimatePresence>
                  {lastResponse && !isProcessing && (
                    <motion.div
                      className={styles.responseText}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      <p>{lastResponse}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <VoiceIndicator state={speakingState} />

                {callState === 'active' && (
                  <MicButton
                    isRecording={speakingState === 'user'}
                    disabled={speakingState === 'assistant' || isProcessing}
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                  />
                )}

                <CallButton
                  callState={callState}
                  onStart={startCall}
                  onEnd={endCall}
                />
              </motion.div>
            )}

            {error && (
              <motion.div
                className={styles.error}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <p>{error}</p>
                <button onClick={restart}>Попробовать снова</button>
              </motion.div>
            )}
          </div>

          {/* Features */}
          <div className={styles.features}>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>🎙️</span>
              <span>Голосовой диалог</span>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>🏠</span>
              <span>Подбор квартир</span>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>📄</span>
              <span>Персональный лендинг</span>
            </div>
          </div>
        </motion.div>

        {/* Decorative Dubai Skyline */}
        <div className={styles.skyline}>
          <svg viewBox="0 0 1200 200" preserveAspectRatio="none">
            <defs>
              <linearGradient id="skylineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="var(--color-gold-primary)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="var(--color-gold-primary)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              fill="url(#skylineGrad)"
              d="M0,200 L0,180 L50,180 L50,160 L80,160 L80,140 L100,140 L100,100 L120,100 L120,80 L150,80 L150,60 L180,60 L180,80 L200,80 L200,120 L230,120 L230,100 L260,100 L260,40 L280,40 L280,20 L300,20 L300,40 L320,40 L320,100 L350,100 L350,80 L400,80 L400,60 L420,60 L420,30 L450,30 L450,10 L480,10 L480,30 L510,30 L510,60 L540,60 L540,100 L580,100 L580,120 L620,120 L620,80 L660,80 L660,60 L700,60 L700,40 L730,40 L730,20 L760,20 L760,40 L790,40 L790,80 L830,80 L830,100 L870,100 L870,60 L900,60 L900,40 L930,40 L930,60 L960,60 L960,100 L1000,100 L1000,120 L1040,120 L1040,140 L1080,140 L1080,160 L1120,160 L1120,180 L1200,180 L1200,200 Z"
            />
          </svg>
        </div>
      </main>

      {/* Landing Popup */}
      <LandingPopup
        url={showPopup ? landingUrl : null}
        onClose={() => setShowPopup(false)}
        onRequestPresentation={() => {
          setShowPhoneModal(true);
          setPresentationSent(false);
        }}
      />

      {/* Phone Modal */}
      <PhoneModal
        isOpen={showPhoneModal}
        onClose={() => {
          setShowPhoneModal(false);
          setPresentationSent(false);
        }}
        isLoading={isSendingPresentation}
        onSubmit={async (phoneNumber) => {
          if (!currentApartmentId) return;
          
          setIsSendingPresentation(true);
          const result = await sendPresentation(currentApartmentId, phoneNumber);
          setIsSendingPresentation(false);
          
          if (result.success) {
            setPresentationSent(true);
            setTimeout(() => {
              setShowPhoneModal(false);
              setPresentationSent(false);
            }, 2000);
          } else {
            alert('Ошибка отправки. Попробуйте снова.');
          }
        }}
      />
      
      {presentationSent && (
        <motion.div
          className={styles.successToast}
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
        >
          ✓ Презентация отправлена в WhatsApp!
        </motion.div>
      )}
    </div>
  );
}
