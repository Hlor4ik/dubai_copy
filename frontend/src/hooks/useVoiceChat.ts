import { useState, useRef, useCallback } from 'react';
import { CallState, SpeakingState, SessionStartResponse } from '../types';

// Use env variable for API base URL (e.g., http://YOUR_IP:3000/api for external access)
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function useVoiceChat() {
  const [callState, setCallState] = useState<CallState>('idle');
  const [speakingState, setSpeakingState] = useState<SpeakingState>('idle');
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [landingUrl, setLandingUrl] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Progressive audio playback queue
  const playNextInQueue = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      return;
    }

    isPlayingRef.current = true;
    const base64Audio = audioQueueRef.current.shift()!;
    
    console.log('[AUDIO] Starting playback, chunks remaining:', audioQueueRef.current.length);
    
    return new Promise<void>((resolve) => {
      const audio = new Audio(`data:audio/mpeg;base64,${base64Audio}`);
      currentAudioRef.current = audio;
      
      audio.onended = () => {
        console.log('[AUDIO] Playback ended');
        isPlayingRef.current = false;
        currentAudioRef.current = null;
        resolve();
        // Play next chunk if available
        playNextInQueue();
      };
      
      audio.onerror = (e) => {
        console.error('[AUDIO] Playback error:', e);
        console.error('[AUDIO] Error details:', audio.error);
        isPlayingRef.current = false;
        currentAudioRef.current = null;
        resolve();
        playNextInQueue();
      };
      
      audio.play().then(() => {
        console.log('[AUDIO] Play started successfully');
      }).catch((e) => {
        console.error('[AUDIO] Play failed:', e);
        console.error('[AUDIO] Error name:', e.name, 'message:', e.message);
        isPlayingRef.current = false;
        currentAudioRef.current = null;
        resolve();
        playNextInQueue();
      });
    });
  }, []);

  // Add audio chunk to queue and start playback if not already playing
  const enqueueAudio = useCallback((base64Audio: string) => {
    console.log('[AUDIO QUEUE] Adding chunk, current queue size:', audioQueueRef.current.length);
    audioQueueRef.current.push(base64Audio);
    if (!isPlayingRef.current) {
      console.log('[AUDIO QUEUE] Starting playback');
      setSpeakingState('assistant');
      
      // Resume AudioContext if suspended (mobile requirement)
      if (audioContextRef.current?.state === 'suspended') {
        console.log('[AUDIO] Resuming suspended AudioContext');
        audioContextRef.current.resume().catch(e => console.error('[AUDIO] Resume failed:', e));
      }
      
      playNextInQueue();
    }
  }, [playNextInQueue]);

  // Legacy playAudio for non-streaming (greeting)
  const playAudio = useCallback((base64Audio: string): Promise<void> => {
    return new Promise((resolve) => {
      setSpeakingState('assistant');
      
      const audio = new Audio(`data:audio/mpeg;base64,${base64Audio}`);
      currentAudioRef.current = audio;
      
      audio.onended = () => {
        setSpeakingState('idle');
        currentAudioRef.current = null;
        resolve();
      };
      
      audio.onerror = () => {
        setSpeakingState('idle');
        currentAudioRef.current = null;
        resolve();
      };
      
      audio.play().catch(() => {
        setSpeakingState('idle');
        currentAudioRef.current = null;
        resolve();
      });
    });
  }, []);

  // Начать сессию
  const startCall = useCallback(async () => {
    try {
      setError(null);
      setCallState('connecting');
      setLandingUrl(null);
      setLastResponse(null);

      // Проверяем поддержку и запрашиваем доступ к микрофону
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('NO_MEDIA_DEVICES');
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e: any) {
        if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) {
          throw new Error('PERMISSION_DENIED');
        }
        if (e && e.name === 'NotFoundError') {
          throw new Error('NO_MIC_FOUND');
        }
        throw e;
      }
      
      audioContextRef.current = new AudioContext();

      // Начинаем сессию на сервере
      const response = await fetch(`${API_BASE}/session/start`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to start session');
      }

      const data: SessionStartResponse = await response.json();
      setSessionId(data.sessionId);
      setCallState('active');
      setLastResponse(data.greeting);

      // Воспроизводим приветствие
      await playAudio(data.audio);

      // Настраиваем MediaRecorder с поддержкой разных форматов
      // Проверяем поддерживаемые форматы (Safari iOS не поддерживает webm)
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/mpeg',
        '',
      ];
      
      let selectedMimeType = '';
      for (const type of mimeTypes) {
        if (type === '' || MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type;
          console.log('[MediaRecorder] Using MIME type:', type || 'default');
          break;
        }
      }

      const mediaRecorder = new MediaRecorder(stream, 
        selectedMimeType ? { mimeType: selectedMimeType } : undefined
      );

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
    } catch (err) {
      console.error('Error starting call:', err);
      console.error('Error details:', {
        message: (err as Error).message,
        name: (err as any).name,
        stack: (err as Error).stack,
      });
      const code = (err as Error).message;
      if (code === 'NO_MEDIA_DEVICES') {
        setError('Браузер не поддерживает доступ к микрофону или требуется HTTPS.');
      } else if (code === 'PERMISSION_DENIED') {
        setError('Доступ к микрофону запрещён. Проверьте настройки браузера.');
      } else if (code === 'NO_MIC_FOUND') {
        setError('Микрофон не найден.');
      } else {
        setError(`Не удалось начать звонок: ${(err as Error).message}`);
      }
      setCallState('idle');
      
      // Try to end session on backend
      if (sessionId) {
        try {
          await fetch(`${API_BASE}/session/end`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          });
        } catch (e) {
          console.error('Failed to end session:', e);
        }
      }
    }
  }, [playAudio]);

  // Начать запись
  const startRecording = useCallback(() => {
    if (mediaRecorderRef.current && callState === 'active' && speakingState === 'idle' && !isProcessing) {
      audioChunksRef.current = [];
      mediaRecorderRef.current.start();
      setSpeakingState('user');
    }
  }, [callState, speakingState, isProcessing]);

  // Остановить запись и отправить (STREAMING VERSION)
  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || !sessionId || speakingState !== 'user') {
      return;
    }

    return new Promise<void>((resolve) => {
      const recorder = mediaRecorderRef.current!;
      
      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        if (audioBlob.size < 1000) {
          setSpeakingState('idle');
          resolve();
          return;
        }

        try {
          setSpeakingState('idle');
          setIsProcessing(true);
          setLastResponse(null);
          
          // Clear audio queue
          audioQueueRef.current = [];
          if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current = null;
          }
          isPlayingRef.current = false;

          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');
          formData.append('sessionId', sessionId);

          // Use streaming endpoint
          const response = await fetch(`${API_BASE}/chat/voice-stream`, {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error('Failed to process voice');
          }

          // Parse SSE stream
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let finalResponse = '';

          if (!reader) {
            throw new Error('No stream reader available');
          }

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';

            for (const message of lines) {
              if (!message.trim()) continue;
              
              const eventMatch = message.match(/^event:\s*(\w+)\s*\ndata:\s*(.+)$/m);
              if (!eventMatch) continue;

              const [, event, data] = eventMatch;

              if (event === 'audio') {
                // Enqueue audio chunk for progressive playback
                console.log('[SSE] Received audio chunk');
                enqueueAudio(data);
              } else if (event === 'done') {
                try {
                  const meta = JSON.parse(data);
                  finalResponse = meta.response || '';
                  setLastResponse(finalResponse);
                  console.log('[SSE] Done event, response:', finalResponse.substring(0, 50));
                  
                  if (meta.landingUrl) {
                    setLandingUrl(meta.landingUrl);
                  }
                } catch (e) {
                  console.error('[SSE] Failed to parse done event:', e);
                }
              } else if (event === 'error') {
                console.error('[SSE] Error event:', data);
              }
            }
          }

          setIsProcessing(false);
          
          // Wait for audio queue to finish
          const checkQueue = setInterval(() => {
            if (audioQueueRef.current.length === 0 && !isPlayingRef.current) {
              clearInterval(checkQueue);
              setSpeakingState('idle');
            }
          }, 100);

        } catch (err) {
          console.error('Error processing voice:', err);
          setError('Ошибка обработки голосового сообщения');
          setIsProcessing(false);
          setSpeakingState('idle');
        }
        
        resolve();
      };

      recorder.stop();
    });
  }, [sessionId, speakingState, enqueueAudio]);

  // Завершить звонок
  const endCall = useCallback(async () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    
    audioQueueRef.current = [];
    isPlayingRef.current = false;

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }

    if (sessionId) {
      try {
        await fetch(`${API_BASE}/session/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
      } catch (err) {
        console.error('Error ending session:', err);
      }
    }

    setCallState('ended');
    setSpeakingState('idle');
    setSessionId(null);
    setIsProcessing(false);
    
    setTimeout(() => {
      setCallState('idle');
      setLastResponse(null);
    }, 2000);
  }, [sessionId]);

  // Перезапустить
  const restart = useCallback(() => {
    setCallState('idle');
    setError(null);
    setLandingUrl(null);
    setLastResponse(null);
    setIsProcessing(false);
    audioQueueRef.current = [];
    isPlayingRef.current = false;
  }, []);

  const sendPresentation = useCallback(async (apartmentId: string, phoneNumber: string) => {
    try {
      const response = await fetch(`${API_BASE}/send-presentation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apartmentId, phoneNumber }),
      });

      if (!response.ok) {
        throw new Error('Failed to send presentation');
      }

      const data = await response.json();
      return { success: data.success, error: data.error };
    } catch (err: any) {
      console.error('[Presentation] Error:', err);
      return { success: false, error: err.message };
    }
  }, []);

  return {
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
  };
}
