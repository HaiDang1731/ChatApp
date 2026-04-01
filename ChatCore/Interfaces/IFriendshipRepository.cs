using ChatCore.Entities;
using ChatCore.Enums;

namespace ChatCore.Interfaces
{
    public interface IFriendshipRepository
    {
        Task<Friendship?> GetFriendshipAsync(string user1Id, string user2Id);
        Task<IEnumerable<Friendship>> GetUserFriendshipsAsync(string userId);
        Task<IEnumerable<Friendship>> GetPendingRequestsAsync(string userId);
        Task CreateFriendshipAsync(Friendship friendship);
        Task UpdateFriendshipStatusAsync(string id, FriendshipStatus status);
        Task DeleteFriendshipAsync(string id);
        Task<IEnumerable<string>> GetFriendIdsAsync(string userId);
    }
}
