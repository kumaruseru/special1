// === Real WebRTC Call Interface ===
let callInfo = null;
let audioSystem = null;

// Initialize call info from localStorage
const initializeCallInfo = () => {
    console.log('🔍 [TELEGRAM] Checking localStorage for currentCall...');
    const storedCallInfo = localStorage.getItem('currentCall');
    console.log('🔍 Raw localStorage data:', storedCallInfo);
    
    if (storedCallInfo) {
        try {
            callInfo = JSON.parse(storedCallInfo);
            console.log('📞 [TELEGRAM] Successfully loaded call session:', callInfo);
            
            // Validate Telegram-style call session
            if (!callInfo.contact && !callInfo.callee?.name) {
                console.warn('⚠️ Invalid call session, using fallback');
                callInfo = createFallbackCallInfo();
            } else {
                // Normalize call info for backward compatibility
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
            console.error('❌ Failed to parse call session:', e);
            callInfo = createFallbackCallInfo();
        }
    } else {
        console.warn('⚠️ No stored call session found, using fallback');
        callInfo = createFallbackCallInfo();
    }
    
    // Set page title based on call info
    const callTypeText = callInfo.type === 'video' ? 'Video Call' : 'Voice Call';
    const callStateText = callInfo.state === 'outgoing' ? 'Cuộc gọi đi' : 'Cuộc gọi đến';
    document.title = `${callTypeText} - ${callInfo.contact}`;
    
    console.log('📞 [TELEGRAM] Final call session:', callInfo);
    console.log('📞 Page title set to:', document.title);
    console.log('📞 Call state should be:', callInfo.state);
    console.log('📞 Call ID available:', callInfo.callId || callInfo.contactId);
    
    // Set WebRTC currentCallId if available
    if (window.webrtcClient && (callInfo.callId || callInfo.contactId)) {
        const callId = callInfo.callId || callInfo.contactId;
        window.webrtcClient.currentCallId = callId;
        console.log('📞 [TELEGRAM] Set WebRTC currentCallId on init:', callId);
    }
    
    // Initialize audio system
    initializeAudioSystem();
    
    // Return the call info so it can be used immediately
    return callInfo;
};

// Create fallback call info
const createFallbackCallInfo = () => {
    return {
        type: 'voice',
        contact: 'Unknown User',
        state: 'incoming',
        timestamp: Date.now()
    };
};

// Audio system for call notifications
const initializeAudioSystem = () => {
    audioSystem = {
        ringtone: new Audio(),
        callConnected: new Audio(),
        callEnded: new Audio()
    };
    
    // Set volumes
    audioSystem.ringtone.volume = 0.7;
    audioSystem.callConnected.volume = 0.5;
    audioSystem.callEnded.volume = 0.5;
    
    // Simple beep sounds using data URLs
    audioSystem.ringtone.src = 'data:audio/wav;base64,UklGRsABAABXQVZFZm10IAAAAAABAAABBACJAQABBQAAAAVAEAAAE=';
    audioSystem.callConnected.src = 'data:audio/wav;base64,UklGRvIBAABXQVZFZm10IAAAAAABAAABBACJAQABBQAAAAVAEAAAE=';
    audioSystem.callEnded.src = 'data:audio/wav;base64,UklGRsACAABXQVZFZm10IAAAAAABAAABBACJAQABBQAAAAVAEAAAE=';
    
    // Enable looping for ringtone
    audioSystem.ringtone.loop = true;
};

// Global callbacks for WebRTC client
window.onLocalStreamReady = (stream) => {
    console.log('📹 Local stream ready');
    const localVideo = document.getElementById('localVideo');
    if (localVideo) {
        localVideo.srcObject = stream;
    }
};

window.onRemoteStreamReady = (stream) => {
    console.log('📹 Remote stream ready');
    const remoteVideo = document.getElementById('remoteVideo');
    if (remoteVideo) {
        remoteVideo.srcObject = stream;
    }
};

window.onCallConnected = () => {
    console.log('✅ Call connected');
    // Stop ringtone
    if (audioSystem && audioSystem.ringtone) {
        audioSystem.ringtone.pause();
        audioSystem.ringtone.currentTime = 0;
    }
    
    // Play connected sound
    if (audioSystem && audioSystem.callConnected) {
        audioSystem.callConnected.play().catch(e => console.log('Audio play failed:', e));
    }
    
    // Update UI to active state
    if (window.updateCallState) {
        window.updateCallState('active');
    }
};

window.onCallEnded = () => {
    console.log('📞 Call ended - closing window immediately');
    // Stop all audio
    if (audioSystem) {
        if (audioSystem.ringtone) {
            audioSystem.ringtone.pause();
            audioSystem.ringtone.currentTime = 0;
        }
        if (audioSystem.callEnded) {
            audioSystem.callEnded.play().catch(e => console.log('Audio play failed:', e));
        }
    }
    
    // Clean up localStorage
    localStorage.removeItem('currentCall');
    
    // Close window immediately (no delay)
    if (window.opener) {
        window.close();
    } else {
        window.location.href = '../pages/messages.html';
    }
};

window.onCallDeclined = () => {
    console.log('❌ Call declined');
    window.onCallEnded();
};

window.onCallError = (error) => {
    console.error('📞 Call error:', error);
    
    // Show more specific error messages
    let errorMessage = 'Unknown error occurred';
    if (error.error) {
        switch (error.error) {
            case 'Invalid user data - missing user IDs':
                errorMessage = 'Không thể xác định người dùng. Vui lòng đăng nhập lại.';
                break;
            case 'Cannot call yourself':
                errorMessage = 'Không thể gọi cho chính mình.';
                break;
            case 'User is offline or not found':
                errorMessage = 'Người dùng đang offline hoặc không tồn tại.';
                break;
            case 'Invalid user data':
                errorMessage = 'Dữ liệu người dùng không hợp lệ. Vui lòng thử lại.';
                break;
            default:
                errorMessage = error.error;
        }
    }
    
    alert(`Lỗi cuộc gọi: ${errorMessage}`);
    window.onCallEnded();
};

// React Components
const OutgoingCall = ({ setCallState }) => {
    React.useEffect(() => {
        // Start ringtone for outgoing call
        if (audioSystem && audioSystem.ringtone) {
            audioSystem.ringtone.play().catch(e => console.log('Ringtone play failed:', e));
        }
        
        return () => {
            // Stop ringtone when component unmounts
            if (audioSystem && audioSystem.ringtone) {
                audioSystem.ringtone.pause();
                audioSystem.ringtone.currentTime = 0;
            }
        };
    }, []);

    const handleEndCall = () => {
        console.log('🔴 End call button clicked');
        
        // Prevent multiple rapid clicks
        if (window.callEnding) {
            console.log('⚠️ Call already ending, ignoring click');
            return;
        }
        window.callEnding = true;
        
        // Try multiple methods to end the call
        let callEnded = false;
        
        // Method 1: Try webrtcClient
        if (window.webrtcClient && typeof window.webrtcClient.endCall === 'function') {
            console.log('📞 Ending call via webrtcClient');
            window.webrtcClient.endCall();
            callEnded = true;
        }
        
        // Method 2: Try direct socket emission
        if (window.telegramMessaging?.socket?.connected) {
            console.log('📞 Ending call via socket');
            window.telegramMessaging.socket.emit('end_call');
            callEnded = true;
        }
        
        // Method 3: Trigger global end call callback
        if (window.onCallEnded && typeof window.onCallEnded === 'function') {
            console.log('📞 Triggering onCallEnded callback');
            setTimeout(() => window.onCallEnded(), 100); // Small delay to let other methods execute first
            callEnded = true;
        }
        
        // Method 4: Immediate fallback - force close window
        setTimeout(() => {
            console.log('📞 Force closing window after 500ms');
            localStorage.removeItem('currentCall');
            
            if (window.opener) {
                window.close();
            } else {
                window.location.href = '../pages/messages.html';
            }
        }, 500);
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center text-white text-center p-8">
            <img 
                src={callInfo?.avatar || "https://placehold.co/128x128/8A2BE2/FFFFFF?text=C"} 
                alt={callInfo?.contact} 
                className="w-32 h-32 rounded-full border-4 border-purple-400 pulsing-avatar mb-6"
            />
            <h1 className="text-4xl font-bold">{callInfo?.contact || 'Unknown User'}</h1>
            <p className="text-xl text-gray-400 mt-2">
                {callInfo?.type === 'video' ? 'Đang gọi video...' : 'Đang gọi...'}
            </p>
            <div className="absolute bottom-16">
                <button onClick={handleEndCall} className="call-button decline-button">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/>
                    </svg>
                </button>
            </div>
        </div>
    );
};

const IncomingCall = ({ setCallState }) => {
    React.useEffect(() => {
        // Start ringtone for incoming call
        if (audioSystem && audioSystem.ringtone) {
            audioSystem.ringtone.play().catch(e => console.log('Ringtone play failed:', e));
        }
        
        return () => {
            // Stop ringtone when component unmounts
            if (audioSystem && audioSystem.ringtone) {
                audioSystem.ringtone.pause();
                audioSystem.ringtone.currentTime = 0;
            }
        };
    }, []);

    const handleAcceptCall = async () => {
        try {
            console.log('✅ Accept call button clicked');
            console.log('📞 Current call info:', callInfo);
            
            // Ensure WebRTC client has the callId
            if (window.webrtcClient && callInfo?.callId) {
                window.webrtcClient.currentCallId = callInfo.callId;
                console.log('📞 Set WebRTC currentCallId:', callInfo.callId);
                
                await window.webrtcClient.answerCall(true);
                setCallState('active');
            } else if (window.webrtcClient && callInfo?.contactId) {
                // Fallback to contactId if callId not available
                window.webrtcClient.currentCallId = callInfo.contactId;
                console.log('📞 Set WebRTC currentCallId (fallback):', callInfo.contactId);
                
                await window.webrtcClient.answerCall(true);
                setCallState('active');
            } else {
                console.error('❌ No WebRTC client or call ID available');
                alert('Không thể chấp nhận cuộc gọi. Vui lòng thử lại.');
            }
        } catch (error) {
            console.error('Error accepting call:', error);
            alert('Failed to accept call: ' + error.message);
        }
    };

    const handleDeclineCall = () => {
        console.log('🔴 Decline call button clicked');
        
        // Prevent multiple rapid clicks
        if (window.callEnding) {
            console.log('⚠️ Call already ending, ignoring click');
            return;
        }
        window.callEnding = true;
        
        // Try multiple methods to decline the call
        let callDeclined = false;
        
        // Method 1: Try webrtcClient
        if (window.webrtcClient && typeof window.webrtcClient.answerCall === 'function') {
            console.log('📞 Declining call via webrtcClient');
            window.webrtcClient.answerCall(false);
            callDeclined = true;
        }
        
        // Method 2: Try direct socket emission
        if (window.telegramMessaging?.socket?.connected) {
            console.log('📞 Declining call via socket');
            window.telegramMessaging.socket.emit('decline_call');
            callDeclined = true;
        }
        
        // Method 3: Trigger global decline call callback
        if (window.onCallDeclined && typeof window.onCallDeclined === 'function') {
            console.log('📞 Triggering onCallDeclined callback');
            setTimeout(() => window.onCallDeclined(), 100);
            callDeclined = true;
        }
        
        // Method 4: Immediate fallback - force close window
        setTimeout(() => {
            console.log('📞 Force closing window after 500ms');
            localStorage.removeItem('currentCall');
            
            if (window.opener) {
                window.close();
            } else {
                window.location.href = '../pages/messages.html';
            }
        }, 500);
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center text-white text-center p-8">
            <img 
                src={callInfo?.avatar || "https://placehold.co/128x128/8A2BE2/FFFFFF?text=C"} 
                alt={callInfo?.contact} 
                className="w-32 h-32 rounded-full border-4 border-purple-400 pulsing-avatar mb-6"
            />
            <h1 className="text-4xl font-bold">{callInfo?.contact || 'Unknown User'}</h1>
            <p className="text-xl text-gray-400 mt-2">
                {callInfo?.state === 'outgoing' 
                    ? (callInfo?.type === 'video' ? 'Đang gọi video...' : 'Đang gọi...') 
                    : (callInfo?.type === 'video' ? 'Cuộc gọi video đến...' : 'Cuộc gọi thoại đến...')
                }
            </p>
            <div className="absolute bottom-16 flex gap-8">
                <button onClick={handleDeclineCall} className="call-button decline-button">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/>
                    </svg>
                </button>
                <button onClick={handleAcceptCall} className="call-button accept-button">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                </button>
            </div>
        </div>
    );
};

const ActiveCall = ({ setCallState }) => {
    const [elapsedTime, setElapsedTime] = React.useState(0);
    const [isMuted, setIsMuted] = React.useState(false);
    const [isCameraOff, setIsCameraOff] = React.useState(false);
    const [isScreenSharing, setIsScreenSharing] = React.useState(false);
    const [isCameraFlipped, setIsCameraFlipped] = React.useState(true);
    const localVideoRef = React.useRef(null);
    const remoteVideoRef = React.useRef(null);

    React.useEffect(() => {
        // Timer for call duration
        const timer = setInterval(() => {
            setElapsedTime(prevTime => prevTime + 1);
        }, 1000);

        // Set up video elements for WebRTC streams
        const setupVideoElements = () => {
            if (localVideoRef.current) {
                localVideoRef.current.id = 'localVideo';
            }
            if (remoteVideoRef.current) {
                remoteVideoRef.current.id = 'remoteVideo';
            }
        };

        setupVideoElements();

        // Get existing streams if available
        if (window.webrtcClient) {
            const client = window.webrtcClient;
            
            if (client.localStream && localVideoRef.current) {
                localVideoRef.current.srcObject = client.localStream;
            }
            
            if (client.remoteStream && remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = client.remoteStream;
            }
        }

        return () => {
            clearInterval(timer);
        };
    }, []);

    const handleMuteToggle = () => {
        if (window.webrtcClient) {
            const newMutedState = window.webrtcClient.toggleMute();
            setIsMuted(newMutedState);
        }
    };

    const handleCameraToggle = () => {
        if (window.webrtcClient && callInfo?.type === 'video') {
            const newCameraState = window.webrtcClient.toggleCamera();
            setIsCameraOff(newCameraState);
        }
    };

    const handleScreenShareToggle = async () => {
        if (window.webrtcClient && callInfo?.type === 'video') {
            try {
                const newScreenShareState = await window.webrtcClient.toggleScreenShare();
                setIsScreenSharing(newScreenShareState);
            } catch (error) {
                console.error('Error toggling screen share:', error);
                alert('Screen sharing failed: ' + error.message);
            }
        }
    };

    const handleCameraFlipToggle = () => {
        setIsCameraFlipped(!isCameraFlipped);
    };

    const handleEndCall = () => {
        console.log('🔴 End call button clicked (ActiveCall)');
        
        // Prevent multiple rapid clicks
        if (window.callEnding) {
            console.log('⚠️ Call already ending, ignoring click');
            return;
        }
        window.callEnding = true;
        
        // Try multiple methods to end the call
        let callEnded = false;
        
        // Method 1: Try webrtcClient
        if (window.webrtcClient && typeof window.webrtcClient.endCall === 'function') {
            console.log('📞 Ending call via webrtcClient');
            window.webrtcClient.endCall();
            callEnded = true;
        }
        
        // Method 2: Try direct socket emission
        if (window.telegramMessaging?.socket?.connected) {
            console.log('📞 Ending call via socket');
            window.telegramMessaging.socket.emit('end_call');
            callEnded = true;
        }
        
        // Method 3: Trigger global end call callback
        if (window.onCallEnded && typeof window.onCallEnded === 'function') {
            console.log('📞 Triggering onCallEnded callback');
            setTimeout(() => window.onCallEnded(), 100);
            callEnded = true;
        }
        
        // Method 4: Immediate fallback - force close window
        setTimeout(() => {
            console.log('📞 Force closing window after 500ms');
            localStorage.removeItem('currentCall');
            
            if (window.opener) {
                window.close();
            } else {
                window.location.href = '../pages/messages.html';
            }
        }, 500);
    };

    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    };

    const isVideoCall = callInfo?.type === 'video';

    return (
        <div className="w-full h-full relative">
            {isVideoCall ? (
                <>
                    {/* Remote Video Feed */}
                    <video 
                        ref={remoteVideoRef}
                        className="w-full h-full object-cover remote-video bg-gray-900"
                        autoPlay
                        playsInline
                    >
                        {/* Fallback content when no remote video */}
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                            <div className="text-center text-white">
                                <div className="w-32 h-32 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg width="48" height="48" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                                    </svg>
                                </div>
                                <p className="text-lg">{callInfo?.contact}</p>
                            </div>
                        </div>
                    </video>

                    {/* Local Video Feed */}
                    <div className="absolute bottom-32 sm:bottom-8 right-4 w-1/3 max-w-[250px] aspect-video rounded-lg overflow-hidden glass-pane border-2 border-blue-400">
                        <video 
                            ref={localVideoRef}
                            className={`w-full h-full object-cover ${isCameraFlipped ? 'local-video' : 'remote-video'}`}
                            autoPlay
                            playsInline
                            muted
                        />
                        
                        {isCameraOff && (
                            <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                                <svg width="32" height="32" fill="white" viewBox="0 0 24 24">
                                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                                </svg>
                            </div>
                        )}
                        
                        {/* Camera Flip Toggle Button */}
                        <button 
                            onClick={handleCameraFlipToggle}
                            className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70 transition-all"
                            title={isCameraFlipped ? "Tắt chế độ gương" : "Bật chế độ gương"}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 12h18m-9-9l9 9-9 9"/>
                            </svg>
                        </button>
                    </div>
                </>
            ) : (
                /* Voice Call UI */
                <div className="w-full h-full flex flex-col items-center justify-center text-white">
                    <img 
                        src={callInfo?.avatar || "https://placehold.co/200x200/8A2BE2/FFFFFF?text=C"} 
                        alt={callInfo?.contact} 
                        className="w-48 h-48 rounded-full border-4 border-purple-400 mb-8"
                    />
                    <h1 className="text-4xl font-bold mb-2">{callInfo?.contact || 'Cosmic User'}</h1>
                    
                    {/* Audio Visualization */}
                    <div className="flex gap-1 mb-8">
                        {[...Array(20)].map((_, i) => (
                            <div 
                                key={i} 
                                className="w-1 bg-green-400 rounded-full voice-bar" 
                                style={{
                                    height: `${Math.random() * 20 + 4}px`,
                                    animationDelay: `${i * 0.1}s`
                                }}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Call Info Overlay */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center text-white p-3 rounded-xl glass-pane">
                <h2 className="text-xl font-bold">{callInfo?.contact || 'Cosmic User'}</h2>
                <p className="text-md text-gray-300">{formatTime(elapsedTime)}</p>
            </div>
            
            {/* Call Controls */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 p-4 rounded-full glass-pane">
                {/* Mute Button */}
                <button 
                    onClick={handleMuteToggle}
                    className={`call-button ${isMuted ? 'bg-red-600' : 'control-button'}`}
                    title={isMuted ? 'Bỏ tắt tiếng' : 'Tắt tiếng'}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {isMuted ? (
                            <>
                                <line x1="1" y1="1" x2="23" y2="23"></line>
                                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                                <line x1="12" y1="19" x2="12" y2="23"></line>
                                <line x1="8" y1="23" x2="16" y2="23"></line>
                            </>
                        ) : (
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                        )}
                    </svg>
                </button>

                {/* Camera Button (Video calls only) */}
                {isVideoCall && (
                    <button 
                        onClick={handleCameraToggle}
                        className={`call-button ${isCameraOff ? 'bg-red-600' : 'control-button'}`}
                        title={isCameraOff ? 'Bật camera' : 'Tắt camera'}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            {isCameraOff ? (
                                <>
                                    <line x1="1" y1="1" x2="23" y2="23"></line>
                                    <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34m-7.72-2.06a4 4 0 1 1-5.56-5.56"></path>
                                </>
                            ) : (
                                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                            )}
                        </svg>
                    </button>
                )}

                {/* End Call Button */}
                <button 
                    onClick={handleEndCall} 
                    className="call-button decline-button"
                    title="Kết thúc cuộc gọi"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/>
                    </svg>
                </button>

                {/* Screen Share Button (Video calls only) */}
                {isVideoCall && (
                    <button 
                        onClick={handleScreenShareToggle}
                        className={`call-button ${isScreenSharing ? 'bg-blue-600' : 'control-button'}`}
                        title={isScreenSharing ? 'Dừng chia sẻ màn hình' : 'Chia sẻ màn hình'}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 18v-6M9 15l3-3 3 3"/>
                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
};

const App = () => {
    const [callState, setCallState] = React.useState('incoming'); // Default state

    React.useEffect(() => {
        // Initialize call info when app mounts
        const loadedCallInfo = initializeCallInfo();
        
        // Set the correct call state after call info is loaded
        if (loadedCallInfo && loadedCallInfo.state) {
            console.log('🔄 Setting call state to:', loadedCallInfo.state);
            setCallState(loadedCallInfo.state);
        }
        
        // Global function to update call state
        window.updateCallState = setCallState;
    }, []);

    const renderCallScreen = () => {
        switch(callState) {
            case 'outgoing':
                return <OutgoingCall setCallState={setCallState} />;
            case 'active':
                return <ActiveCall setCallState={setCallState} />;
            case 'incoming':
            default:
                return <IncomingCall setCallState={setCallState} />;
        }
    }

    return (
        <div className="w-full h-full">
            {renderCallScreen()}
        </div>
    );
};

ReactDOM.render(<App />, document.getElementById('root'));

// --- 3D Cosmic Background Script ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.z = 300;
const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('cosmic-bg'),
    antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);

const starGeo = new THREE.BufferGeometry();
const starCount = 8000;
const posArray = new Float32Array(starCount * 3);

for (let i = 0; i < starCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 600;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

function createStarTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
}

const starMaterial = new THREE.PointsMaterial({
    size: 1,
    map: createStarTexture(),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
});
const stars = new THREE.Points(starGeo, starMaterial);
scene.add(stars);

const animate = () => {
    const positions = starGeo.attributes.position.array;
    for (let i = 0; i < starCount; i++) {
        const i3 = i * 3;
        positions[i3 + 2] += 0.5; // Move stars towards camera
        if (positions[i3 + 2] > camera.position.z) {
            positions[i3 + 2] = -300; // Reset star
        }
    }
    starGeo.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
};
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== CALLS PAGE LOADED ===');
    initializeCallInfo();
    console.log('Calls page initialization complete');
});
