import * as signalR from "@microsoft/signalr";
import { API_BASE_URL } from "../config";

class ChatService {
  private connection: signalR.HubConnection | null = null;
  private messageCallbacks: ((message: any) => void)[] = [];
  private typingCallbacks: ((convId: string, userId: string, isTyping: boolean) => void)[] = [];
  private readCallbacks: ((convId: string, userId: string) => void)[] = [];
  private reactionCallbacks: ((convId: string, messageId: string, userId: string, emoji: string) => void)[] = [];
  private reactionRemovedCallbacks: ((convId: string, messageId: string, userId: string, emoji: string) => void)[] = [];
  private revokeCallbacks: ((convId: string, messageId: string) => void)[] = [];
  private userProfileUpdatedCallbacks: ((userId: string, displayName: string, avatarUrl?: string) => void)[] = [];
  private friendRequestReceivedCallbacks: ((userId: string) => void)[] = [];
  private friendRequestAcceptedCallbacks: ((userId: string) => void)[] = [];
  private groupAddedCallbacks: ((convId: string) => void)[] = [];

  public async startConnection(token: string) {
    if (this.connection) return;

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/chatHub`, {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect()
      .build();

    this.connection.on("ReceiveNewMessage", (message) => {
      this.messageCallbacks.forEach(cb => cb(message));
    });

    this.connection.on("UserTyping", (convId, userId, isTyping) => {
      this.typingCallbacks.forEach(cb => cb(convId, userId, isTyping));
    });

    this.connection.on("ConversationRead", (convId, userId) => {
      this.readCallbacks.forEach(cb => cb(convId, userId));
    });

    this.connection.on("MessageReacted", (convId, msgId, userId, emoji) => {
      this.reactionCallbacks.forEach(cb => cb(convId, msgId, userId, emoji));
    });

    this.connection.on("MessageReactionRemoved", (convId, msgId, userId, emoji) => {
        this.reactionRemovedCallbacks.forEach(cb => cb(convId, msgId, userId, emoji));
    });

    this.connection.on("MessageRevoked", (convId, msgId) => {
      this.revokeCallbacks.forEach(cb => cb(convId, msgId));
    });

    this.connection.on("UserProfileUpdated", (userId, displayName, avatarUrl) => {
      this.userProfileUpdatedCallbacks.forEach(cb => cb(userId, displayName, avatarUrl));
    });

    this.connection.on("FriendRequestReceived", (userId) => {
      this.friendRequestReceivedCallbacks.forEach(cb => cb(userId));
    });

    this.connection.on("FriendRequestAccepted", (userId) => {
      this.friendRequestAcceptedCallbacks.forEach(cb => cb(userId));
    });
    
    this.connection.on("GroupAdded", (convId) => {
      this.groupAddedCallbacks.forEach(cb => cb(convId));
    });

    this.connection.on("ErrorMessage", (message) => {
        alert(message); // Simple alert for now
    });
    try {
      await this.connection.start();
      console.log("SignalR Connected");
    } catch (err) {
      console.log("SignalR Connection Error: ", err);
    }
  }

  public sendMessage(conversationId: string, content: string, type: string = "text", attachments?: any[]) {
    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      this.connection.invoke("SendMessage", { 
        conversationId, 
        content, 
        type, 
        attachments: attachments || [] 
      }).catch(err => console.error(err));
    }
  }

  public sendTypingStatus(conversationId: string, isTyping: boolean) {
    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      this.connection.invoke("SendTypingStatus", conversationId, isTyping)
        .catch(err => console.error(err));
    }
  }

  public markConversationAsRead(conversationId: string) {
    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      this.connection.invoke("MarkConversationAsRead", conversationId)
        .catch(err => console.error(err));
    }
  }

  public reactToMessage(conversationId: string, messageId: string, emoji: string) {
    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      this.connection.invoke("ReactToMessage", conversationId, messageId, emoji)
        .catch(err => console.error(err));
    }
  }

  public removeReaction(conversationId: string, messageId: string, emoji: string) {
    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      this.connection.invoke("RemoveReaction", conversationId, messageId, emoji)
        .catch(err => console.error(err));
    }
  }

  public revokeMessage(conversationId: string, messageId: string) {
    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      this.connection.invoke("RevokeMessage", conversationId, messageId)
        .catch(err => console.error(err));
    }
  }

  // Event Listeners
  public onMessageReceived(callback: (message: any) => void) { this.messageCallbacks.push(callback); }
  public offMessageReceived(callback: (message: any) => void) { this.messageCallbacks = this.messageCallbacks.filter(c => c !== callback); }

  public onUserTyping(callback: (convId: string, userId: string, isTyping: boolean) => void) { this.typingCallbacks.push(callback); }
  public offUserTyping(callback: (convId: string, userId: string, isTyping: boolean) => void) { this.typingCallbacks = this.typingCallbacks.filter(c => c !== callback); }

  public onConversationRead(callback: (convId: string, userId: string) => void) { this.readCallbacks.push(callback); }
  public offConversationRead(callback: (convId: string, userId: string) => void) { this.readCallbacks = this.readCallbacks.filter(c => c !== callback); }

  public onMessageReacted(callback: any) { this.reactionCallbacks.push(callback); }
  public offMessageReacted(callback: any) { this.reactionCallbacks = this.reactionCallbacks.filter(c => c !== callback); }

  public onMessageReactionRemoved(callback: any) { this.reactionRemovedCallbacks.push(callback); }
  public offMessageReactionRemoved(callback: any) { this.reactionRemovedCallbacks = this.reactionRemovedCallbacks.filter(c => c !== callback); }

  public onMessageRevoked(callback: any) { this.revokeCallbacks.push(callback); }
  public offMessageRevoked(callback: any) { this.revokeCallbacks = this.revokeCallbacks.filter(c => c !== callback); }

  public onUserProfileUpdated(callback: (userId: string, displayName: string, avatarUrl?: string) => void) { this.userProfileUpdatedCallbacks.push(callback); }
  public offUserProfileUpdated(callback: (userId: string, displayName: string, avatarUrl?: string) => void) { this.userProfileUpdatedCallbacks = this.userProfileUpdatedCallbacks.filter(c => c !== callback); }

  public onFriendRequestReceived(callback: (userId: string) => void) { this.friendRequestReceivedCallbacks.push(callback); }
  public offFriendRequestReceived(callback: (userId: string) => void) { this.friendRequestReceivedCallbacks = this.friendRequestReceivedCallbacks.filter(c => c !== callback); }

  public onFriendRequestAccepted(callback: (userId: string) => void) { this.friendRequestAcceptedCallbacks.push(callback); }
  public offFriendRequestAccepted(callback: (userId: string) => void) { this.friendRequestAcceptedCallbacks = this.friendRequestAcceptedCallbacks.filter(c => c !== callback); }

  public onGroupAdded(callback: (convId: string) => void) { this.groupAddedCallbacks.push(callback); }
  public offGroupAdded(callback: (convId: string) => void) { this.groupAddedCallbacks = this.groupAddedCallbacks.filter(c => c !== callback); }
  public stopConnection() {
    if (this.connection) {
      this.connection.stop();
      this.connection = null;
    }
  }
}

export const chatService = new ChatService();
