import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  Alert,
  Avatar,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Skeleton,
  Textarea,
  toast,
} from '@/components/ui';
import {
  ArrowLeft,
  Clock3,
  Hand,
  MessageSquare,
  PlayCircle,
  Radio,
  Send,
  Sparkles,
  StopCircle,
  Users,
  Video,
} from 'lucide-react';
import type { ChatConversation, ChatMessage, LiveClass } from '@/types';

type WorkspaceTab = 'whiteboard' | 'chat' | 'roster';

interface LivePeer {
  socketId: string;
  userId: string;
  name: string;
  role: string;
  cameraOn?: boolean;
}

type LiveClassSignal =
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | { type: 'candidate'; candidate: RTCIceCandidateInit };

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatRelative = (value: string, nowMs: number) => {
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return '';

  const diff = target - nowMs;
  const absMinutes = Math.round(Math.abs(diff) / 60000);

  if (absMinutes < 1) return 'now';
  if (absMinutes < 60) return diff >= 0 ? `in ${absMinutes} min` : `${absMinutes} min ago`;

  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;

  if (hours < 24) {
    const hourLabel = `${hours}h${minutes ? ` ${minutes}m` : ''}`;
    return diff >= 0 ? `in ${hourLabel}` : `${hourLabel} ago`;
  }

  const days = Math.floor(hours / 24);
  return diff >= 0 ? `in ${days} day${days > 1 ? 's' : ''}` : `${days} day${days > 1 ? 's' : ''} ago`;
};

const formatClock = (value?: string) => {
  if (!value) return '';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const statusTone = (status?: LiveClass['status']) => {
  if (status === 'live') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (status === 'scheduled') return 'bg-blue-100 text-blue-800 border-blue-200';
  if (status === 'completed') return 'bg-slate-100 text-slate-700 border-slate-200';
  return 'bg-rose-100 text-rose-700 border-rose-200';
};

const getSocketBaseUrl = () => {
  const configuredApiBase = import.meta.env.VITE_API_BASE_URL;
  if (configuredApiBase) {
    try {
      const parsed = new URL(configuredApiBase);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return configuredApiBase.replace(/\/api\/?$/, '');
    }
  }

  const configuredTarget = import.meta.env.VITE_API_PROXY_TARGET;
  if (configuredTarget) {
    try {
      const parsed = new URL(configuredTarget);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return configuredTarget;
    }
  }

  return window.location.origin;
};

const LiveVideoPlayer: React.FC<{
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
}> = ({ stream, muted = false, className = '' }) => {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.srcObject = stream;
  }, [stream]);

  return <video ref={ref} autoPlay playsInline muted={muted} className={className} />;
};

export const LiveClassRoomPage: React.FC = () => {
  const { classId = '' } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';

  const [liveClass, setLiveClass] = useState<LiveClass | null>(null);
  const [loadingClass, setLoadingClass] = useState(true);
  const [nowMs, setNowMs] = useState(Date.now());

  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('whiteboard');

  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [localPreviewStream, setLocalPreviewStream] = useState<MediaStream | null>(null);

  const [startingClass, setStartingClass] = useState(false);
  const [endingClass, setEndingClass] = useState(false);
  const [joiningClass, setJoiningClass] = useState(false);

  const [classChat, setClassChat] = useState<ChatConversation | null>(null);
  const [loadingClassChat, setLoadingClassChat] = useState(false);
  const [sendingClassChat, setSendingClassChat] = useState(false);
  const [classChatMessage, setClassChatMessage] = useState('');

  const [peers, setPeers] = useState<LivePeer[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [cameraActionStudentId, setCameraActionStudentId] = useState('');
  const [spotlightActionStudentId, setSpotlightActionStudentId] = useState('');

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const classChatScrollRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  const fetchClassDetails = useCallback(async (silently = false) => {
    if (!classId) {
      setLiveClass(null);
      setLoadingClass(false);
      return;
    }

    if (!silently) setLoadingClass(true);

    try {
      const { data } = await api.get('/live-classes');
      const list = Array.isArray(data.classes) ? data.classes : [];
      const found = list.find((item: LiveClass) => item._id === classId) || null;
      setLiveClass(found);
    } catch {
      if (!silently) toast('Unable to load classroom details.', 'error');
      setLiveClass(null);
    } finally {
      if (!silently) setLoadingClass(false);
    }
  }, [classId]);

  useEffect(() => {
    fetchClassDetails();
    const intervalId = window.setInterval(() => fetchClassDetails(true), 12000);
    return () => window.clearInterval(intervalId);
  }, [fetchClassDetails]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const canAccessLiveRoom = Boolean(
    liveClass
      && liveClass.status === 'live'
      && (isTeacher || liveClass.isRegistered || liveClass.canJoin)
  );

  const canStartClass = Boolean(isTeacher && liveClass?.status === 'scheduled');
  const canEndClass = Boolean(isTeacher && liveClass?.status === 'live');
  const canJoinClass = Boolean(!isTeacher && liveClass?.status === 'live' && liveClass?.canJoin);
  const canPublishLocalCamera = Boolean(
    cameraOn
    && canAccessLiveRoom
    && (isTeacher || liveClass?.currentUserCameraApproved)
  );

  const clearPeerConnections = useCallback(() => {
    peerConnectionsRef.current.forEach((connection) => {
      connection.ontrack = null;
      connection.onicecandidate = null;
      connection.close();
    });
    peerConnectionsRef.current.clear();
    setRemoteStreams({});
  }, []);

  const syncConnectionLocalTracks = useCallback((connection: RTCPeerConnection) => {
    const senders = connection.getSenders();

    if (!canPublishLocalCamera || !localStreamRef.current) {
      senders.forEach((sender) => {
        if (!sender.track) return;
        void sender.replaceTrack(null).catch(() => {
          // Ignore sender replacement issues during reconnect.
        });
      });
      return;
    }

    const stream = localStreamRef.current;
    stream.getTracks().forEach((track) => {
      const existingSender = senders.find((sender) => sender.track?.kind === track.kind);
      if (existingSender) {
        void existingSender.replaceTrack(track).catch(() => {
          // Ignore sender replacement issues during reconnect.
        });
        return;
      }

      connection.addTrack(track, stream);
    });
  }, [canPublishLocalCamera]);

  const createPeerConnection = useCallback((targetSocketId: string) => {
    let connection = peerConnectionsRef.current.get(targetSocketId);
    if (connection) return connection;

    connection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    connection.onicecandidate = (event) => {
      if (!event.candidate || !socketRef.current || !classId) return;

      socketRef.current.emit('live-class:webrtc-signal', {
        classId,
        targetSocketId,
        signal: {
          type: 'candidate',
          candidate: event.candidate.toJSON(),
        } satisfies LiveClassSignal,
      });
    };

    connection.ontrack = (event) => {
      const stream = event.streams[0];
      if (!stream) return;
      setRemoteStreams((prev) => ({ ...prev, [targetSocketId]: stream }));
    };

    connection.onconnectionstatechange = () => {
      const state = connection?.connectionState;
      if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[targetSocketId];
          return next;
        });
      }
    };

    peerConnectionsRef.current.set(targetSocketId, connection);
    syncConnectionLocalTracks(connection);

    return connection;
  }, [classId, syncConnectionLocalTracks]);

  const sendOffer = useCallback(async (peer: LivePeer) => {
    const socket = socketRef.current;
    if (!socket || !socket.id || !classId) return;
    if (socket.id >= peer.socketId) return;

    const connection = createPeerConnection(peer.socketId);
    syncConnectionLocalTracks(connection);
    if (connection.signalingState !== 'stable') return;

    try {
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);

      socket.emit('live-class:webrtc-signal', {
        classId,
        targetSocketId: peer.socketId,
        signal: {
          type: 'offer',
          sdp: offer.sdp || '',
        } satisfies LiveClassSignal,
      });
    } catch {
      // Ignore transient offer errors while peers reconnect.
    }
  }, [classId, createPeerConnection, syncConnectionLocalTracks]);

  const syncParticipants = useCallback((incoming: LivePeer[]) => {
    const currentSocketId = socketRef.current?.id;
    const normalized = Array.isArray(incoming)
      ? incoming
          .filter((peer) => peer?.socketId && peer.socketId !== currentSocketId)
          .map((peer) => ({
            ...peer,
            cameraOn: Boolean(peer.cameraOn),
          }))
      : [];

    setPeers(normalized);

    normalized.forEach((peer) => {
      void sendOffer(peer);
    });
  }, [sendOffer]);

  const handleSignal = useCallback(async (payload: {
    fromSocketId?: string;
    fromUserId?: string;
    signal?: LiveClassSignal;
  }) => {
    const fromSocketId = String(payload.fromSocketId || '').trim();
    const signal = payload.signal;
    if (!fromSocketId || !signal || !classId) return;

    const connection = createPeerConnection(fromSocketId);
    syncConnectionLocalTracks(connection);

    try {
      if (signal.type === 'offer') {
        await connection.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);

        socketRef.current?.emit('live-class:webrtc-signal', {
          classId,
          targetSocketId: fromSocketId,
          signal: {
            type: 'answer',
            sdp: answer.sdp || '',
          } satisfies LiveClassSignal,
        });
        return;
      }

      if (signal.type === 'answer') {
        await connection.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
        return;
      }

      if (signal.type === 'candidate') {
        await connection.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch {
      // Ignore signaling race conditions during reconnect.
    }
  }, [classId, createPeerConnection, syncConnectionLocalTracks]);

  useEffect(() => {
    if (!classId || !user?._id) return;

    const socket = io(getSocketBaseUrl(), {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    const joinLiveRoom = () => {
      socket.emit('join-live-class', {
        classId,
        userId: user._id,
        name: user.name,
        role: user.role,
      });
    };

    const handlePresence = (event: {
      type?: string;
      socketId?: string;
      userId?: string;
      name?: string;
      role?: string;
    }) => {
      const socketId = String(event.socketId || '').trim();
      if (!socketId || socketId === socket.id) return;

      if (event.type === 'left') {
        setPeers((prev) => prev.filter((peer) => peer.socketId !== socketId));
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[socketId];
          return next;
        });

        const connection = peerConnectionsRef.current.get(socketId);
        if (connection) {
          connection.close();
          peerConnectionsRef.current.delete(socketId);
        }
        return;
      }

      const joinedPeer: LivePeer = {
        socketId,
        userId: String(event.userId || ''),
        name: String(event.name || 'User'),
        role: String(event.role || 'student'),
        cameraOn: false,
      };

      setPeers((prev) => {
        const exists = prev.some((peer) => peer.socketId === socketId);
        return exists ? prev : [...prev, joinedPeer];
      });

      void sendOffer(joinedPeer);
    };

    const handlePeerCameraState = (payload: {
      socketId?: string;
      cameraOn?: boolean;
    }) => {
      const socketId = String(payload.socketId || '').trim();
      if (!socketId) return;

      setPeers((prev) => prev.map((peer) => (
        peer.socketId === socketId ? { ...peer, cameraOn: Boolean(payload.cameraOn) } : peer
      )));
    };

    socket.on('connect', joinLiveRoom);
    socket.on('live-class:participants', syncParticipants);
    socket.on('live-class:presence', handlePresence);
    socket.on('live-class:webrtc-signal', (payload) => {
      void handleSignal(payload);
    });
    socket.on('live-class:camera-state', handlePeerCameraState);
    socket.on('live-class:settings-updated', () => {
      void fetchClassDetails(true);
    });

    if (socket.connected) {
      joinLiveRoom();
    }

    return () => {
      socket.emit('leave-live-class');
      socket.off('connect', joinLiveRoom);
      socket.off('live-class:participants', syncParticipants);
      socket.off('live-class:presence', handlePresence);
      socket.off('live-class:webrtc-signal');
      socket.off('live-class:camera-state', handlePeerCameraState);
      socket.off('live-class:settings-updated');
      socket.disconnect();
      socketRef.current = null;

      clearPeerConnections();
      setPeers([]);
      setRemoteStreams({});
    };
  }, [
    classId,
    clearPeerConnections,
    fetchClassDetails,
    handleSignal,
    syncParticipants,
    user?._id,
    user?.name,
    user?.role,
  ]);

  useEffect(() => {
    if (!socketRef.current || !socketRef.current.connected || !classId) return;

    socketRef.current.emit('live-class:camera-state', {
      classId,
      cameraOn: canPublishLocalCamera,
    });

    if (canPublishLocalCamera) {
      peers.forEach((peer) => {
        void sendOffer(peer);
      });
    }
  }, [
    canPublishLocalCamera,
    classId,
    peers,
    sendOffer,
  ]);

  const whiteboardUrl = useMemo(() => {
    if (!liveClass || !canAccessLiveRoom) return '';

    const params = new URLSearchParams({
      whiteboardid: liveClass.meetingCode,
      username: user?.name || 'SmartEdu User',
      title: liveClass.title,
    });

    return `https://whiteboard.connectycube.com?${params.toString()}`;
  }, [canAccessLiveRoom, liveClass, user?.name]);

  const stopCamera = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    setLocalPreviewStream(null);
    setCameraOn(false);
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera is not supported in this browser.');
      return;
    }

    setCameraLoading(true);
    setCameraError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      localStreamRef.current = stream;
      setLocalPreviewStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setCameraOn(true);
    } catch {
      setCameraOn(false);
      setCameraError('Camera permission denied or unavailable. Please allow camera access and try again.');
    } finally {
      setCameraLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isTeacher) return;
    if (!cameraOn || liveClass?.currentUserCameraApproved) return;

    stopCamera();
    toast('Teacher has revoked your camera permission.', 'info');
  }, [cameraOn, isTeacher, liveClass?.currentUserCameraApproved, stopCamera]);

  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!canAccessLiveRoom && cameraOn) {
      stopCamera();
    }
  }, [cameraOn, canAccessLiveRoom, stopCamera]);

  const fetchClassChat = useCallback(async (silently = false) => {
    const courseId = liveClass?.course?._id;
    if (!courseId) {
      setClassChat(null);
      return;
    }

    if (!silently) setLoadingClassChat(true);

    try {
      const { data: groupChatData } = await api.get('/discussions/chats/groups', {
        params: { courseId },
      });

      const chats = Array.isArray(groupChatData.chats) ? groupChatData.chats : [];
      if (chats.length === 0) {
        if (isTeacher) {
          await api.post('/discussions/chats/groups', {
            courseId,
            name: `${liveClass?.course?.title || 'Course'} Live Class`,
          });

          const { data: retryGroupChatData } = await api.get('/discussions/chats/groups', {
            params: { courseId },
          });

          const retryChats = Array.isArray(retryGroupChatData.chats) ? retryGroupChatData.chats : [];
          if (retryChats.length === 0) {
            setClassChat(null);
            return;
          }

          const retryChatId = retryChats[0]._id;
          const retryChat = await api.get(`/discussions/chats/${retryChatId}`);
          setClassChat(retryChat.data.chat || null);
          return;
        }

        setClassChat(null);
        return;
      }

      const chatId = chats[0]._id;
      const { data } = await api.get(`/discussions/chats/${chatId}`);
      setClassChat(data.chat || null);
    } catch {
      if (!silently) {
        toast('Unable to load class chat.', 'error');
      }
      setClassChat(null);
    } finally {
      if (!silently) setLoadingClassChat(false);
    }
  }, [isTeacher, liveClass?.course?._id, liveClass?.course?.title]);

  useEffect(() => {
    if (workspaceTab !== 'chat') return;
    fetchClassChat();
  }, [workspaceTab, fetchClassChat]);

  useEffect(() => {
    if (workspaceTab !== 'chat' || !classChat?._id) return;

    const intervalId = window.setInterval(() => {
      fetchClassChat(true);
    }, 6000);

    return () => window.clearInterval(intervalId);
  }, [workspaceTab, classChat?._id, fetchClassChat]);

  useEffect(() => {
    if (workspaceTab !== 'chat' || !classChatScrollRef.current) return;
    classChatScrollRef.current.scrollTop = classChatScrollRef.current.scrollHeight;
  }, [workspaceTab, classChat?.messages?.length]);

  const sendClassChatMessage = async () => {
    const trimmed = classChatMessage.trim();
    if (!trimmed || !classChat?._id) return;

    setSendingClassChat(true);
    try {
      await api.post(`/discussions/chats/${classChat._id}/messages`, {
        content: trimmed,
      });

      setClassChatMessage('');
      await fetchClassChat(true);
    } catch {
      toast('Unable to send class chat message.', 'error');
    } finally {
      setSendingClassChat(false);
    }
  };

  const startClassNow = async () => {
    if (!liveClass?._id) return;

    setStartingClass(true);
    try {
      await api.post(`/live-classes/${liveClass._id}/start`);
      toast('Class started.', 'success');
      await fetchClassDetails(true);
      setWorkspaceTab('whiteboard');
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast(message || 'Unable to start class.', 'error');
    } finally {
      setStartingClass(false);
    }
  };

  const joinClassNow = async () => {
    if (!liveClass?._id) return;

    setJoiningClass(true);
    try {
      await api.post(`/live-classes/${liveClass._id}/join`);
      toast('Joined classroom.', 'success');
      await fetchClassDetails(true);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast(message || 'Unable to join class right now.', 'error');
    } finally {
      setJoiningClass(false);
    }
  };

  const endClassNow = async () => {
    if (!liveClass?._id) return;

    setEndingClass(true);
    try {
      await api.post(`/live-classes/${liveClass._id}/end`);
      stopCamera();
      toast('Class ended.', 'success');
      navigate('/live-class');
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast(message || 'Unable to end class right now.', 'error');
    } finally {
      setEndingClass(false);
    }
  };

  const grantStudentCamera = async (studentId: string) => {
    if (!classId) return;
    setCameraActionStudentId(studentId);

    try {
      await api.post(`/live-classes/${classId}/participants/${studentId}/camera/grant`);
      toast('Camera permission granted.', 'success');
      await fetchClassDetails(true);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast(message || 'Unable to grant camera permission.', 'error');
    } finally {
      setCameraActionStudentId('');
    }
  };

  const revokeStudentCamera = async (studentId: string) => {
    if (!classId) return;
    setCameraActionStudentId(studentId);

    try {
      await api.post(`/live-classes/${classId}/participants/${studentId}/camera/revoke`);
      toast('Camera permission revoked.', 'success');
      await fetchClassDetails(true);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast(message || 'Unable to revoke camera permission.', 'error');
    } finally {
      setCameraActionStudentId('');
    }
  };

  const updateSpotlight = async (studentId: string | null) => {
    if (!classId) return;
    setSpotlightActionStudentId(studentId || 'none');

    try {
      await api.post(`/live-classes/${classId}/spotlight`, { studentId });
      toast(studentId ? 'Student spotlight enabled.' : 'Student spotlight cleared.', 'success');
      await fetchClassDetails(true);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast(message || 'Unable to update spotlight.', 'error');
    } finally {
      setSpotlightActionStudentId('');
    }
  };

  const teacherPeer = useMemo(
    () => peers.find((peer) => (
      (peer.role === 'teacher' || peer.role === 'admin')
      && Boolean(remoteStreams[peer.socketId])
    )) || peers.find((peer) => (peer.role === 'teacher' || peer.role === 'admin')) || null,
    [peers, remoteStreams]
  );

  const teacherStream = teacherPeer ? remoteStreams[teacherPeer.socketId] || null : null;

  const spotlightPeer = useMemo(() => {
    const spotlightUserId = liveClass?.spotlightStudent?._id;
    if (!spotlightUserId) return null;

    return peers.find((peer) => (
      peer.userId === spotlightUserId && Boolean(remoteStreams[peer.socketId])
    )) || peers.find((peer) => peer.userId === spotlightUserId) || null;
  }, [liveClass?.spotlightStudent?._id, peers, remoteStreams]);

  const spotlightStream = spotlightPeer ? remoteStreams[spotlightPeer.socketId] || null : null;

  if (loadingClass) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Skeleton className="h-12 rounded-lg" />
        <Skeleton className="h-[520px] rounded-2xl" />
      </div>
    );
  }

  if (!liveClass) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Button variant="outline" className="gap-1 w-fit" onClick={() => navigate('/live-class')}>
          <ArrowLeft size={14} /> Back To Class Management
        </Button>

        <Card>
          <CardBody className="py-8">
            <EmptyState
              icon={<Video size={34} />}
              title="Class not found"
              description="This classroom may be unavailable or not visible for your account."
              action={<Button onClick={() => navigate('/live-class')}>Go To Class Management</Button>}
            />
          </CardBody>
        </Card>
      </div>
    );
  }

  const roster = liveClass.participants || [];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-1" onClick={() => navigate('/live-class')}>
            <ArrowLeft size={14} /> Back
          </Button>

          <div>
            <h1 className="page-title">Live Classroom</h1>
            <p className="page-subtitle">Separate classroom page with fixed teacher screen and switchable workspace.</p>
          </div>
        </div>

        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${statusTone(liveClass.status)}`}>
          {liveClass.status}
        </span>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_340px] gap-4">
        <Card className="border-slate-200">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Current Module</p>
                <h2 className="mt-1 text-2xl font-serif text-slate-900">{liveClass.title}</h2>
                <p className="mt-1 text-sm text-slate-600 max-w-3xl">{liveClass.agenda?.trim() || 'Live class in progress with collaborative tools.'}</p>
              </div>

              <div className="text-right text-xs text-slate-600">
                <div>{formatDateTime(liveClass.scheduledAt)}</div>
                <div className="mt-1">Code: <span className="font-semibold text-slate-800">{liveClass.meetingCode}</span></div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant={workspaceTab === 'whiteboard' ? 'primary' : 'ghost'} className="gap-1" onClick={() => setWorkspaceTab('whiteboard')}>
                <Sparkles size={13} /> Whiteboard
              </Button>
              <Button size="sm" variant={workspaceTab === 'chat' ? 'primary' : 'ghost'} className="gap-1" onClick={() => setWorkspaceTab('chat')}>
                <MessageSquare size={13} /> Chat
              </Button>
              <Button size="sm" variant={workspaceTab === 'roster' ? 'primary' : 'ghost'} className="gap-1" onClick={() => setWorkspaceTab('roster')}>
                <Users size={13} /> Roster
              </Button>
            </div>
          </CardHeader>

          <CardBody>
            {workspaceTab === 'whiteboard' && (
              <>
                {!canAccessLiveRoom ? (
                  <Alert variant="info">
                    {liveClass.status === 'scheduled'
                      ? 'Class is scheduled. Start or wait for the teacher to start.'
                      : 'Whiteboard is available only while class is live.'}
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {canStartClass && (
                        <Button size="sm" loading={startingClass} onClick={startClassNow} className="gap-1">
                          <PlayCircle size={13} /> Start Class
                        </Button>
                      )}
                      {canJoinClass && (
                        <Button size="sm" loading={joiningClass} onClick={joinClassNow} className="gap-1">
                          <Video size={13} /> Join Class
                        </Button>
                      )}
                    </div>
                  </Alert>
                ) : whiteboardUrl ? (
                  <iframe
                    src={whiteboardUrl}
                    title="Live Class Whiteboard"
                    className="w-full h-[440px] rounded-lg border border-border bg-white"
                  />
                ) : (
                  <div className="h-[440px] rounded-lg border border-border bg-muted flex items-center justify-center text-sm text-muted-foreground">
                    Whiteboard is initializing.
                  </div>
                )}
              </>
            )}

            {workspaceTab === 'chat' && (
              <>
                {loadingClassChat ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 rounded-lg" />
                    <Skeleton className="h-12 rounded-lg" />
                    <Skeleton className="h-12 rounded-lg" />
                  </div>
                ) : !classChat ? (
                  <Alert variant="info">
                    No class chat thread found for this course yet.
                    <div className="mt-1 text-xs">A course group chat must exist to use in-room chat.</div>
                  </Alert>
                ) : (
                  <div className="rounded-lg border border-border bg-card overflow-hidden">
                    <div ref={classChatScrollRef} className="h-[360px] overflow-y-auto bg-muted/20 px-3 py-3 space-y-2">
                      {classChat.messages.length === 0 ? (
                        <EmptyState
                          icon={<MessageSquare size={26} />}
                          title="No messages yet"
                          description="Say hello to start the class discussion."
                        />
                      ) : (
                        classChat.messages.map((item: ChatMessage) => {
                          const own = item.sender?._id === user?._id;
                          return (
                            <div key={item._id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[78%] rounded-2xl px-3 py-2 ${own ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-card border border-border rounded-bl-sm'}`}>
                                <div className={`text-[11px] mb-1 ${own ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                                  {item.sender?.name || 'User'}
                                </div>
                                <p className="text-sm whitespace-pre-line break-words">{item.content}</p>
                                <div className={`text-[10px] mt-1 text-right ${own ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                                  {formatClock(item.createdAt)}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="border-t border-border p-2">
                      <div className="flex gap-2">
                        <Textarea
                          rows={2}
                          placeholder="Type a class chat message"
                          value={classChatMessage}
                          onChange={(event) => setClassChatMessage(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault();
                              sendClassChatMessage();
                            }
                          }}
                          className="resize-none"
                        />
                        <Button
                          type="button"
                          onClick={sendClassChatMessage}
                          loading={sendingClassChat}
                          className="self-end h-10 w-10 px-0"
                        >
                          <Send size={15} />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {workspaceTab === 'roster' && (
              <>
                {roster.length === 0 ? (
                  <EmptyState
                    icon={<Users size={28} />}
                    title="No students registered"
                    description="Students are auto-registered from course enrollments when a class is scheduled."
                  />
                ) : (
                  <div className="max-h-[440px] overflow-y-auto grid md:grid-cols-2 gap-2 pr-1">
                    {roster.map((participant) => {
                      const student = participant.student;
                      if (!student?._id) return null;

                      const isPresent = Boolean(participant.joinedAt);
                      const isApproved = Boolean(participant.cameraApproved);
                      const isSpotlighted = Boolean(
                        liveClass.spotlightStudent?._id
                        && liveClass.spotlightStudent._id === student._id
                      );

                      return (
                        <div key={student._id} className="rounded-lg bg-white border border-slate-200 px-3 py-2 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Avatar
                                name={student.name}
                                src={student.avatar}
                                size="sm"
                                className="!bg-slate-200 !text-slate-700"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-900 truncate">{student.name}</p>
                                  {isSpotlighted && <Hand size={12} className="text-amber-600 shrink-0" />}
                                </div>
                                <p className="text-[11px] text-slate-500">Registered {formatRelative(participant.registeredAt, nowMs)}</p>
                              </div>
                            </div>

                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${isPresent ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                              {isPresent ? 'Present' : 'Waiting'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${isApproved ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'}`}>
                              {isApproved ? 'Camera approved' : 'Camera blocked'}
                            </span>
                          </div>

                          {isTeacher && (
                            <div className="flex items-center gap-2 flex-wrap">
                              {isApproved ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  loading={cameraActionStudentId === student._id}
                                  onClick={() => revokeStudentCamera(student._id)}
                                >
                                  Revoke Camera
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  loading={cameraActionStudentId === student._id}
                                  onClick={() => grantStudentCamera(student._id)}
                                >
                                  Grant Camera
                                </Button>
                              )}

                              {isSpotlighted ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  loading={spotlightActionStudentId === 'none'}
                                  onClick={() => updateSpotlight(null)}
                                >
                                  Clear Spotlight
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!isApproved}
                                  loading={spotlightActionStudentId === student._id}
                                  onClick={() => updateSpotlight(student._id)}
                                >
                                  Spotlight Student
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </CardBody>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <h3 className="font-sans text-sm font-semibold">Live Video Stage</h3>
            <p className="text-xs text-muted-foreground">Students can see teacher camera and teacher-selected student spotlight.</p>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="h-[220px] rounded-lg border border-border bg-slate-900 relative overflow-hidden">
              {isTeacher ? (
                <>
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className={`h-full w-full object-cover ${cameraOn ? 'block' : 'hidden'}`}
                  />

                  {!cameraOn && (
                    <div className="h-full w-full flex items-center justify-center text-sm text-slate-300">
                      Camera is off.
                    </div>
                  )}
                </>
              ) : teacherStream ? (
                <LiveVideoPlayer stream={teacherStream} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-sm text-slate-300">
                  Waiting for teacher camera.
                </div>
              )}
            </div>

            {!isTeacher && (
              <div className="h-[110px] rounded-lg border border-border bg-slate-900 relative overflow-hidden">
                {localPreviewStream ? (
                  <LiveVideoPlayer stream={localPreviewStream} muted className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-xs text-slate-300">
                    Your camera preview
                  </div>
                )}
              </div>
            )}

            {liveClass.spotlightStudent && (
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Student Spotlight</p>
                <div className="h-[140px] rounded-lg border border-border bg-slate-900 relative overflow-hidden">
                  {spotlightStream ? (
                    <LiveVideoPlayer stream={spotlightStream} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs text-slate-300 px-3 text-center">
                      Waiting for {liveClass.spotlightStudent.name}'s camera stream.
                    </div>
                  )}
                </div>
              </div>
            )}

            {cameraError && <Alert variant="warning">{cameraError}</Alert>}

            <div className="flex items-center gap-2">
              <Avatar name={liveClass.teacher?.name || 'Teacher'} src={liveClass.teacher?.avatar} size="sm" />
              <div>
                <p className="text-sm font-medium text-foreground">{liveClass.teacher?.name || 'Instructor'}</p>
                <p className="text-xs text-muted-foreground">Host</p>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>Start: {formatDateTime(liveClass.startedAt || liveClass.scheduledAt)}</p>
              <p>Duration: {liveClass.durationMinutes} min</p>
              <p>Meeting code: {liveClass.meetingCode}</p>
              <p>Present: {liveClass.joinedCount} / {liveClass.registeredCount}</p>
              <p>Peer streams: {Object.keys(remoteStreams).length}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={cameraOn ? 'outline' : 'primary'}
                className="gap-1"
                loading={cameraLoading}
                onClick={() => {
                  if (!canAccessLiveRoom && !cameraOn) {
                    toast('Camera is available after class goes live.', 'info');
                    return;
                  }

                   if (!isTeacher && !liveClass.currentUserCameraApproved && !cameraOn) {
                    toast('Teacher has not granted your camera permission yet.', 'info');
                    return;
                  }

                  if (cameraOn) {
                    stopCamera();
                    return;
                  }

                  startCamera();
                }}
              >
                <Video size={13} /> {cameraOn ? 'Stop Camera' : 'Start Camera'}
              </Button>

              {canStartClass && (
                <Button size="sm" className="gap-1" loading={startingClass} onClick={startClassNow}>
                  <PlayCircle size={13} /> Start Class
                </Button>
              )}

              {canEndClass && (
                <Button size="sm" variant="outline" className="gap-1" loading={endingClass} onClick={endClassNow}>
                  <StopCircle size={13} /> End Class
                </Button>
              )}

              {canJoinClass && (
                <Button size="sm" className="gap-1" loading={joiningClass} onClick={joinClassNow}>
                  <Video size={13} /> Join Class
                </Button>
              )}
            </div>

            <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground inline-flex items-center gap-1">
              <Clock3 size={12} /> {liveClass.status === 'live' ? 'Class is live now' : `Class ${liveClass.status}`}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
