using ChatCore.Entities;

namespace ChatCore.Interfaces
{
    public interface IMessageRepository
    {
        Task InsertAsync(Message message);
        Task<List<Message>> GetMessagesAsync(string conversationId, int limit, DateTime? beforeCursor);
        Task MarkAsReadAsync(string messageId, string userId);
        Task MarkConversationAsReadAsync(string conversationId, string userId);
        Task<long> GetUnreadCountAsync(string conversationId, string userId);
        Task<List<Message>> GetLastMessagesAsync(IEnumerable<string> conversationIds);
        
        Task AddReactionAsync(string messageId, MessageReaction reaction);
        Task RemoveReactionAsync(string messageId, string userId, string emoji);
        Task RevokeMessageAsync(string messageId);
    }
}
