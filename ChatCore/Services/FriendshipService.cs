using ChatCore.Entities;
using ChatCore.Enums;
using ChatCore.Interfaces;
using ChatCore.DTOs;

namespace ChatCore.Services
{
    public class FriendshipService : IFriendshipService
    {
        private readonly IFriendshipRepository _friendshipRepository;
        private readonly IUserRepository _userRepository;

        public FriendshipService(IFriendshipRepository friendshipRepository, IUserRepository userRepository)
        {
            _friendshipRepository = friendshipRepository;
            _userRepository = userRepository;
        }

        public async Task<Friendship> SendRequestAsync(string requesterId, string receiverId)
        {
            if (requesterId == receiverId)
                throw new Exception("You cannot send a friend request to yourself.");

            var existing = await _friendshipRepository.GetFriendshipAsync(requesterId, receiverId);
            if (existing != null)
            {
                if (existing.Status == FriendshipStatus.Accepted)
                    throw new Exception("You are already friends.");
                if (existing.Status == FriendshipStatus.Pending && existing.RequesterId == requesterId)
                    throw new Exception("Friend request already sent.");
                
                // If it was declined or receiver already sent a request, we might want to handle it differently
                // For simplicity, if receiver already sent one, just accept it? 
                // Or if it was declined, let it be resent.
                if (existing.Status == FriendshipStatus.Declined || existing.Status == FriendshipStatus.Pending)
                {
                    await _friendshipRepository.UpdateFriendshipStatusAsync(existing.Id, FriendshipStatus.Pending);
                    existing.Status = FriendshipStatus.Pending;
                    existing.RequesterId = requesterId;
                    existing.ReceiverId = receiverId;
                    // Logic to update requester/receiver if swapped could be here
                    return existing;
                }
            }

            var friendship = new Friendship
            {
                RequesterId = requesterId,
                ReceiverId = receiverId,
                Status = FriendshipStatus.Pending
            };

            await _friendshipRepository.CreateFriendshipAsync(friendship);
            return friendship;
        }

        public async Task AcceptRequestAsync(string userId, string requesterId)
        {
            var friendship = await _friendshipRepository.GetFriendshipAsync(userId, requesterId);
            if (friendship == null || friendship.ReceiverId != userId || friendship.Status != FriendshipStatus.Pending)
                throw new Exception("No pending friend request found.");

            await _friendshipRepository.UpdateFriendshipStatusAsync(friendship.Id, FriendshipStatus.Accepted);
        }

        public async Task DeclineRequestAsync(string userId, string requesterId)
        {
            var friendship = await _friendshipRepository.GetFriendshipAsync(userId, requesterId);
            if (friendship == null || friendship.ReceiverId != userId || friendship.Status != FriendshipStatus.Pending)
                throw new Exception("No pending friend request found.");

            await _friendshipRepository.UpdateFriendshipStatusAsync(friendship.Id, FriendshipStatus.Declined);
        }

        public async Task RemoveFriendAsync(string userId, string friendId)
        {
            var friendship = await _friendshipRepository.GetFriendshipAsync(userId, friendId);
            if (friendship == null || friendship.Status != FriendshipStatus.Accepted)
                throw new Exception("You are not friends with this user.");

            await _friendshipRepository.DeleteFriendshipAsync(friendship.Id);
        }

        public async Task<IEnumerable<UserViewDto>> GetFriendsAsync(string userId)
        {
            var friendIds = await _friendshipRepository.GetFriendIdsAsync(userId);
            var friends = await _userRepository.GetByIdsAsync(friendIds);
            
            return friends.Select(u => new UserViewDto
            {
                Id = u.Id,
                Username = u.Username,
                DisplayName = u.DisplayName,
                AvatarUrl = u.AvatarUrl,
                IsOnline = u.IsOnline
            });
        }

        public async Task<IEnumerable<UserViewDto>> GetPendingRequestsAsync(string userId)
        {
            var requests = await _friendshipRepository.GetPendingRequestsAsync(userId);
            var requesterIds = requests.Select(r => r.RequesterId);
            var requesters = await _userRepository.GetByIdsAsync(requesterIds);

            return requesters.Select(u => new UserViewDto
            {
                Id = u.Id,
                Username = u.Username,
                DisplayName = u.DisplayName,
                AvatarUrl = u.AvatarUrl,
                IsOnline = u.IsOnline
            });
        }

        public async Task<bool> IsFriendWithAsync(string userId, string targetId)
        {
            var friendship = await _friendshipRepository.GetFriendshipAsync(userId, targetId);
            return friendship != null && friendship.Status == FriendshipStatus.Accepted;
        }
    }
}
