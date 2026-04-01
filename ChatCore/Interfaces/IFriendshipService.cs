using ChatCore.Entities;
using ChatCore.Enums;
using ChatCore.DTOs;

namespace ChatCore.Interfaces
{
    public interface IFriendshipService
    {
        Task<Friendship> SendRequestAsync(string requesterId, string receiverId);
        Task AcceptRequestAsync(string userId, string requesterId);
        Task DeclineRequestAsync(string userId, string requesterId);
        Task RemoveFriendAsync(string userId, string friendId);
        Task<IEnumerable<UserViewDto>> GetFriendsAsync(string userId);
        Task<IEnumerable<UserViewDto>> GetPendingRequestsAsync(string userId);
        Task<bool> IsFriendWithAsync(string userId, string targetId);
    }
}
