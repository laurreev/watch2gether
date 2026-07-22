import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
  ]
};

export type Resolution = '720p' | '1080p' | '1440p' | '4k' | 'max';

const resolutionSettings: Record<Resolution, any> = {
  '720p': { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 144 } },
  '1080p': { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 144 } },
  '1440p': { width: { ideal: 2560 }, height: { ideal: 1440 }, frameRate: { ideal: 144 } },
  '4k': { width: { ideal: 3840 }, height: { ideal: 2160 }, frameRate: { ideal: 144 } },
  'max': { width: { ideal: 2560 }, height: { ideal: 1440 }, frameRate: { ideal: 144 } },
};

export const useWebRTC = (roomId: string | null, isOwner: boolean = false, roomConfig?: { isPublic: boolean, password?: string }, onHostLeft?: () => void) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const usersInRoomRef = useRef<Set<string>>(new Set());
  const [userCount, setUserCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;

    // Connect to signaling server
    const socketUrl = import.meta.env.PROD ? window.location.origin : 'http://localhost:3000';
    socketRef.current = io(socketUrl);
    setSocket(socketRef.current);

    socketRef.current.on('connect', () => {
      console.log('Connected to signaling server');
      socketRef.current?.emit('join-room', { 
        roomId, 
        isOwner, 
        isPublic: roomConfig?.isPublic ?? true,
        password: roomConfig?.password ?? ''
      });
    });

    socketRef.current.on('room-users', (users: string[]) => {
      users.forEach(userId => usersInRoomRef.current.add(userId));
      setUserCount(usersInRoomRef.current.size);
      
      // If we are already sharing, initiate connections to everyone in the room
      if (isOwner && localStreamRef.current) {
        users.forEach(userId => {
          createPeerConnection(userId, localStreamRef.current, true);
        });
      }
    });

    socketRef.current.on('user-joined', (userId: string) => {
      console.log('User joined:', userId);
      usersInRoomRef.current.add(userId);
      setUserCount(usersInRoomRef.current.size);
      // Initiate connection to the new user immediately if we are the owner,
      // provided we are sharing a stream
      if (isOwner && localStreamRef.current) {
         createPeerConnection(userId, localStreamRef.current, true);
      }
    });

    socketRef.current.on('offer', async (data: { from: string, offer: RTCSessionDescriptionInit }) => {
      const pc = createPeerConnection(data.from, localStreamRef.current, false);
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      const modifiedSdp = removeBandwidthRestriction(pc.localDescription!.sdp);
      socketRef.current?.emit('answer', { to: data.from, answer: { type: answer.type, sdp: modifiedSdp } });
    });

    socketRef.current.on('answer', async (data: { from: string, answer: RTCSessionDescriptionInit }) => {
      const pc = peersRef.current.get(data.from);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });

    socketRef.current.on('ice-candidate', async (data: { from: string, candidate: RTCIceCandidateInit }) => {
      const pc = peersRef.current.get(data.from);
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });

    socketRef.current.on('host-disconnected', () => {
      if (onHostLeft) {
        onHostLeft();
      }
    });

    socketRef.current.on('stop-sharing', () => {
      setRemoteStreams(new Map());
    });

    socketRef.current.on('user-disconnected', (userId: string) => {
      usersInRoomRef.current.delete(userId);
      setUserCount(usersInRoomRef.current.size);
      if (peersRef.current.has(userId)) {
        peersRef.current.get(userId)?.close();
        peersRef.current.delete(userId);
      }
      setRemoteStreams(prev => {
        const next = new Map(prev);
        next.delete(userId);
        return next;
      });
    });

    return () => {
      socketRef.current?.disconnect();
      peersRef.current.forEach(pc => pc.close());
      peersRef.current.clear();
    };
  }, [roomId, isOwner]);

  const createPeerConnection = (userId: string, stream: MediaStream | null, isInitiator: boolean) => {
    if (peersRef.current.has(userId)) {
        return peersRef.current.get(userId)!;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peersRef.current.set(userId, pc);

    if (stream) {
      stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('ice-candidate', { to: userId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStreams(prev => {
        const next = new Map(prev);
        next.set(userId, event.streams[0]);
        return next;
      });
    };
    
    // Ensure degradation preference is high quality
    pc.addEventListener('connectionstatechange', () => {
        if (pc.connectionState === 'connected') {
             pc.getSenders().forEach(sender => {
                 if (sender.track?.kind === 'video') {
                     const params = sender.getParameters();
                     // Prioritize pixel-perfect resolution per user request
                     params.degradationPreference = 'maintain-resolution';
                     sender.setParameters(params).catch(e => console.warn('Cannot set degradation params', e));
                 }
             });
        }
    });

    if (isInitiator) {
      pc.createOffer().then(offer => {
        return pc.setLocalDescription(offer);
      }).then(() => {
        const modifiedSdp = removeBandwidthRestriction(pc.localDescription!.sdp);
        socketRef.current?.emit('offer', { to: userId, offer: { type: 'offer', sdp: modifiedSdp } });
      }).catch(e => console.error("Error creating offer", e));
    }

    return pc;
  };

  const removeBandwidthRestriction = (sdp: string) => {
    let modifier = sdp;
    if (modifier.indexOf('b=AS:') === -1) {
      // Insert before video m-line or modify existing
      modifier = modifier.replace(/m=video (.*)\r\n/g, 'm=video $1\r\nb=AS:100000\r\n');
    } else {
      modifier = modifier.replace(/b=AS:.*\r\n/g, 'b=AS:100000\r\n');
    }
    return modifier;
  };

  const startScreenShare = async (resolution: Resolution = 'max', showCursor: boolean = true) => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          ...resolutionSettings[resolution],
          cursor: showCursor ? 'always' : 'never'
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      });
      
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
         videoTrack.contentHint = 'motion'; // Prioritize framerate for videos
      }

      videoTrack.onended = () => {
        stopScreenShare();
      };

      setLocalStream(stream);
      localStreamRef.current = stream;

      // Renegotiate with existing peers, and initiate new ones
      usersInRoomRef.current.forEach(userId => {
          if (!peersRef.current.has(userId)) {
               createPeerConnection(userId, stream, true);
          } else {
              const pc = peersRef.current.get(userId)!;
              stream.getTracks().forEach(track => {
                  const senders = pc.getSenders();
                  const isAlreadyAdded = senders.some(sender => sender.track === track);
                  if (!isAlreadyAdded) {
                      pc.addTrack(track, stream);
                  }
              });
              pc.createOffer().then(offer => {
                  return pc.setLocalDescription(offer);
              }).then(() => {
                  const modifiedSdp = removeBandwidthRestriction(pc.localDescription!.sdp);
                  socketRef.current?.emit('offer', { to: userId, offer: { type: 'offer', sdp: modifiedSdp } });
              });
          }
      });

    } catch (err) {
      console.error('Error sharing screen:', err);
      setError('Could not start screen share. Please check permissions or browser support.');
    }
  };

  const stopScreenShare = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      setLocalStream(null);
      localStreamRef.current = null;
      // Remove tracks from all peers
      peersRef.current.forEach(pc => {
         const senders = pc.getSenders();
         senders.forEach(sender => pc.removeTrack(sender));
      });
      socketRef.current?.emit('stop-sharing', roomId);
    }
  };

  return { localStream, remoteStreams, startScreenShare, stopScreenShare, error, userCount, socket };
};
