using ChatCore.DTOs;
using ChatCore.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
using System.Linq;

namespace ChatAPI.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        private readonly IChatService _chatService;
        private readonly IUserRepository _userRepository;
        private readonly IFriendshipService _friendshipService;
        private readonly IConversationRepository _conversationRepository;

        public ChatHub(IChatService chatService, IUserRepository userRepository, IFriendshipService friendshipService, IConversationRepository conversationRepository)
        {
            _chatService = chatService;
            _userRepository = userRepository;
            _friendshipService = friendshipService;
            _conversationRepository = conversationRepository;
        }

        public override async Task OnConnectedAsync()
        {
            var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId != null)
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, userId);
                await _userRepository.UpdateOnlineStatusAsync(userId, true);
                await Clients.All.SendAsync("UserStatusChanged", userId, true);
            }
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId != null)
            {
                await _userRepository.UpdateOnlineStatusAsync(userId, false);
                await Clients.All.SendAsync("UserStatusChanged", userId, false);
            }
            await base.OnDisconnectedAsync(exception);
        }

        public async Task SendMessage(SendMessageDto dto)
        {
            var senderId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
            if (senderId == null) return;

            // Kiểm tra quan hệ bạn bè nếu là tin nhắn direct
            var conversation = await _conversationRepository.GetByIdAsync(dto.ConversationId);
            if (conversation != null && conversation.Type == "direct")
            {
                var otherMemberId = conversation.Members.FirstOrDefault(m => m != senderId);
                if (otherMemberId != null)
                {
                    var isFriend = await _friendshipService.IsFriendWithAsync(senderId, otherMemberId);
                    if (!isFriend)
                    {
                        await Clients.Caller.SendAsync("ErrorMessage", "You can only message your friends.");
                        return;
                    }
                }
            }

            var savedMessage = await _chatService.ProcessMessageAsync(dto, senderId);
            var receiverIds = await _chatService.GetConversationMemberIdsAsync(dto.ConversationId);

            foreach (var id in receiverIds.Where(id => id != senderId))
            {
                await Clients.Group(id).SendAsync("ReceiveNewMessage", savedMessage);
            }
            
            // Sender gets echo response to confirm if needed
            await Clients.Caller.SendAsync("MessageSent", savedMessage);
        }

        public async Task MarkAsRead(string messageId)
        {
            var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId != null)
            {
                await _chatService.MarkMessageAsReadAsync(messageId, userId);
            }
        }

        public async Task SendTypingStatus(string conversationId, bool isTyping)
        {
            var senderId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
            if (senderId == null) return;

            var receiverIds = await _chatService.GetConversationMemberIdsAsync(conversationId);
            foreach (var id in receiverIds.Where(uId => uId != senderId))
            {
                await Clients.Group(id).SendAsync("UserTyping", conversationId, senderId, isTyping);
            }
        }

        public async Task MarkConversationAsRead(string conversationId)
        {
            var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId != null)
            {
                await _chatService.MarkConversationAsReadAsync(conversationId, userId);
                
                // Notify sender that their messages were read
                var receiverIds = await _chatService.GetConversationMemberIdsAsync(conversationId);
                foreach (var id in receiverIds.Where(uId => uId != userId))
                {
                    await Clients.Group(id).SendAsync("ConversationRead", conversationId, userId);
                }
            }
        }

        public async Task ReactToMessage(string conversationId, string messageId, string emoji)
        {
            var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null) return;

            await _chatService.AddReactionAsync(messageId, userId, emoji);
            var receiverIds = await _chatService.GetConversationMemberIdsAsync(conversationId);
            
            foreach (var id in receiverIds)
            {
                await Clients.Group(id).SendAsync("MessageReacted", conversationId, messageId, userId, emoji);
            }
        }

        public async Task RemoveReaction(string conversationId, string messageId, string emoji)
        {
            var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null) return;

            await _chatService.RemoveReactionAsync(messageId, userId, emoji);
            var receiverIds = await _chatService.GetConversationMemberIdsAsync(conversationId);

            foreach (var id in receiverIds)
            {
                await Clients.Group(id).SendAsync("MessageReactionRemoved", conversationId, messageId, userId, emoji);
            }
        }

        public async Task RevokeMessage(string conversationId, string messageId)
        {
            var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null) return;

            await _chatService.RevokeMessageAsync(messageId);
            var receiverIds = await _chatService.GetConversationMemberIdsAsync(conversationId);

            foreach (var id in receiverIds)
            {
                await Clients.Group(id).SendAsync("MessageRevoked", conversationId, messageId);
            }
        }
    }
}
