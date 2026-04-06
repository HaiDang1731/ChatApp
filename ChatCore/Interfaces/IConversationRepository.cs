using ChatCore.Entities;

namespace ChatCore.Interfaces
{
    public interface IConversationRepository
    {
        Task<Conversation?> GetByIdAsync(string id);
        Task<List<Conversation>> GetByUserIdAsync(string userId);
        Task<Conversation?> GetDirectConversationAsync(string userId1, string userId2);
        Task InsertAsync(Conversation conversation);
        Task UpdateLastMessageAsync(string conversationId, string messageId);
        Task<List<string>> GetMemberIdsAsync(string conversationId);
        Task<List<Conversation>> SearchGroupsAsync(string userId, string query);
<<<<<<< HEAD
        Task UpdateAsync(Conversation conversation);
=======
>>>>>>> 776a671ba98a0f6128fc16be630f40bec2eaed64
    }
}
