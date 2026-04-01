using ChatCore.Entities;

namespace ChatCore.Interfaces
{
    public interface IUserRepository
    {
        Task<User?> GetByIdAsync(string id);
        Task<User?> GetByUsernameAsync(string username);
        Task<List<User>> GetAllAsync();
        Task<List<User>> GetByIdsAsync(IEnumerable<string> ids);
        Task<List<User>> SearchUsersAsync(string query, string excludeUserId);
        Task InsertAsync(User user);
        Task UpdateOnlineStatusAsync(string userId, bool isOnline);
        Task UpdateProfileAsync(string userId, string displayName, string? avatarUrl);
    }
}
