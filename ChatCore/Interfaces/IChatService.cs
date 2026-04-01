using ChatCore.DTOs;
using ChatCore.Entities;

namespace ChatCore.Interfaces
{
    public interface IChatService
    {
        Task<Message> ProcessMessageAsync(SendMessageDto dto, string senderId);
        Task<List<Message>> GetMessagesAsync(string conversationId, int limit, DateTime? beforeCursor);
        Task<List<Conversation>> GetUserConversationsAsync(string userId);
        Task<List<string>> GetConversationMemberIdsAsync(string conversationId);
        Task MarkMessageAsReadAsync(string messageId, string userId);
        Task MarkConversationAsReadAsync(string conversationId, string userId);
        
        Task AddReactionAsync(string messageId, string userId, string emoji);
        Task RemoveReactionAsync(string messageId, string userId, string emoji);
        Task RevokeMessageAsync(string messageId);
    }
}
