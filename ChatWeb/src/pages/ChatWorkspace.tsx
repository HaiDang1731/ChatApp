import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';
import { chatService } from '../signalr/ChatConnection';

type UserView = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  isOnline: boolean;
};

type AttachmentView = {
  url: string;
  type: string;
  name: string;
  size: number;
};

type ReactionView = {
  userId: string;
  emoji: string;
};

type ConversationView = {
  id: string;
  type: string; // "direct" or "group"
  targetUserId?: string;
  targetDisplayName: string;
  targetUsername?: string;
  targetAvatarUrl?: string;
  isTargetOnline: boolean;
  memberCount: number;
  lastMessageId: string | null;
  lastMessageContent: string | null;
  unreadCount: number;
  adminId?: string;
  updatedAt: string;
};

type MessageView = {
  id: string;
  senderId: string;
  senderDisplayName?: string;
  senderAvatarUrl?: string;
  content: string;
  type: string;
  attachments?: AttachmentView[];
  reactions?: ReactionView[];
  isRevoked?: boolean;
  createdAt: string;
};

const ChatWorkspace = () => {
  const { user, token, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState<ConversationView[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserView[]>([]);
  const [groupSearchResults, setGroupSearchResults] = useState<ConversationView[]>([]);

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<ConversationView | null>(null);

  const [messages, setMessages] = useState<MessageView[]>([]);
  const [inputText, setInputText] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const [typingStatus, setTypingStatus] = useState<{ [convId: string]: string[] }>({});

  // Modals
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Friendship State
  const [friends, setFriends] = useState<UserView[]>([]);
  const [pendingRequests, setPendingRequests] = useState<UserView[]>([]);
  const [sidebarTab, setSidebarTab] = useState<'chats' | 'friends'>('chats');

  // Group Info State
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [groupMembers, setGroupMembers] = useState<UserView[]>([]);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [memberIdsToAdd, setMemberIdsToAdd] = useState<string[]>([]);

  // Profile State
  const [profileDisplayName, setProfileDisplayName] = useState(user?.displayName || '');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(user?.avatarUrl || '');

  // Reset profile state when modal opens
  useEffect(() => {
    if (showProfileModal && user) {
      setProfileDisplayName(user.displayName);
      setProfileAvatarUrl(user.avatarUrl || '');
    }
  }, [showProfileModal, user]);

  // Group Modal State
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch('http://localhost:5281/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.avatarUrl !== user?.avatarUrl || data.displayName !== user?.displayName) {
             updateUser({ ...user!, displayName: data.displayName, avatarUrl: data.avatarUrl });
          }
        }
      } catch (err) {}
    };

    if (token) {
      chatService.startConnection(token);
      fetchMe();
      fetchConversations();
      fetchFriends();
      fetchPendingRequests();
    }
    return () => chatService.stopConnection();
  }, [token]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim()) {
        searchUsers(searchQuery);
        searchGroups(searchQuery);
      } else {
        setSearchResults([]);
        setGroupSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  useEffect(() => {
    const handleNewMessage = (msg: any) => {
      if (msg.conversationId === activeConversationId) {
        setMessages(prev => [...prev, msg]);
        chatService.markConversationAsRead(msg.conversationId);
      }
      fetchConversations();
    };

    const handleUserTyping = (convId: string, typingUserId: string, isTyping: boolean) => {
      setTypingStatus(prev => {
        const current = prev[convId] || [];
        if (isTyping && !current.includes(typingUserId)) {
          return { ...prev, [convId]: [...current, typingUserId] };
        } else if (!isTyping && current.includes(typingUserId)) {
          return { ...prev, [convId]: current.filter(id => id !== typingUserId) };
        }
        return prev;
      });
    };

    const handleConversationRead = (convId: string) => {
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, unreadCount: 0 } : c));
    };

    const handleReaction = (convId: string, msgId: string, uId: string, emoji: string) => {
      if (convId === activeConversationId) {
        setMessages(prev => prev.map(m => m.id === msgId ? {
          ...m,
          reactions: [...(m.reactions || []), { userId: uId, emoji }]
        } : m));
      }
    };

    const handleReactionRemoved = (convId: string, msgId: string, uId: string, emoji: string) => {
      if (convId === activeConversationId) {
        setMessages(prev => prev.map(m => m.id === msgId ? {
          ...m,
          reactions: (m.reactions || []).filter(r => !(r.userId === uId && r.emoji === emoji))
        } : m));
      }
    };

    const handleRevoked = (convId: string, msgId: string) => {
      if (convId === activeConversationId) {
        setMessages(prev => prev.map(m => m.id === msgId ? {
          ...m,
          isRevoked: true,
          content: "Tin nhắn đã bị thu hồi",
          type: 'revoked',
          attachments: []
        } : m));
      }
    };

    const handleFriendRequest = (_uId: string) => {
      fetchPendingRequests();
      // Toast or notification could be here
    };

    const handleFriendAccepted = (_uId: string) => {
      fetchFriends();
      fetchConversations();
    };

    const handleGroupAdded = (_convId: string) => {
      fetchConversations();
    };

    chatService.onMessageReceived(handleNewMessage);
    chatService.onUserTyping(handleUserTyping);
    chatService.onConversationRead(handleConversationRead);
    chatService.onMessageReacted(handleReaction);
    chatService.onMessageReactionRemoved(handleReactionRemoved);
    chatService.onMessageRevoked(handleRevoked);
    chatService.onFriendRequestReceived(handleFriendRequest);
    chatService.onFriendRequestAccepted(handleFriendAccepted);
    chatService.onGroupAdded(handleGroupAdded);
    chatService.onUserProfileUpdated((uId: string, displayName: string, avatarUrl?: string) => {
      setConversations(prev => prev.map(c => {
        if (c.targetUserId === uId) {
          return { ...c, targetDisplayName: displayName, targetAvatarUrl: avatarUrl };
        }
        return c;
      }));
      setMessages(prev => prev.map(m => {
        if (m.senderId === uId) {
          return { ...m, senderDisplayName: displayName, senderAvatarUrl: avatarUrl };
        }
        return m;
      }));
      setFriends(prev => prev.map(f => f.id === uId ? { ...f, displayName, avatarUrl } : f));
      setPendingRequests(prev => prev.map(r => r.id === uId ? { ...r, displayName, avatarUrl } : r));
      setActiveConversation(prev => {
        if (prev && prev.targetUserId === uId) {
          return { ...prev, targetDisplayName: displayName, targetAvatarUrl: avatarUrl };
        }
        return prev;
      });
    });

    return () => {
      chatService.offMessageReceived(handleNewMessage);
      chatService.offUserTyping(handleUserTyping);
      chatService.offConversationRead(handleConversationRead);
      chatService.offMessageReacted(handleReaction);
      chatService.offMessageReactionRemoved(handleReactionRemoved);
      chatService.offMessageRevoked(handleRevoked);
      chatService.offFriendRequestReceived(handleFriendRequest);
      chatService.offFriendRequestAccepted(handleFriendAccepted);
      chatService.offGroupAdded(handleGroupAdded);
    };
  }, [activeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingStatus]);

  const fetchConversations = async () => {
    try {
      const res = await fetch('http://localhost:5281/api/chat/conversations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setConversations(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const searchUsers = async (q: string) => {
    try {
      const res = await fetch(`http://localhost:5281/api/chat/users/search?q=${encodeURIComponent(q)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSearchResults(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const searchGroups = async (q: string) => {
    try {
      const res = await fetch(`http://localhost:5281/api/chat/groups/search?q=${encodeURIComponent(q)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setGroupSearchResults(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchFriends = async () => {
    try {
      const res = await fetch('http://localhost:5281/api/friendship/friends', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setFriends(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPendingRequests = async () => {
    try {
      const res = await fetch('http://localhost:5281/api/friendship/pending', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setPendingRequests(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const sendFriendRequest = async (receiverId: string) => {
    try {
      const res = await fetch(`http://localhost:5281/api/friendship/request/${receiverId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        alert("Gửi lời mời thành công!");
        setSearchQuery('');
      } else {
        const data = await res.json();
        alert(data.message || "Không thể gửi lời mời.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const acceptFriendRequest = async (requesterId: string) => {
    try {
      const res = await fetch(`http://localhost:5281/api/friendship/accept/${requesterId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchPendingRequests();
        fetchFriends();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const declineFriendRequest = async (requesterId: string) => {
    try {
      const res = await fetch(`http://localhost:5281/api/friendship/decline/${requesterId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchPendingRequests();
    } catch (err) {
      console.error(err);
    }
  };

  const removeFriend = async (friendId: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa bạn bè?")) return;
    try {
      const res = await fetch(`http://localhost:5281/api/friendship/${friendId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchFriends();
    } catch (err) {
      console.error(err);
    }
  };

  const startChatWithUser = async (targetUser: UserView) => {
    try {
      const res = await fetch(`http://localhost:5281/api/chat/conversation/direct/${targetUser.id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const conv = await res.json();
        const mappedConv: ConversationView = {
          id: conv.id,
          type: "direct",
          targetUserId: targetUser.id,
          targetDisplayName: targetUser.displayName,
          targetUsername: targetUser.username,
          targetAvatarUrl: targetUser.avatarUrl,
          isTargetOnline: targetUser.isOnline,
          memberCount: 2,
          lastMessageId: conv.lastMessageId,
          lastMessageContent: null,
          unreadCount: 0,
          updatedAt: new Date().toISOString()
        };
        setActiveConversationId(conv.id);
        setActiveConversation(mappedConv);
        fetchMessages(conv.id);
        chatService.markConversationAsRead(conv.id);
        setSearchQuery('');
        fetchConversations();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const createGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    try {
      const res = await fetch('http://localhost:5281/api/chat/conversation/group', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: groupName, userIds: selectedUsers })
      });
      if (res.ok) {
        const group = await res.json();
        setShowGroupModal(false);
        setGroupName('');
        setSelectedUsers([]);
        fetchConversations();

        const mappedGroup: ConversationView = {
          id: group.id,
          type: "group",
          targetDisplayName: group.name,
          isTargetOnline: false,
          memberCount: group.members.length,
          lastMessageId: null,
          lastMessageContent: null,
          unreadCount: 0,
          updatedAt: new Date().toISOString()
        };
        setActiveConversationId(group.id);
        setActiveConversation(mappedGroup);
        setMessages([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:5281/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ displayName: profileDisplayName, avatarUrl: profileAvatarUrl })
      });
      if (res.ok) {
        updateUser({
          ...user!,
          displayName: profileDisplayName,
          avatarUrl: profileAvatarUrl
        });
        setShowProfileModal(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('files', file);

    try {
      const res = await fetch('http://localhost:5281/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setProfileAvatarUrl(`http://localhost:5281${data[0].url}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openConversation = (conv: ConversationView) => {
    setActiveConversationId(conv.id);
    setActiveConversation(conv);
    setShowGroupInfo(false); // Đóng panel thông tin nhóm khi đổi hội thoại
    setIsAddingMember(false);
    fetchMessages(conv.id);
    chatService.markConversationAsRead(conv.id);
  };

  const fetchGroupMembers = async (convId: string) => {
    try {
      const res = await fetch(`http://localhost:5281/api/chat/conversation/${convId}/members`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setGroupMembers(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleGroupInfo = () => {
    if (!showGroupInfo && activeConversation?.type === 'group') {
      fetchGroupMembers(activeConversation.id);
    }
    setShowGroupInfo(!showGroupInfo);
  };

  const handleAddMembers = async () => {
    if (!activeConversationId || memberIdsToAdd.length === 0) return;
    try {
      const res = await fetch(`http://localhost:5281/api/chat/conversation/${activeConversationId}/members`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userIds: memberIdsToAdd })
      });
      if (res.ok) {
        alert('Thêm thành viên thành công!');
        setMemberIdsToAdd([]);
        setIsAddingMember(false);
        fetchGroupMembers(activeConversationId);
        fetchConversations();
      } else {
        const data = await res.json();
        alert(data.message || 'Lỗi thêm thành viên.');
      }
    } catch (err) { }
  };

  const fetchMessages = async (convId: string) => {
    try {
      const res = await fetch(`http://localhost:5281/api/chat/messages/${convId}?limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.reverse());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConversationId) return;

    chatService.sendMessage(activeConversationId, inputText);
    chatService.sendTypingStatus(activeConversationId, false);

    const optimisticMsg: MessageView = {
      id: "opt-" + Date.now().toString(),
      senderId: user!.id,
      senderDisplayName: user?.displayName,
      content: inputText,
      type: 'text',
      createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setInputText('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeConversationId) return;

    setIsUploading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const res = await fetch('http://localhost:5281/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        const results = await res.json();
        let type = 'multiple';
        if (results.length === 1) type = results[0].type;

        const attachments = results.map((a: any) => ({
          ...a,
          url: `http://localhost:5281${a.url}`
        }));

        chatService.sendMessage(activeConversationId, "sent attachments", type, attachments);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (activeConversationId) {
      chatService.sendTypingStatus(activeConversationId, true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        chatService.sendTypingStatus(activeConversationId, false);
      }, 2000);
    }
  };

  const revokeMessage = (msgId: string) => {
    if (!activeConversationId) return;
    if (confirm("Bạn có muốn thu hồi tin nhắn này?")) {
      chatService.revokeMessage(activeConversationId, msgId);
      setMessages(prev => prev.map(m => m.id === msgId ? {
        ...m,
        isRevoked: true,
        content: "Tin nhắn đã bị thu hồi",
        type: 'revoked',
        attachments: []
      } : m));
    }
  };

  const renderAvatar = (url?: string, name: string = '?', size: string = 'w-10 h-10') => {
    if (url) return <img src={url} className={`${size} rounded-full object-cover border border-gray-800 shadow-sm`} alt={name} />;
    return (
      <div className={`${size} bg-indigo-700/20 rounded-full flex items-center justify-center text-indigo-400 font-bold border border-indigo-500/20 shadow-sm`}>
        {name.charAt(0).toUpperCase()}
      </div>
    );
  };

  const renderAttachments = (msg: MessageView) => {
    if (!msg.attachments || msg.attachments.length === 0) return null;
    const images = msg.attachments.filter(a => a.type === 'image');
    const docs = msg.attachments.filter(a => a.type === 'file');

    return (
      <div className="mt-2 space-y-2">
        {images.length > 0 && (
          <div className={`grid gap-1 ${images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {images.map((img, i) => (
              <img
                key={i} src={img.url} alt={img.name}
                className="rounded-lg object-cover w-full h-full max-h-[250px] cursor-pointer hover:opacity-90 transition-all shadow-md"
                onClick={() => window.open(img.url, '_blank')}
              />
            ))}
          </div>
        )}
        {docs.map((doc, i) => (
          <div key={i} className="flex items-center space-x-3 bg-gray-900/60 p-3 rounded-xl border border-gray-700/50 hover:bg-gray-800 transition-colors cursor-pointer" onClick={() => window.open(doc.url, '_blank')}>
            <div className="w-10 h-10 bg-indigo-600/20 rounded-lg flex items-center justify-center text-indigo-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-gray-200 truncate">{doc.name}</p>
              <p className="text-[11px] text-gray-500 font-bold uppercase tracking-tight">{(doc.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-950 overflow-hidden font-sans text-gray-200">
      {/* Sidebar */}
      <div className="md:w-80 w-full border-r border-gray-800 flex flex-col bg-gray-900/80 backdrop-blur-xl z-10 shadow-2xl">
        <div className="p-5 border-b border-gray-800/50 flex justify-between items-center">
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => setShowProfileModal(true)}>
            <div className="relative group-hover:scale-105 transition-transform">
              {renderAvatar(user?.avatarUrl, user?.displayName)}
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-[2.5px] border-gray-900 rounded-full shadow-lg"></div>
            </div>
            <div>
              <h1 className="font-bold text-sm text-white group-hover:text-indigo-400 transition-colors truncate w-32">{user?.displayName}</h1>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Active</span>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <button onClick={() => setShowGroupModal(true)} className="p-2 text-gray-400 hover:text-indigo-400 hover:bg-gray-800 rounded-xl transition-all" title="Tạo Nhóm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </button>
            <button onClick={() => { logout(); navigate('/login'); }} className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all" title="Đăng Xuất">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-gray-800/30">
          <div className="relative group">
            <input
              type="text" placeholder="Tìm kiếm người và nhóm..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-950 border border-gray-700/40 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-inner"
            />
            <div className="absolute left-3.5 top-3 text-gray-500 group-focus-within:text-indigo-400 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
          </div>
        </div>

        <div className="flex border-b border-gray-800/30">
          <button
            onClick={() => setSidebarTab('chats')}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[2px] transition-all ${sidebarTab === 'chats' ? 'text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/5' : 'text-gray-600 hover:text-gray-400'}`}
          >
            Hội thoại
          </button>
          <button
            onClick={() => setSidebarTab('friends')}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[2px] transition-all ${sidebarTab === 'friends' ? 'text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/5' : 'text-gray-600 hover:text-gray-400'}`}
          >
            Bạn bè {pendingRequests.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white rounded-full text-[8px] animate-pulse">{pendingRequests.length}</span>}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {searchQuery.trim() ? (
            <>

              {groupSearchResults.length > 0 && (
                <>
                  <div className="px-3 pb-1 pt-4 text-[10px] font-black text-gray-600 uppercase tracking-[2px]">Nhóm Hội Thoại</div>
                  {groupSearchResults.map(g => (
                    <div key={g.id} onClick={() => { openConversation(g); setSearchQuery(''); }} className="flex items-center p-3 rounded-xl cursor-pointer hover:bg-gray-800/50 group transition-all">
                      {renderAvatar(undefined, g.targetDisplayName, 'w-11 h-11')}
                      <div className="ml-3 flex-1">
                        <p className="font-bold text-gray-100 text-sm group-hover:text-white transition-colors">{g.targetDisplayName}</p>
                        <p className="text-[11px] text-gray-500 font-bold uppercase tracking-tight">{g.memberCount} thành viên</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
              <div className="px-3 pb-1 pt-4 text-[10px] font-black text-gray-600 uppercase tracking-[2px]">Người Dùng</div>
              {searchResults.length === 0 && groupSearchResults.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-600 italic">Không tìm thấy gì...</div>
              ) : (
                searchResults.map(u => (
                  <div key={u.id} onClick={() => startChatWithUser(u)} className="flex items-center p-3 rounded-xl cursor-pointer hover:bg-gray-800/50 group transition-all">
                    {renderAvatar(u.avatarUrl, u.displayName, 'w-11 h-11')}
                    <div className="ml-3 flex-1">
                      <p className="font-bold text-gray-100 text-sm group-hover:text-white transition-colors">{u.displayName}</p>
                      <p className="text-[11px] text-gray-500 font-medium">@{u.username}</p>
                    </div>
                    {/* Add Friend Button in Search */}
                    {!friends.some(f => f.id === u.id) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); sendFriendRequest(u.id); }}
                        className="p-2 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-lg transition-all"
                        title="Kết bạn"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                      </button>
                    )}
                  </div>
                ))
              )}
            </>
          ) : (
            sidebarTab === 'chats' ? (
              <>
                <div className="px-3 pb-1 pt-2 text-[10px] font-black text-gray-600 uppercase tracking-[2px]">Gần Đây</div>
                {conversations.map(c => (
                  <div
                    key={c.id} onClick={() => openConversation(c)}
                    className={`flex items-center p-3 rounded-2xl cursor-pointer transition-all mb-1 ${activeConversationId === c.id ? 'bg-indigo-600/10 border-r-4 border-indigo-500 shadow-lg' : 'hover:bg-gray-800/40 border-r-4 border-transparent'}`}
                  >
                    <div className="relative">
                      {renderAvatar(c.type === 'direct' ? c.targetAvatarUrl : undefined, c.targetDisplayName, 'w-12 h-12')}
                      {c.type === 'direct' && c.isTargetOnline && <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-[2.5px] border-gray-900 rounded-full"></div>}
                    </div>
                    <div className="ml-3 flex-1 overflow-hidden">
                      <div className="flex justify-between items-center mb-0.5">
                        <p className={`font-bold text-sm truncate ${c.unreadCount > 0 ? 'text-white' : 'text-gray-300'}`}>{c.targetDisplayName}</p>
                        {c.unreadCount > 0 && (
                          <span className="bg-indigo-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-lg shadow-indigo-600/30">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs truncate ${c.unreadCount > 0 ? 'text-indigo-400 font-bold' : 'text-gray-500'}`}>
                        {typingStatus[c.id]?.length > 0 ? <span className="animate-pulse">đang gõ...</span> : (c.lastMessageContent || "Bắt đầu trò chuyện ngay")}
                      </p>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                {pendingRequests.length > 0 && (
                  <>
                    <div className="px-3 pb-1 pt-2 text-[10px] font-black text-red-500 uppercase tracking-[2px]">Lời mời kết bạn</div>
                    {pendingRequests.map(r => (
                      <div key={r.id} className="flex items-center p-3 rounded-2xl bg-indigo-600/5 border border-indigo-500/10 mb-2">
                        {renderAvatar(r.avatarUrl, r.displayName, 'w-10 h-10')}
                        <div className="ml-3 flex-1">
                          <p className="font-bold text-white text-sm">{r.displayName}</p>
                          <p className="text-[10px] text-gray-500">@{r.username}</p>
                        </div>
                        <div className="flex space-x-1">
                          <button onClick={() => acceptFriendRequest(r.id)} className="p-1.5 bg-green-500/20 text-green-500 hover:bg-green-500 hover:text-white rounded-lg transition-all">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          </button>
                          <button onClick={() => declineFriendRequest(r.id)} className="p-1.5 bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                <div className="px-3 pb-1 pt-2 text-[10px] font-black text-gray-600 uppercase tracking-[2px]">Danh sách bạn bè</div>
                {friends.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-600 italic">Chưa có bạn bè nào.</div>
                ) : (
                  friends.map(f => (
                    <div key={f.id} className="flex items-center p-3 rounded-2xl hover:bg-gray-800/40 group transition-all">
                      <div className="relative cursor-pointer" onClick={() => startChatWithUser(f)}>
                        {renderAvatar(f.avatarUrl, f.displayName, 'w-11 h-11')}
                        {f.isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-gray-900 rounded-full"></div>}
                      </div>
                      <div className="ml-3 flex-1 cursor-pointer" onClick={() => startChatWithUser(f)}>
                        <p className="font-bold text-gray-100 text-sm group-hover:text-white transition-colors">{f.displayName}</p>
                        <p className="text-[10px] text-gray-500 font-medium">@{f.username}</p>
                      </div>
                      <button onClick={() => removeFriend(f.id)} className="p-1.5 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  ))
                )}
              </>
            )
          )}
        </div>

      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex bg-gray-950 relative overflow-hidden">
        {activeConversation ? (
          <>
            <div className="flex-1 flex flex-col relative min-w-0 transition-all duration-300">
              <div className="h-16 border-b border-gray-800/50 flex justify-between items-center px-6 bg-gray-900/40 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    {renderAvatar(activeConversation.targetAvatarUrl, activeConversation.targetDisplayName, 'w-10 h-10')}
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-white tracking-tight">{activeConversation.targetDisplayName}</h2>
                    <div className="flex items-center mt-0.5">
                      {activeConversation.type === 'group' ? (
                        <span className="text-[10px] text-gray-500 font-black uppercase tracking-[1.5px]">{activeConversation.memberCount} thành viên</span>
                      ) : (
                        <>
                          <span className={`w-2 h-2 rounded-full mr-2 ${activeConversation.isTargetOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-700'}`}></span>
                          <span className="text-[10px] text-gray-500 font-black uppercase tracking-[1.5px]">{activeConversation.isTargetOnline ? 'Trực tuyến' : 'Ngoại tuyến'}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {activeConversation.type === 'group' && (
                    <button onClick={handleToggleGroupInfo} className={`p-2 rounded-lg transition-colors ${showGroupInfo ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar">
                {messages.map((msg, idx) => {
                  const isMe = msg.senderId === user?.id;

                  return (
                    <div key={msg.id || idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group transition-all`}>
                      {!isMe && activeConversation.type === 'group' && (
                        <span className="text-[10px] text-gray-500 ml-2 mb-1.5 font-black uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">~ {msg.senderDisplayName}</span>
                      )}

                      <div className="relative max-w-[80%] md:max-w-[70%]">
                        {/* Action Buttons on Hover */}
                        {!msg.isRevoked && (
                          <div className={`absolute -top-10 ${isMe ? 'right-0' : 'left-0'} hidden group-hover:flex bg-gray-900/90 border border-gray-700 rounded-full px-2 py-1 shadow-2xl z-20 items-center space-x-1 animate-in slide-in-from-top-1 fade-in`}>
                            {isMe && (
                              <button onClick={() => revokeMessage(msg.id)} className="p-1.5 text-gray-400 hover:text-red-500" title="Thu hồi">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            )}
                          </div>
                        )}

                        <div className={`px-4 py-3 rounded-2xl shadow-xl ${msg.isRevoked ? 'bg-gray-800/30 border border-gray-800 italic text-gray-600 text-sm' : isMe ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-gray-900 border border-gray-800 text-gray-200 rounded-bl-sm'}`}>
                          {msg.content && <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>}
                          {renderAttachments(msg)}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {(activeConversationId && (typingStatus[activeConversationId] || []).length > 0) && (
                  <div className="flex justify-start animate-in fade-in">
                    <div className="bg-gray-900 border border-gray-800 px-4 py-3 rounded-2xl rounded-bl-sm flex space-x-1.5 items-center shadow-md">
                      <div className="flex space-x-1">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></span>
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                      </div>
                      <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">đang gõ</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-5 bg-gray-950 border-t border-gray-900/80">
                <form onSubmit={handleSend} className="flex space-x-3 max-w-5xl mx-auto items-center">
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*, .zip, .pdf, .txt" multiple hidden />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="text-gray-500 hover:text-indigo-400 hover:bg-indigo-400/10 p-2.5 rounded-full transition-all">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  </button>
                  <div className="flex-1 relative">
                    <input
                      type="text" value={inputText} onChange={handleInputChange}
                      placeholder="Viết lời nhắn của bạn..."
                      className="w-full bg-gray-900 border border-gray-800 rounded-full px-6 py-3.5 text-white focus:outline-none focus:border-indigo-500/50 focus:bg-gray-900/80 transition-all text-sm shadow-inner"
                    />
                  </div>
                  <button type="submit" disabled={!inputText.trim() || isUploading} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-20 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-xl shadow-indigo-600/20 active:scale-95 transition-all">
                    <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  </button>
                </form>
              </div>
            </div>
            {/* End of Chat Center content */}

            {/* Right Sidebar: Group Info */}
            {activeConversation.type === 'group' && showGroupInfo && (
              <div className="w-72 lg:w-80 flex-shrink-0 bg-gray-900 border-l border-gray-800 flex flex-col z-20 animate-in slide-in-from-right fade-in duration-300">
                <div className="p-6 border-b border-gray-800/50 flex justify-between items-center bg-gray-900/40 backdrop-blur-md sticky top-0">
                  <h3 className="text-sm font-black text-white uppercase tracking-tighter">Thông Tin Nhóm</h3>
                  <button onClick={() => setShowGroupInfo(false)} className="text-gray-500 hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Thành viên ({activeConversation.memberCount})</h4>
                    </div>
                    <div className="space-y-2">
                      {groupMembers.map(m => (
                        <div key={m.id} className="flex items-center p-2 rounded-xl hover:bg-gray-800/50 transition-all group">
                          <div className="relative">
                            {renderAvatar(m.avatarUrl, m.displayName, 'w-8 h-8 text-xs')}
                          </div>
                          <div className="ml-3 flex-1 overflow-hidden">
                            <p className="font-bold text-gray-200 text-sm truncate">{m.displayName}</p>
                          </div>
                          {m.id === activeConversation.adminId && (
                            <span className="text-[9px] font-black uppercase text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">Admin</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {user?.id === activeConversation.adminId && (
                    <div className="mt-8">
                      <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Thêm thành viên</h4>

                      {isAddingMember ? (
                        <div className="bg-gray-950 p-3 rounded-2xl border border-gray-800">
                          <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1 mb-3">
                            {friends.filter(f => !groupMembers.some(gm => gm.id === f.id)).map(f => (
                              <label key={f.id} className="flex items-center p-2 hover:bg-gray-800/50 rounded-xl cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="form-checkbox text-indigo-500 rounded bg-gray-900 border-gray-700 h-4 w-4 mr-3"
                                  checked={memberIdsToAdd.includes(f.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) setMemberIdsToAdd([...memberIdsToAdd, f.id]);
                                    else setMemberIdsToAdd(memberIdsToAdd.filter(id => id !== f.id));
                                  }}
                                />
                                <div className="flex items-center gap-2 flex-1">
                                  {renderAvatar(f.avatarUrl, f.displayName, 'w-6 h-6 text-[10px]')}
                                  <span className="text-xs font-bold text-gray-300">{f.displayName}</span>
                                </div>
                              </label>
                            ))}
                            {friends.filter(f => !groupMembers.some(gm => gm.id === f.id)).length === 0 && (
                              <div className="text-center p-4 text-xs text-gray-600 italic">Không có người dùng nào (chưa có trong nhóm). Hiện tính năng chỉ hỗ trợ chọn bạn bè.</div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={handleAddMembers}
                              disabled={memberIdsToAdd.length === 0}
                              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white text-xs font-black py-2 rounded-xl transition-all"
                            >XÁC NHẬN</button>
                            <button
                              onClick={() => { setIsAddingMember(false); setMemberIdsToAdd([]); }}
                              className="px-3 bg-gray-800 hover:bg-gray-700 text-white text-xs font-black rounded-xl transition-all"
                            >HỦY</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setIsAddingMember(true)}
                          className="w-full py-2.5 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/20 text-xs font-black uppercase rounded-2xl transition-all flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                          Mời Vào Nhóm
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-800 p-8 text-center">
            <div className="w-32 h-32 bg-indigo-600/5 rounded-full flex items-center justify-center mb-6 animate-pulse">
              <svg className="w-16 h-16 opacity-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </div>
            <h3 className="text-2xl font-black text-gray-700 uppercase tracking-[4px] mb-2">Chat App</h3>
            <p className="text-sm font-bold text-gray-600 uppercase tracking-widest leading-loose">Chọn một cuộc trò chuyện để bắt đầu kết nối</p>
          </div>
        )}
      </div>

      {/* Group Creation Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-gray-800/50 flex justify-between items-center bg-gray-900/50">
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">Tạo Nhóm Mới</h3>
              <button onClick={() => setShowGroupModal(false)} className="text-gray-500 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-600 uppercase tracking-[2px] mb-3">Tên Nhóm Hội Thoại</label>
                <input
                  type="text" value={groupName} onChange={e => setGroupName(e.target.value)}
                  placeholder="Engineering Team, Family..."
                  className="w-full bg-gray-950 border border-gray-800 rounded-2xl px-5 py-4 text-white focus:border-indigo-600 outline-none transition-all shadow-inner"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-600 uppercase tracking-[2px] mb-3">Chọn Thành Viên</label>
                <div className="max-h-64 overflow-y-auto space-y-2 pr-3 custom-scrollbar">
                  {conversations.filter(c => c.type === 'direct').map(c => (
                    <label key={c.id} className="flex items-center p-3 rounded-2xl border border-transparent hover:bg-gray-800/80 cursor-pointer transition-all group">
                      <input
                        type="checkbox"
                        className="w-5 h-5 rounded-lg border-gray-700 bg-gray-950 text-indigo-600 focus:ring-0 mr-4 transition-all"
                        checked={selectedUsers.includes(c.targetUserId!)}
                        onChange={e => {
                          if (e.target.checked) setSelectedUsers([...selectedUsers, c.targetUserId!]);
                          else setSelectedUsers(selectedUsers.filter(id => id !== c.targetUserId));
                        }}
                      />
                      {renderAvatar(c.targetAvatarUrl, c.targetDisplayName, 'w-10 h-10')}
                      <span className="text-sm text-gray-300 font-bold ml-3 group-hover:text-white">{c.targetDisplayName}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-8 bg-gray-950/20 border-t border-gray-800">
              <button
                onClick={createGroup} disabled={!groupName.trim() || selectedUsers.length === 0}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-20 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-indigo-600/10 uppercase tracking-widest text-xs"
              >
                Tạo nhóm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Settings Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form onSubmit={handleUpdateProfile} className="bg-gray-900 border border-gray-800 rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-gray-800/50 flex justify-between items-center bg-gray-900/50">
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">Hồ Sơ Cá Nhân</h3>
              <button type="button" onClick={() => setShowProfileModal(false)} className="text-gray-500 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-10 space-y-8 flex flex-col items-center">
              <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                {renderAvatar(profileAvatarUrl, profileDisplayName, 'w-32 h-32')}
                <div className="absolute inset-0 bg-black/40 rounded-full hidden group-hover:flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <input type="file" ref={avatarInputRef} onChange={handleAvatarUpload} accept="image/*" hidden />
              </div>

              <div className="w-full">
                <label className="block text-[10px] font-black text-gray-600 uppercase tracking-[2px] mb-3">Tên Hiển Thị</label>
                <input
                  type="text" value={profileDisplayName} onChange={e => setProfileDisplayName(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-2xl px-5 py-4 text-white focus:border-indigo-600 outline-none transition-all shadow-inner text-center font-bold"
                />
              </div>
            </div>
            <div className="p-8 bg-gray-950/20 border-t border-gray-800">
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-indigo-600/10 uppercase tracking-widest text-xs"
              >
                Lưu Thay Đổi
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ChatWorkspace;
