// Audio Generator for Cosmic Social Network
class AudioGenerator {
    constructor() {
        this.audioContext = null;
        this.sounds = {};
        this.init();
    }

    init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.generateSounds();
        } catch (error) {
            console.error('Audio context failed:', error);
        }
    }

    generateSounds() {
        // Generate ringtone (classic phone ring)
        this.sounds.ringtone = this.createRingtone();
        
        // Generate call connected sound
        this.sounds.callConnected = this.createCallConnectedSound();
        
        // Generate call ended sound
        this.sounds.callEnded = this.createCallEndedSound();
        
        // Generate notification sound
        this.sounds.notification = this.createNotificationSound();
    }

    createRingtone() {
        const duration = 2; // 2 seconds
        const sampleRate = this.audioContext.sampleRate;
        const length = sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);

        // Create classic phone ring pattern
        for (let i = 0; i < length; i++) {
            const time = i / sampleRate;
            
            // Ring pattern: 2 quick beeps, pause, repeat
            const ringPattern = Math.floor(time * 4) % 4;
            let amplitude = 0;
            
            if (ringPattern < 2) {
                // Two quick beeps
                const beepFreq = ringPattern === 0 ? 800 : 1000;
                amplitude = Math.sin(2 * Math.PI * beepFreq * time) * 
                           Math.sin(2 * Math.PI * 4 * time) * 0.3;
            }
            
            data[i] = amplitude;
        }

        return buffer;
    }

    createCallConnectedSound() {
        const duration = 0.5;
        const sampleRate = this.audioContext.sampleRate;
        const length = sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);

        // Ascending tone for connection
        for (let i = 0; i < length; i++) {
            const time = i / sampleRate;
            const frequency = 400 + (time * 400); // 400Hz to 800Hz
            data[i] = Math.sin(2 * Math.PI * frequency * time) * 
                     Math.exp(-time * 3) * 0.3;
        }

        return buffer;
    }

    createCallEndedSound() {
        const duration = 0.8;
        const sampleRate = this.audioContext.sampleRate;
        const length = sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);

        // Descending tone for disconnection
        for (let i = 0; i < length; i++) {
            const time = i / sampleRate;
            const frequency = 800 - (time * 400); // 800Hz to 400Hz
            data[i] = Math.sin(2 * Math.PI * frequency * time) * 
                     Math.exp(-time * 2) * 0.3;
        }

        return buffer;
    }

    createNotificationSound() {
        const duration = 0.3;
        const sampleRate = this.audioContext.sampleRate;
        const length = sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);

        // Pleasant notification chime
        for (let i = 0; i < length; i++) {
            const time = i / sampleRate;
            
            // Two harmonious tones
            const tone1 = Math.sin(2 * Math.PI * 523 * time); // C5
            const tone2 = Math.sin(2 * Math.PI * 659 * time); // E5
            
            const envelope = Math.exp(-time * 8);
            data[i] = (tone1 + tone2) * envelope * 0.2;
        }

        return buffer;
    }

    playSound(soundName, loop = false, volume = 0.7) {
        if (!this.audioContext || !this.sounds[soundName]) {
            console.warn(`Sound '${soundName}' not available`);
            return null;
        }

        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();
        
        source.buffer = this.sounds[soundName];
        source.loop = loop;
        gainNode.gain.value = volume;
        
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        source.start();
        
        return source; // Return source so it can be stopped
    }

    stopSound(source) {
        if (source) {
            try {
                source.stop();
            } catch (error) {
                console.warn('Could not stop sound:', error);
            }
        }
    }
}

// Export for use in other files
window.AudioGenerator = AudioGenerator;
