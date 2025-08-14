// === Real WebRTC Client Manager ===
class WebRTCClient {
    constructor() {
        this.socket = null;
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.currentCallId = null;
        this.isInitiator = false;
        
        // WebRTC Configuration
        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ]
        };
        
        this.initializeSocket();
    }

    // Initialize Socket.IO connection
    initializeSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        
        this.socket = io(`${window.location.protocol}//${host}`, {
            transports: ['websocket', 'polling']
        });

        this.socket.on('connect', () => {
            console.log('🔌 Connected to signaling server');
            this.authenticateUser();
        });

        this.socket.on('disconnect', () => {
            console.log('🔌 Disconnected from signaling server');
        });

        // WebRTC signaling events
        this.setupSignalingListeners();
    }

    // Authenticate user with server
    authenticateUser() {
        const token = localStorage.getItem('token');
        if (token) {
            this.socket.emit('authenticate', { token });
        }
    }

    // Setup signaling event listeners
    setupSignalingListeners() {
        // Authentication
        this.socket.on('authenticated', (data) => {
            console.log('✅ Authenticated:', data);
        });

        this.socket.on('authentication_failed', (data) => {
            console.error('❌ Authentication failed:', data);
        });

        // Incoming call
        this.socket.on('incoming_call', (data) => {
            console.log('📞 Incoming call:', data);
            this.handleIncomingCall(data);
        });

        // Call events
        this.socket.on('call_accepted', (data) => {
            console.log('✅ Call accepted:', data);
            this.handleCallAccepted(data);
        });

        this.socket.on('call_declined', (data) => {
            console.log('❌ Call declined:', data);
            this.handleCallDeclined(data);
        });

        this.socket.on('call_ended', (data) => {
            console.log('📞 Call ended:', data);
            this.handleCallEnded(data);
        });

        // WebRTC signaling
        this.socket.on('webrtc_offer', (data) => {
            console.log('📨 Received WebRTC offer');
            this.handleOffer(data);
        });

        this.socket.on('webrtc_answer', (data) => {
            console.log('📨 Received WebRTC answer');
            this.handleAnswer(data);
        });

        this.socket.on('webrtc_ice_candidate', (data) => {
            console.log('🧊 Received ICE candidate');
            this.handleIceCandidate(data);
        });

        // Error handling
        this.socket.on('call_error', (data) => {
            console.error('📞 Call error:', data);
            this.handleCallError(data);
        });
    }

    // Initiate a call
    async initiateCall(targetUserId, callType = 'video') {
        try {
            console.log(`📞 Initiating ${callType} call to user:`, targetUserId);
            
            // Get user media first
            await this.getUserMedia(callType);
            
            // Initialize peer connection
            this.initializePeerConnection();
            
            // Send call initiation to server
            this.socket.emit('initiate_call', {
                targetUserId,
                callType
            });
            
            this.isInitiator = true;
            
        } catch (error) {
            console.error('Error initiating call:', error);
            throw error;
        }
    }

    // Handle incoming call
    async handleIncomingCall(data) {
        const { callId, callerId, callerUsername, callType } = data;
        this.currentCallId = callId;
        
        // Store call info for the call page
        const callInfo = {
            callId,
            callerId,
            contact: callerUsername,
            type: callType,
            state: 'incoming'
        };
        
        localStorage.setItem('currentCall', JSON.stringify(callInfo));
        
        // Open call window if not already on call page
        if (!window.location.pathname.includes('calls.html')) {
            const callWindow = window.open(
                '../pages/calls.html', 
                'call_window', 
                'width=800,height=600,resizable=yes,scrollbars=no,status=no,menubar=no,toolbar=no'
            );
            
            // Focus the call window
            if (callWindow) {
                callWindow.focus();
            }
        } else {
            // Already on call page, update UI
            if (window.updateCallState) {
                window.updateCallState('incoming');
            }
        }
    }

    // Answer incoming call
    async answerCall(accept = true) {
        if (!this.currentCallId) {
            throw new Error('No active call to answer');
        }

        try {
            if (accept) {
                // Get user media
                await this.getUserMedia();
                
                // Initialize peer connection
                this.initializePeerConnection();
                
                // Send accept to server
                this.socket.emit('answer_call', {
                    callId: this.currentCallId,
                    answer: 'accept'
                });
                
            } else {
                // Decline call
                this.socket.emit('answer_call', {
                    callId: this.currentCallId,
                    answer: 'decline'
                });
                
                this.cleanup();
            }
        } catch (error) {
            console.error('Error answering call:', error);
            throw error;
        }
    }

    // Handle call accepted
    async handleCallAccepted(data) {
        try {
            // Create and send offer if we're the initiator
            if (this.isInitiator && this.peerConnection) {
                const offer = await this.peerConnection.createOffer();
                await this.peerConnection.setLocalDescription(offer);
                
                this.socket.emit('webrtc_offer', {
                    callId: this.currentCallId,
                    offer: offer
                });
            }
        } catch (error) {
            console.error('Error handling call accepted:', error);
        }
    }

    // Get user media (camera/microphone)
    async getUserMedia(callType = 'video') {
        try {
            const constraints = {
                audio: true,
                video: callType === 'video' ? {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                } : false
            };

            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Notify UI that local stream is ready
            if (window.onLocalStreamReady) {
                window.onLocalStreamReady(this.localStream);
            }
            
            return this.localStream;
            
        } catch (error) {
            console.error('Error accessing media devices:', error);
            throw error;
        }
    }

    // Initialize peer connection
    initializePeerConnection() {
        this.peerConnection = new RTCPeerConnection(this.rtcConfig);

        // Add local stream tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
        }

        // Handle remote stream
        this.peerConnection.ontrack = (event) => {
            console.log('📨 Received remote stream');
            this.remoteStream = event.streams[0];
            
            if (window.onRemoteStreamReady) {
                window.onRemoteStreamReady(this.remoteStream);
            }
        };

        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.socket) {
                this.socket.emit('webrtc_ice_candidate', {
                    callId: this.currentCallId,
                    candidate: event.candidate
                });
            }
        };

        // Connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            console.log('🔗 Connection state:', this.peerConnection.connectionState);
            
            if (this.peerConnection.connectionState === 'connected') {
                console.log('✅ WebRTC connection established');
                if (window.onCallConnected) {
                    window.onCallConnected();
                }
            } else if (this.peerConnection.connectionState === 'disconnected' || 
                       this.peerConnection.connectionState === 'failed') {
                console.log('❌ WebRTC connection lost');
                this.endCall();
            }
        };
    }

    // Handle WebRTC offer
    async handleOffer(data) {
        const { offer } = data;
        
        try {
            if (!this.peerConnection) {
                this.initializePeerConnection();
            }

            await this.peerConnection.setRemoteDescription(offer);
            
            // Create and send answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            this.socket.emit('webrtc_answer', {
                callId: this.currentCallId,
                answer: answer
            });
            
        } catch (error) {
            console.error('Error handling offer:', error);
        }
    }

    // Handle WebRTC answer
    async handleAnswer(data) {
        const { answer } = data;
        
        try {
            await this.peerConnection.setRemoteDescription(answer);
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    }

    // Handle ICE candidate
    async handleIceCandidate(data) {
        const { candidate } = data;
        
        try {
            if (this.peerConnection) {
                await this.peerConnection.addIceCandidate(candidate);
            }
        } catch (error) {
            console.error('Error handling ICE candidate:', error);
        }
    }

    // Toggle mute/unmute
    toggleMute() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                return !audioTrack.enabled; // Return muted state
            }
        }
        return false;
    }

    // Toggle camera on/off
    toggleCamera() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                return !videoTrack.enabled; // Return camera off state
            }
        }
        return false;
    }

    // Toggle screen share
    async toggleScreenShare() {
        try {
            if (!this.peerConnection) return false;

            const videoTrack = this.localStream.getVideoTracks()[0];
            const sender = this.peerConnection.getSenders().find(s => 
                s.track && s.track.kind === 'video'
            );

            if (!sender) return false;

            // Check if currently screen sharing
            if (videoTrack.label.includes('screen')) {
                // Switch back to camera
                const cameraStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user' },
                    audio: true
                });
                
                const newVideoTrack = cameraStream.getVideoTracks()[0];
                await sender.replaceTrack(newVideoTrack);
                
                // Update local stream
                this.localStream.removeTrack(videoTrack);
                this.localStream.addTrack(newVideoTrack);
                
                videoTrack.stop();
                return false; // Not screen sharing anymore
                
            } else {
                // Switch to screen share
                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: true
                });
                
                const screenTrack = screenStream.getVideoTracks()[0];
                await sender.replaceTrack(screenTrack);
                
                // Update local stream
                this.localStream.removeTrack(videoTrack);
                this.localStream.addTrack(screenTrack);
                
                // Handle screen share end
                screenTrack.onended = () => {
                    this.toggleScreenShare();
                };
                
                videoTrack.stop();
                return true; // Screen sharing
            }
            
        } catch (error) {
            console.error('Error toggling screen share:', error);
            return false;
        }
    }

    // End call
    endCall() {
        console.log('📞 Ending call');
        
        // Notify server
        if (this.socket && this.currentCallId) {
            this.socket.emit('end_call', {
                callId: this.currentCallId
            });
        }
        
        this.cleanup();
    }

    // Handle call ended (from other user or server)
    handleCallEnded(data) {
        console.log('📞 Call ended by other party');
        this.cleanup();
        
        if (window.onCallEnded) {
            window.onCallEnded();
        }
    }

    // Handle call declined
    handleCallDeclined(data) {
        console.log('❌ Call was declined');
        this.cleanup();
        
        if (window.onCallDeclined) {
            window.onCallDeclined();
        }
    }

    // Handle call errors
    handleCallError(data) {
        console.error('📞 Call error:', data);
        
        if (window.onCallError) {
            window.onCallError(data);
        }
        
        this.cleanup();
    }

    // Cleanup resources
    cleanup() {
        console.log('🧹 Cleaning up WebRTC resources');
        
        // Stop local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        // Close peer connection
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        // Clear call data
        this.currentCallId = null;
        this.isInitiator = false;
        this.remoteStream = null;
        
        // Clear localStorage
        localStorage.removeItem('currentCall');
    }

    // Get current call status
    getCallStatus() {
        return {
            isInCall: !!this.currentCallId,
            hasLocalStream: !!this.localStream,
            hasRemoteStream: !!this.remoteStream,
            connectionState: this.peerConnection?.connectionState || 'disconnected'
        };
    }
}

// Create global instance
window.webrtcClient = new WebRTCClient();

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebRTCClient;
}
