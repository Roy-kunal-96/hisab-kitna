// Browser Speech Recognition & Audio Synth Engine for Hisab Kitab

// Declare Web Speech API types for browser environment
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export interface SpeechListenerCallbacks {
  onStart?: () => void;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}

class SpeechService {
  private recognition: any = null;
  private isListening: boolean = false;
  private audioCtx: AudioContext | null = null;

  constructor() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      // Default to Hindi India with automatic Hinglish understanding
      this.recognition.lang = 'hi-IN';
    }
  }

  public isSupported(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  public setLanguage(lang: 'hi-IN' | 'en-IN') {
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  public startListening(callbacks: SpeechListenerCallbacks) {
    if (!this.recognition) {
      callbacks.onError?.('Speech recognition is not supported in this browser. You can type or pick sample voice commands.');
      return;
    }

    if (this.isListening) {
      this.stopListening();
    }

    this.playTone(600, 0.08); // Friendly mic trigger sound

    this.recognition.onstart = () => {
      this.isListening = true;
      callbacks.onStart?.();
    };

    this.recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      callbacks.onResult?.(final || interim, !!final);
    };

    this.recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      this.isListening = false;
      callbacks.onError?.(event.error === 'no-speech' ? 'Koi aawaz nahi sunai di. Kripya dubara bolein.' : event.error);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      callbacks.onEnd?.();
    };

    try {
      this.recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      this.isListening = false;
      callbacks.onError?.('Microphone could not be accessed. Please check permissions.');
    }
  }

  public stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (err) {}
      this.isListening = false;
    }
  }

  // Text-To-Speech (Bolkar sunao)
  public speak(text: string, lang: string = 'hi-IN') {
    if (!('speechSynthesis' in window)) return;

    try {
      window.speechSynthesis.cancel(); // Stop any pending speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95; // Slightly measured rate for clear understanding in rural retail settings
      utterance.pitch = 1.0;
      utterance.lang = lang;

      // Select matching voice if available
      const voices = window.speechSynthesis.getVoices();
      const hindiVoice = voices.find((v) => v.lang.includes('hi') || v.lang.includes('hi-IN'));
      const indianEngVoice = voices.find((v) => v.lang.includes('en-IN'));
      if (hindiVoice) {
        utterance.voice = hindiVoice;
      } else if (indianEngVoice) {
        utterance.voice = indianEngVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('TTS playback error:', err);
    }
  }

  // Soft pleasant audio chime
  public playTone(freq: number = 800, duration: number = 0.1) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.audioCtx) this.audioCtx = new AudioCtx();

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.12, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {}
  }

  public playSuccessChime() {
    this.playTone(523.25, 0.1);
    setTimeout(() => this.playTone(659.25, 0.15), 100);
  }
}

export const speechService = new SpeechService();
