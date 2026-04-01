using ChatCore.DTOs;
using ChatCore.Entities;
using ChatCore.Interfaces;

namespace ChatCore.Services
{
    public class ChatService : IChatService
    {
        private readonly IMessageRepository _messageRepo;
        private readonly IConversationRepository _conversationRepo;
        private readonly IUserRepository _userRepo;

        public ChatService(IMessageRepository messageRepo, IConversationRepository conversationRepo, IUserRepository userRepo)
        {
            _messageRepo = messageRepo;
            _conversationRepo = conversationRepo;
            _userRepo = userRepo;
        }

        public async Task<Message> ProcessMessageAsync(SendMessageDto dto, string senderId)
        {
            var sender = await _userRepo.GetByIdAsync(senderId);
            var message = new Message
            {
                ConversationId = dto.ConversationId,
                SenderId = senderId,
                SenderDisplayName = sender?.DisplayName ?? "User",
                SenderAvatarUrl = sender?.AvatarUrl,
                Content = dto.Content,
                Type = dto.Type,
                FileUrl = dto.FileUrl,
                Attachments = dto.Attachments?.Select(a => new Attachment
                {
                    Url = a.Url,
                    Type = a.Type,
                    Name = a.Name,
                    Size = a.Size
                }).ToList() ?? new List<Attachment>(),
                CreatedAt = DateTime.UtcNow,
                ReadBy = new List<string> { senderId }
            };

            await _messageRepo.InsertAsync(message);
            await _conversationRepo.UpdateLastMessageAsync(dto.ConversationId, message.Id);

            return message;
        }

        public async Task<List<Message>> GetMessagesAsync(string conversationId, int limit, DateTime? beforeCursor)
        {
            return await _messageRepo.GetMessagesAsync(conversationId, limit, beforeCursor);
        }

        public async Task<List<Conversation>> GetUserConversationsAsync(string userId)
        {
            return await _conversationRepo.GetByUserIdAsync(userId);
        }

        public async Task<List<string>> GetConversationMemberIdsAsync(string conversationId)
        {
            return await _conversationRepo.GetMemberIdsAsync(conversationId);
        }

        public async Task MarkMessageAsReadAsync(string messageId, string userId)
        {
            await _messageRepo.MarkAsReadAsync(messageId, userId);
        }

        public async Task MarkConversationAsReadAsync(string conversationId, string userId)
        {
            await _messageRepo.MarkConversationAsReadAsync(conversationId, userId);
        }

        public async Task AddReactionAsync(string messageId, string userId, string emoji)
        {
            await _messageRepo.AddReactionAsync(messageId, new MessageReaction { UserId = userId, Emoji = emoji });
        }

        public async Task RemoveReactionAsync(string messageId, string userId, string emoji)
        {
            await _messageRepo.RemoveReactionAsync(messageId, userId, emoji);
        }

        public async Task RevokeMessageAsync(string messageId)
        {
            await _messageRepo.RevokeMessageAsync(messageId);
        }
    }
}
