import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Card, CardBody, CardHeader, Button, Input, Textarea, Avatar, EmptyState, Skeleton, Select, Alert, toast } from '@/components/ui';
import { MessageSquare, Send, Search, Users, UserRoundPlus, Plus } from 'lucide-react';
import type { ChatConversation, Course, ChatMessage, User } from '@/types';

type ChatTab = 'direct' | 'group';

const formatClock = (value?: string) => {
  if (!value) return '';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatChatListTime = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay ? formatClock(value) : date.toLocaleDateString();
};

export const DiscussionsPage: React.FC = () => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<ChatTab>('direct');
  const [directChats, setDirectChats] = useState<ChatConversation[]>([]);
  const [groupChats, setGroupChats] = useState<ChatConversation[]>([]);
  const [selectedChatId, setSelectedChatId] = useState('');
  const [selectedChat, setSelectedChat] = useState<ChatConversation | null>(null);

  const [loadingLists, setLoadingLists] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [sending, setSending] = useState(false);

  const [message, setMessage] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [contacts, setContacts] = useState<Pick<User, '_id' | 'name' | 'avatar' | 'role'>[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [startingChatWith, setStartingChatWith] = useState('');

  const [courses, setCourses] = useState<Course[]>([]);
  const [groupCourseId, setGroupCourseId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  const chats = activeTab === 'direct' ? directChats : groupChats;

  const selectedFromList = useMemo(
    () => chats.find((item) => item._id === selectedChatId) || null,
    [chats, selectedChatId]
  );

  const groupedContacts = useMemo(() => {
    const teachers = contacts.filter((contact) => contact.role === 'teacher');
    const students = contacts.filter((contact) => contact.role === 'student');
    const others = contacts.filter((contact) => contact.role !== 'teacher' && contact.role !== 'student');

    return [
      { key: 'teacher', label: `Teachers (${teachers.length})`, items: teachers },
      { key: 'student', label: `Students (${students.length})`, items: students },
      { key: 'other', label: `Others (${others.length})`, items: others },
    ].filter((group) => group.items.length > 0);
  }, [contacts]);

  const currentChat = selectedChat || selectedFromList;

  const getDirectPeer = (chat: ChatConversation) => {
    if (!user) return chat.otherParticipant || chat.participants[0];
    return (
      chat.otherParticipant ||
      chat.participants.find((participant) => participant._id !== user._id) ||
      chat.participants[0]
    );
  };

  const getChatTitle = (chat: ChatConversation) => {
    if (chat.type === 'group') {
      return chat.name || chat.course?.title || 'Course Group';
    }
    return getDirectPeer(chat)?.name || 'Direct Chat';
  };

  const getChatSubtitle = (chat: ChatConversation) => {
    if (chat.type === 'group') {
      return chat.course?.title || `${chat.participants.length} members`;
    }
    const peer = getDirectPeer(chat);
    return peer?.role ? peer.role.charAt(0).toUpperCase() + peer.role.slice(1) : 'Direct chat';
  };

  const getLastMessage = (chat: ChatConversation) => {
    const last = chat.messages?.[chat.messages.length - 1];
    return last?.content || 'No messages yet';
  };

  const fetchCoursesForGroups = async () => {
    if (!user) return;

    const endpoint = user.role === 'student' ? '/courses/enrolled' : '/courses/my-courses';
    const { data } = await api.get(endpoint);

    const list = data.enrollments
      ? data.enrollments.map((enrollment: { course: Course }) => enrollment.course).filter(Boolean)
      : data.courses || [];

    setCourses(list);
    if (!groupCourseId && list.length > 0) {
      setGroupCourseId(list[0]._id);
    }
  };

  const fetchDirectChats = async () => {
    const { data } = await api.get('/discussions/chats/direct');
    setDirectChats(data.chats || []);
  };

  const fetchGroupChats = async () => {
    const { data } = await api.get('/discussions/chats/groups');
    setGroupChats(data.chats || []);
  };

  const fetchContacts = async (query = '') => {
    setLoadingContacts(true);
    try {
      const { data } = await api.get('/discussions/contacts', query ? { params: { search: query } } : undefined);
      setContacts(data.users || []);
    } catch {
      toast('Could not load users for direct chat.', 'error');
      setContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  };

  const fetchChatDetails = async (chatId: string, useLoading = true) => {
    if (!chatId) {
      setSelectedChat(null);
      return;
    }

    if (useLoading) setLoadingChat(true);
    try {
      const { data } = await api.get(`/discussions/chats/${chatId}`);
      setSelectedChat(data.chat || null);
    } catch {
      setSelectedChat(null);
    } finally {
      if (useLoading) setLoadingChat(false);
    }
  };

  const refreshAll = async () => {
    setLoadingLists(true);
    try {
      await Promise.all([fetchDirectChats(), fetchGroupChats(), fetchCoursesForGroups(), fetchContacts()]);
    } catch {
      toast('Could not load chats right now.', 'error');
    } finally {
      setLoadingLists(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, [user?._id]);

  useEffect(() => {
    const activeChats = activeTab === 'direct' ? directChats : groupChats;
    if (activeChats.length === 0) {
      setSelectedChatId('');
      setSelectedChat(null);
      return;
    }

    if (!activeChats.some((chat) => chat._id === selectedChatId)) {
      setSelectedChatId(activeChats[0]._id);
    }
  }, [activeTab, directChats, groupChats, selectedChatId]);

  useEffect(() => {
    fetchChatDetails(selectedChatId);
  }, [selectedChatId]);

  useEffect(() => {
    if (!selectedChatId) return;
    const intervalId = window.setInterval(() => {
      fetchChatDetails(selectedChatId, false);
    }, 6000);

    return () => window.clearInterval(intervalId);
  }, [selectedChatId]);

  const searchContacts = async () => {
    const q = contactSearch.trim();
    await fetchContacts(q);
  };

  const startDirectChat = async (targetUserId: string) => {
    setStartingChatWith(targetUserId);
    try {
      const { data } = await api.post('/discussions/chats/direct', { userId: targetUserId });
      setActiveTab('direct');
      setSelectedChatId(data.chat._id);
      await fetchDirectChats();
      await fetchChatDetails(data.chat._id);
      setContactSearch('');
      await fetchContacts();
      toast('Direct chat opened.', 'success');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast(message || 'Unable to start direct chat.', 'error');
    } finally {
      setStartingChatWith('');
    }
  };

  const createGroupChat = async () => {
    if (!groupCourseId) {
      toast('Please select a course first.', 'error');
      return;
    }

    setCreatingGroup(true);
    try {
      const { data } = await api.post('/discussions/chats/groups', {
        courseId: groupCourseId,
        name: groupName.trim(),
      });

      setActiveTab('group');
      setSelectedChatId(data.chat._id);
      setGroupName('');
      await fetchGroupChats();
      await fetchChatDetails(data.chat._id);
      toast(`Group created with ${data.addedStudents} enrolled students.`, 'success');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast(message || 'Failed to create group.', 'error');
    } finally {
      setCreatingGroup(false);
    }
  };

  const sendMessage = async () => {
    const trimmed = message.trim();
    if (!trimmed || !currentChat) return;

    setSending(true);
    try {
      await api.post(`/discussions/chats/${currentChat._id}/messages`, { content: trimmed });
      setMessage('');
      await Promise.all([
        fetchChatDetails(currentChat._id, false),
        activeTab === 'direct' ? fetchDirectChats() : fetchGroupChats(),
      ]);
    } catch {
      toast('Failed to send message.', 'error');
    } finally {
      setSending(false);
    }
  };

  const renderChatList = () => {
    if (loadingLists) {
      return (
        <div className="space-y-2 p-3">
          {Array(6).fill(0).map((_, index) => <Skeleton key={index} className="h-16 rounded-lg" />)}
        </div>
      );
    }

    if (chats.length === 0) {
      return (
        <div className="p-4">
          <EmptyState
            icon={<MessageSquare size={28} />}
            title={activeTab === 'direct' ? 'No direct chats' : 'No groups yet'}
            description={activeTab === 'direct'
              ? 'Search and start a direct conversation.'
              : 'Join or create a course group to begin chatting.'}
          />
        </div>
      );
    }

    return (
      <div className="overflow-y-auto h-full p-2 space-y-1.5">
        {chats.map((chat) => {
          const peer = chat.type === 'direct' ? getDirectPeer(chat) : null;
          return (
            <button
              key={chat._id}
              type="button"
              onClick={() => setSelectedChatId(chat._id)}
              className={`w-full text-left rounded-lg p-3 transition-colors border ${selectedChatId === chat._id ? 'bg-primary/10 border-primary/30' : 'border-transparent hover:bg-muted/60'}`}
            >
              <div className="flex items-start gap-3">
                <Avatar
                  name={chat.type === 'group' ? getChatTitle(chat) : (peer?.name || 'User')}
                  src={chat.type === 'group' ? chat.course?.banner || chat.course?.thumbnail : peer?.avatar}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{getChatTitle(chat)}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">{formatChatListTime(chat.lastMessageAt)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{getLastMessage(chat)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1 truncate">{getChatSubtitle(chat)}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Discussions</h1>
          <p className="page-subtitle">WhatsApp-style messaging with direct chat and course groups.</p>
        </div>
        <Button variant="outline" onClick={refreshAll}>Refresh</Button>
      </div>

      <div className="flex border-b border-border">
        {([
          { key: 'direct', label: 'Direct Chat', icon: <UserRoundPlus size={14} /> },
          { key: 'group', label: 'Groups', icon: <Users size={14} /> },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 flex items-center gap-1.5 ${activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[360px_1fr] gap-4 min-h-[70vh]">
        <Card className="overflow-hidden h-[70vh] flex flex-col">
          <CardHeader className="space-y-3">
            {activeTab === 'direct' ? (
              <>
                <h3 className="font-sans text-sm font-semibold">Start Direct Chat</h3>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search teacher or student"
                    value={contactSearch}
                    onChange={(event) => setContactSearch(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && searchContacts()}
                    icon={<Search size={14} />}
                  />
                  <Button type="button" variant="outline" onClick={searchContacts}>
                    <Search size={14} />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">All available students and teachers</p>
                <div className="max-h-48 overflow-y-auto rounded-md border border-border">
                  {loadingContacts ? (
                    <div className="p-2 space-y-2">
                      {Array(4).fill(0).map((_, index) => <Skeleton key={index} className="h-10 rounded-md" />)}
                    </div>
                  ) : contacts.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-3 py-2">No users found.</p>
                  ) : (
                    groupedContacts.map((group) => (
                      <div key={group.key} className="border-b last:border-b-0 border-border/60">
                        <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/40">
                          {group.label}
                        </p>
                        {group.items.map((contact) => (
                          <button
                            key={contact._id}
                            type="button"
                            onClick={() => startDirectChat(contact._id)}
                            disabled={startingChatWith === contact._id}
                            className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-muted/50 text-left disabled:opacity-60"
                          >
                            <Avatar name={contact.name} src={contact.avatar} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-foreground truncate">{contact.name}</div>
                              <div className="text-xs text-muted-foreground">{contact.role}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                <h3 className="font-sans text-sm font-semibold">Course Groups</h3>
                {(user?.role === 'teacher' || user?.role === 'admin') ? (
                  <div className="space-y-2">
                    {courses.length === 0 ? (
                      <Alert variant="warning">
                        No course found. Create a course first to create a group.
                        <div className="mt-2">
                          <Link to="/courses/new"><Button size="sm" variant="outline">Create Course</Button></Link>
                        </div>
                      </Alert>
                    ) : (
                      <>
                        <Select value={groupCourseId} onChange={(event) => setGroupCourseId(event.target.value)}>
                          {courses.map((course) => (
                            <option key={course._id} value={course._id}>{course.title}</option>
                          ))}
                        </Select>
                        <Input
                          placeholder="Group name (optional)"
                          value={groupName}
                          onChange={(event) => setGroupName(event.target.value)}
                        />
                        <Button type="button" variant="secondary" onClick={createGroupChat} loading={creatingGroup} className="w-full">
                          <Plus size={14} /> Create Group From Course
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Teachers create course groups. You can join chats where you are added.
                  </p>
                )}
              </>
            )}
          </CardHeader>

          <div className="border-t border-border flex-1 min-h-0">
            {renderChatList()}
          </div>
        </Card>

        <Card className="h-[70vh] flex flex-col overflow-hidden">
          {!currentChat ? (
            <CardBody className="h-full flex items-center justify-center">
              <EmptyState
                icon={<MessageSquare size={40} />}
                title="Select a conversation"
                description="Choose a chat from the left panel to start messaging."
              />
            </CardBody>
          ) : (
            <>
              <CardHeader className="py-3">
                <div className="flex items-center gap-3">
                  <Avatar
                    name={getChatTitle(currentChat)}
                    src={currentChat.type === 'group' ? currentChat.course?.banner || currentChat.course?.thumbnail : getDirectPeer(currentChat)?.avatar}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{getChatTitle(currentChat)}</div>
                    <div className="text-xs text-muted-foreground truncate">{getChatSubtitle(currentChat)}</div>
                  </div>
                </div>
              </CardHeader>

              <div className="flex-1 min-h-0 overflow-y-auto bg-muted/20 px-4 py-4 space-y-3">
                {loadingChat ? (
                  Array(6).fill(0).map((_, index) => (
                    <div key={index} className={`flex ${index % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                      <Skeleton className="h-12 w-56 rounded-2xl" />
                    </div>
                  ))
                ) : currentChat.messages.length === 0 ? (
                  <EmptyState
                    icon={<MessageSquare size={30} />}
                    title="No messages yet"
                    description="Send the first message to start this conversation."
                  />
                ) : (
                  currentChat.messages.map((item: ChatMessage) => {
                    const own = item.sender?._id === user?._id;
                    return (
                      <div key={item._id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${own ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-card border border-border rounded-bl-sm'}`}>
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

              <div className="border-t border-border p-3 bg-card">
                <div className="flex gap-2">
                  <Textarea
                    rows={2}
                    placeholder="Type your message"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        sendMessage();
                      }
                    }}
                    className="resize-none"
                  />
                  <Button type="button" onClick={sendMessage} loading={sending} className="self-end h-10 w-10 px-0">
                    <Send size={15} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};
