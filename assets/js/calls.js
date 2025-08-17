// === PRODUCTION WEBRTC CALL INTERFACE ===
let callInfo = null;
let audioSystem = null;
let peerConnection = null;
let localStream = null;
let remoteStream = null;
let isCallActive = false;
let isMuted = false;
let isVideoEnabled = true;
let callStartTime = null;
let callTimer = null;

const initializeCallInfo = () => {
    const storedCallInfo = localStorage.getItem('currentCall');
    
    if (storedCallInfo) {
        try {
            callInfo = JSON.parse(storedCallInfo);
            
            if (!callInfo.contact && !callInfo.callee?.name) {
                callInfo = createFallbackCallInfo();
            } else {
                if (callInfo.callee && !callInfo.contact) {
                    callInfo.contact = callInfo.callee.name;
                }
                if (callInfo.caller && !callInfo.type) {
                    callInfo.type = callInfo.callType || 'voice';
                }
                if (!callInfo.state && callInfo.direction) {
                    callInfo.state = callInfo.direction === 'outgoing' ? 'outgoing' : 'incoming';
                }
            }
        } catch (e) {
            callInfo = createFallbackCallInfo();
        }
    } else {
        callInfo = createFallbackCallInfo();
    }
    
    const callTypeText = callInfo.type === 'video' ? 'Video Call' : 'Voice Call';
    document.title = `${callTypeText} - ${callInfo.contact}`;
    
    if (window.webrtcClient && (callInfo.callId || callInfo.contactId)) {
        const callId = callInfo.callId || callInfo.contactId;
        window.webrtcClient.currentCallId = callId;
    }
    
    initializeAudioSystem();
    return callInfo;
};

const createFallbackCallInfo = () => {
    return {
        type: 'voice',
        contact: 'Unknown User',
        state: 'incoming',
        timestamp: Date.now()
    };
};

const initializeAudioSystem = () => {
    audioSystem = {
        ringtone: null,
        callConnected: null,
        callEnded: null,
        audioContext: null
    };
    
    try {
        audioSystem.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        // Silent fail for audio context
    }
};

const playRingtone = () => {
    if (!audioSystem?.audioContext) {
        return null;
    }
    
    try {
        const context = audioSystem.audioContext;
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        
        oscillator.frequency.setValueAtTime(800, context.currentTime);
        oscillator.frequency.setValueAtTime(600, context.currentTime + 0.5);
        oscillator.frequency.setValueAtTime(800, context.currentTime + 1);
        
        gainNode.gain.setValueAtTime(0.1, context.currentTime);
        gainNode.gain.setValueAtTime(0, context.currentTime + 1);
        
        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 1);
        
        return oscillator;
    } catch (error) {
        return null;
    }
};

const stopRingtone = (oscillator) => {
    if (oscillator) {
        try {
            oscillator.stop();
        } catch (e) {
            // Silent fail
        }
    }
};

class WebRTCClient {
    constructor() {
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.currentCallId = null;
        this.iceCandidates = [];
        this.isInitialized = false;
        
        this.initialize();
    }

    async initialize() {
        try {
            this.peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });

            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.handleIceCandidate(event.candidate);
                }
            };

            this.peerConnection.onconnectionstatechange = () => {
                const state = this.peerConnection.connectionState;
                this.handleConnectionStateChange(state);
            };

            this.peerConnection.ontrack = (event) => {
                this.handleRemoteTrack(event);
            };

            this.isInitialized = true;
        } catch (error) {
            this.handleError('Error initializing peer connection', error);
        }
    }

    async getLocalMedia(constraints = { audio: true, video: false }) {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            const localVideo = document.getElementById('local-video');
            if (localVideo && constraints.video) {
                localVideo.srcObject = this.localStream;
            }
            
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
            
            return this.localStream;
        } catch (error) {
            this.handleError('Error accessing media devices', error);
            this.showFallbackUI();
        }
    }

    async createOffer() {
        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            return offer;
        } catch (error) {
            this.handleError('Error creating offer', error);
        }
    }

    async handleAnswer(answer) {
        try {
            await this.peerConnection.setRemoteDescription(answer);
        } catch (error) {
            this.handleError('Error handling answer', error);
        }
    }

    handleIceCandidate(candidate) {
        if (window.telegramMessaging?.socket?.connected) {
            window.telegramMessaging.socket.emit('ice_candidate', {
                callId: this.currentCallId,
                candidate: candidate
            });
        } else {
            this.iceCandidates.push(candidate);
        }
    }

    handleConnectionStateChange(state) {
        if (state === 'connected') {
            this.onCallConnected();
        } else if (state === 'disconnected' || state === 'failed') {
            this.onCallDisconnected();
        }
    }

    handleRemoteTrack(event) {
        this.remoteStream = event.streams[0];
        const remoteVideo = document.getElementById('remote-video');
        if (remoteVideo) {
            remoteVideo.srcObject = this.remoteStream;
        }
    }

    onCallConnected() {
        isCallActive = true;
        this.startCallTimer();
        
        if (window.updateCallState) {
            window.updateCallState('active');
        }
    }

    onCallDisconnected() {
        this.endCall();
    }

    startCallTimer() {
        const timerElement = document.getElementById('call-timer');
        if (!timerElement) return;

        callStartTime = Date.now();
        timerElement.classList.remove('hidden');
        
        callTimer = setInterval(() => {
            const elapsed = Date.now() - callStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            timerElement.textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    toggleMute() {
        if (!this.localStream) return;
        
        const audioTracks = this.localStream.getAudioTracks();
        if (audioTracks.length > 0) {
            audioTracks[0].enabled = !audioTracks[0].enabled;
            isMuted = !isMuted;
            
            const muteBtns = [document.getElementById('mute-btn'), document.getElementById('video-mute-btn')];
            muteBtns.forEach(btn => {
                if (btn) {
                    btn.classList.toggle('bg-red-600', isMuted);
                    btn.classList.toggle('bg-gray-700', !isMuted);
                }
            });
        }
    }

    toggleCamera() {
        if (!this.localStream) return;
        
        const videoTracks = this.localStream.getVideoTracks();
        if (videoTracks.length > 0) {
            videoTracks[0].enabled = !videoTracks[0].enabled;
            isVideoEnabled = !isVideoEnabled;
            
            const cameraBtn = document.getElementById('camera-toggle-btn');
            if (cameraBtn) {
                cameraBtn.classList.toggle('bg-red-600', !isVideoEnabled);
                cameraBtn.classList.toggle('bg-gray-700', isVideoEnabled);
            }
        }
    }

    async toggleScreenShare() {
        try {
            if (this.isScreenSharing) {
                const constraints = { audio: true, video: callInfo?.type === 'video' };
                this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
                this.isScreenSharing = false;
            } else {
                this.localStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
                this.isScreenSharing = true;
            }
            
            const localVideo = document.getElementById('local-video');
            if (localVideo) {
                localVideo.srcObject = this.localStream;
            }
            
            const sender = this.peerConnection.getSenders().find(s => 
                s.track && s.track.kind === 'video'
            );
            if (sender) {
                await sender.replaceTrack(this.localStream.getVideoTracks()[0]);
            }
        } catch (error) {
            this.handleError('Error toggling screen share', error);
        }
    }

    endCall() {
        isCallActive = false;
        
        if (callTimer) {
            clearInterval(callTimer);
            callTimer = null;
        }
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        if (window.telegramMessaging?.socket?.connected && this.currentCallId) {
            window.telegramMessaging.socket.emit('end_call', {
                callId: this.currentCallId,
                reason: 'user'
            });
        }
        
        localStorage.removeItem('currentCall');
        localStorage.removeItem('activeCallId');
        
        this.playCallEndSound();
        
        setTimeout(() => {
            window.location.href = 'home.html';
        }, 1000);
    }

    playCallEndSound() {
        try {
            if (window.audioGenerator) {
                const endSound = window.audioGenerator.createCallEndedSound();
                window.audioGenerator.playSound(endSound);
            }
        } catch (error) {
            // Silent fail
        }
    }

    showFallbackUI() {
        const mediaSection = document.querySelector('.media-section');
        if (mediaSection) {
            mediaSection.innerHTML = `
                <div class="text-center py-8">
                    <div class="w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span class="text-white text-4xl font-bold">${callInfo.contact.charAt(0).toUpperCase()}</span>
                    </div>
                    <h3 class="text-xl font-bold text-white mb-2">${callInfo.contact}</h3>
                    <p class="text-gray-400">Không thể truy cập camera/microphone</p>
                </div>
            `;
        }
    }

    handleError(message, error) {
        if (window.productionLogger) {
            window.productionLogger.error(message, { error: error });
        }
    }

    cleanup() {
        this.endCall();
    }
}

// === CALL UI COMPONENTS ===
const createVoiceCallUI = (contact) => {
    return React.createElement('div', { className: 'voice-call-container h-full flex flex-col' }, [
        React.createElement('div', { key: 'header', className: 'call-header p-6 text-center' }, [
            React.createElement('div', {
                key: 'avatar',
                className: 'w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4'
            }, React.createElement('span', { className: 'text-white text-4xl font-bold' }, contact.charAt(0).toUpperCase())),
            React.createElement('h2', { key: 'name', className: 'text-2xl font-bold text-white mb-2' }, contact),
            React.createElement('p', { key: 'status', className: 'text-gray-400' }, 'Đang kết nối...')
        ]),
        React.createElement('div', { key: 'controls', className: 'call-controls flex justify-center gap-6 p-6 mt-auto' }, [
            createCallButton('mute', isMuted),
            createCallButton('speaker', false),
            createCallButton('end', false)
        ])
    ]);
};

const createVideoCallUI = (contact) => {
    return React.createElement('div', { className: 'video-call-container h-full flex flex-col' }, [
        React.createElement('div', { key: 'video-area', className: 'video-area flex-1 relative bg-gray-900' }, [
            React.createElement('video', {
                key: 'remote',
                id: 'remote-video',
                className: 'w-full h-full object-cover',
                autoPlay: true,
                playsInline: true
            }),
            React.createElement('video', {
                key: 'local',
                id: 'local-video',
                className: 'absolute top-4 right-4 w-32 h-24 object-cover rounded-lg border-2 border-white/20',
                autoPlay: true,
                playsInline: true,
                muted: true
            })
        ]),
        React.createElement('div', { key: 'controls', className: 'video-controls flex justify-center gap-6 p-6 bg-gray-800/50' }, [
            createCallButton('video-mute', isMuted),
            createCallButton('camera-toggle', !isVideoEnabled),
            createCallButton('screen-share', false),
            createCallButton('end', false)
        ])
    ]);
};

const createCallButton = (type, isActive) => {
    const buttonConfigs = {
        'mute': {
            icon: isActive ? 'mic-off' : 'mic',
            className: `p-4 rounded-full transition-colors ${isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'}`,
            onClick: () => toggleMute()
        },
        'video-mute': {
            icon: isActive ? 'mic-off' : 'mic',
            className: `p-4 rounded-full transition-colors ${isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'}`,
            onClick: () => toggleMute()
        },
        'camera-toggle': {
            icon: isActive ? 'video-off' : 'video',
            className: `p-4 rounded-full transition-colors ${isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'}`,
            onClick: () => toggleCamera()
        },
        'screen-share': {
            icon: 'monitor',
            className: 'p-4 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors',
            onClick: () => toggleScreenShare()
        },
        'speaker': {
            icon: 'volume-2',
            className: 'p-4 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors',
            onClick: () => {}
        },
        'end': {
            icon: 'phone',
            className: 'p-4 bg-red-600 hover:bg-red-700 rounded-full transition-colors transform rotate-135',
            onClick: () => endCall()
        }
    };

    const config = buttonConfigs[type];
    return React.createElement('button', {
        key: type,
        id: `${type}-btn`,
        className: config.className,
        onClick: config.onClick
    }, createIcon(config.icon));
};

const createIcon = (iconType) => {
    const icons = {
        'mic': React.createElement('svg', {
            xmlns: 'http://www.w3.org/2000/svg',
            width: '32',
            height: '32',
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: '2',
            strokeLinecap: 'round',
            strokeLinejoin: 'round'
        }, [
            React.createElement('path', { key: 'path1', d: 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z' }),
            React.createElement('path', { key: 'path2', d: 'M19 10v2a7 7 0 0 1-14 0v-2' }),
            React.createElement('line', { key: 'line1', x1: '12', y1: '19', x2: '12', y2: '23' }),
            React.createElement('line', { key: 'line2', x1: '8', y1: '23', x2: '16', y2: '23' })
        ]),
        'mic-off': React.createElement('svg', {
            xmlns: 'http://www.w3.org/2000/svg',
            width: '32',
            height: '32',
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: '2',
            strokeLinecap: 'round',
            strokeLinejoin: 'round'
        }, [
            React.createElement('path', { key: 'path1', d: 'M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6' }),
            React.createElement('path', { key: 'path2', d: 'M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23' }),
            React.createElement('line', { key: 'line1', x1: '12', y1: '19', x2: '12', y2: '23' }),
            React.createElement('line', { key: 'line2', x1: '8', y1: '23', x2: '16', y2: '23' }),
            React.createElement('line', { key: 'line3', x1: '1', y1: '1', x2: '23', y2: '23' })
        ]),
        'video': React.createElement('svg', {
            xmlns: 'http://www.w3.org/2000/svg',
            width: '32',
            height: '32',
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: '2',
            strokeLinecap: 'round',
            strokeLinejoin: 'round'
        }, [
            React.createElement('polygon', { key: 'polygon', points: '23 7 16 12 23 17 23 7' }),
            React.createElement('rect', { key: 'rect', x: '1', y: '5', width: '15', height: '14', rx: '2', ry: '2' })
        ]),
        'video-off': React.createElement('svg', {
            xmlns: 'http://www.w3.org/2000/svg',
            width: '32',
            height: '32',
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: '2',
            strokeLinecap: 'round',
            strokeLinejoin: 'round'
        }, [
            React.createElement('path', { key: 'path1', d: 'M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10' }),
            React.createElement('line', { key: 'line', x1: '1', y1: '1', x2: '23', y2: '23' })
        ]),
        'phone': React.createElement('svg', {
            xmlns: 'http://www.w3.org/2000/svg',
            width: '32',
            height: '32',
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: '2',
            strokeLinecap: 'round',
            strokeLinejoin: 'round'
        }, React.createElement('path', { d: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z' })),
        'monitor': React.createElement('svg', {
            xmlns: 'http://www.w3.org/2000/svg',
            width: '32',
            height: '32',
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: '2',
            strokeLinecap: 'round',
            strokeLinejoin: 'round'
        }, [
            React.createElement('rect', { key: 'rect1', x: '2', y: '3', width: '20', height: '14', rx: '2', ry: '2' }),
            React.createElement('line', { key: 'line1', x1: '8', y1: '21', x2: '16', y2: '21' }),
            React.createElement('line', { key: 'line2', x1: '12', y1: '17', x2: '12', y2: '21' })
        ]),
        'volume-2': React.createElement('svg', {
            xmlns: 'http://www.w3.org/2000/svg',
            width: '32',
            height: '32',
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: '2',
            strokeLinecap: 'round',
            strokeLinejoin: 'round'
        }, [
            React.createElement('polygon', { key: 'polygon', points: '11 5 6 9 2 9 2 15 6 15 11 19 11 5' }),
            React.createElement('path', { key: 'path1', d: 'M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07' })
        ])
    };

    return icons[iconType] || React.createElement('div');
};

// === CALL STATE MANAGEMENT ===
const updateCallState = (state) => {
    const stateElement = document.getElementById('call-state');
    const timerElement = document.getElementById('call-timer');
    
    const stateTexts = {
        'requesting': 'Đang gọi...',
        'ringing': 'Đang đổ chuông...',
        'incoming': 'Cuộc gọi đến',
        'active': 'Đang trong cuộc gọi',
        'ended': 'Cuộc gọi đã kết thúc'
    };
    
    if (stateElement) {
        stateElement.textContent = stateTexts[state] || 'Không xác định';
    }
    
    if (state === 'active') {
        if (timerElement) {
            timerElement.classList.remove('hidden');
        }
        if (window.webrtcClient) {
            window.webrtcClient.startCallTimer();
        }
    }
};

// === CONTROL FUNCTIONS ===
const toggleMute = () => {
    if (window.webrtcClient) {
        window.webrtcClient.toggleMute();
    }
};

const toggleCamera = () => {
    if (window.webrtcClient) {
        window.webrtcClient.toggleCamera();
    }
};

const toggleScreenShare = () => {
    if (window.webrtcClient) {
        window.webrtcClient.toggleScreenShare();
    }
};

const endCall = () => {
    if (window.webrtcClient) {
        window.webrtcClient.endCall();
    } else {
        window.location.href = 'home.html';
    }
};

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
    try {
        const initCallInfo = initializeCallInfo();
        
        if (initCallInfo) {
            const callContainer = document.getElementById('call-container');
            
            if (callContainer) {
                let callUI;
                if (initCallInfo.type === 'video') {
                    callUI = createVideoCallUI(initCallInfo.contact);
                } else {
                    callUI = createVoiceCallUI(initCallInfo.contact);
                }
                
                ReactDOM.render(callUI, callContainer);
            }
            
            updateCallState(initCallInfo.state || 'incoming');
        }
        
        window.webrtcClient = new WebRTCClient();
        
        const constraints = {
            audio: true,
            video: callInfo?.type === 'video'
        };
        
        window.webrtcClient.getLocalMedia(constraints);
        
    } catch (error) {
        // Silent fail and redirect
        setTimeout(() => {
            window.location.href = 'home.html';
        }, 2000);
    }
});

// === GLOBAL FUNCTIONS ===
window.updateCallState = updateCallState;
window.toggleMute = toggleMute;
window.toggleCamera = toggleCamera;
window.toggleScreenShare = toggleScreenShare;
window.endCall = endCall;
