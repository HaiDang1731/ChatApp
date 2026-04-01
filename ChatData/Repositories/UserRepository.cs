using ChatCore.Entities;
using ChatCore.Interfaces;
using ChatData.Context;
using MongoDB.Driver;

namespace ChatData.Repositories
{
    public class UserRepository : IUserRepository
    {
        private readonly IMongoCollection<User> _users;

        public UserRepository(MongoDbContext context)
        {
            _users = context.Database.GetCollection<User>("Users");
        }

        public async Task<User?> GetByIdAsync(string id)
        {
            return await _users.Find(u => u.Id == id).FirstOrDefaultAsync();
        }

        public async Task<User?> GetByUsernameAsync(string username)
        {
            return await _users.Find(u => u.Username == username).FirstOrDefaultAsync();
        }

        public async Task<List<User>> GetAllAsync()
        {
            return await _users.Find(_ => true).ToListAsync();
        }

        public async Task<List<User>> GetByIdsAsync(IEnumerable<string> ids)
        {
            var filter = Builders<User>.Filter.In(u => u.Id, ids);
            return await _users.Find(filter).ToListAsync();
        }

        public async Task<List<User>> SearchUsersAsync(string query, string excludeUserId)
        {
             var filter = Builders<User>.Filter.And(
                Builders<User>.Filter.Ne(u => u.Id, excludeUserId),
                Builders<User>.Filter.Or(
                    Builders<User>.Filter.Regex(u => u.Username, new MongoDB.Bson.BsonRegularExpression(query, "i")),
                    Builders<User>.Filter.Regex(u => u.DisplayName, new MongoDB.Bson.BsonRegularExpression(query, "i"))
                )
             );
             return await _users.Find(filter).Limit(20).ToListAsync();
        }

        public async Task InsertAsync(User user)
        {
            await _users.InsertOneAsync(user);
        }

        public async Task UpdateOnlineStatusAsync(string userId, bool isOnline)
        {
            var update = Builders<User>.Update
                .Set(u => u.IsOnline, isOnline)
                .Set(u => u.LastOnline, DateTime.UtcNow);

            await _users.UpdateOneAsync(u => u.Id == userId, update);
        }

        public async Task UpdateProfileAsync(string userId, string displayName, string? avatarUrl)
        {
            var update = Builders<User>.Update
                .Set(u => u.DisplayName, displayName)
                .Set(u => u.AvatarUrl, avatarUrl);

            await _users.UpdateOneAsync(u => u.Id == userId, update);
        }
    }
}
