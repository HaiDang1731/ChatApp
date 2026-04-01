using ChatCore.Entities;
using ChatCore.Enums;
using ChatCore.Interfaces;
using ChatData.Context;
using MongoDB.Driver;

namespace ChatData.Repositories
{
    public class FriendshipRepository : IFriendshipRepository
    {
        private readonly IMongoCollection<Friendship> _friendships;

        public FriendshipRepository(MongoDbContext context)
        {
            _friendships = context.Database.GetCollection<Friendship>("Friendships");
        }

        public async Task<Friendship?> GetFriendshipAsync(string user1Id, string user2Id)
        {
            var filter = Builders<Friendship>.Filter.Or(
                Builders<Friendship>.Filter.And(
                    Builders<Friendship>.Filter.Eq(f => f.RequesterId, user1Id),
                    Builders<Friendship>.Filter.Eq(f => f.ReceiverId, user2Id)
                ),
                Builders<Friendship>.Filter.And(
                    Builders<Friendship>.Filter.Eq(f => f.RequesterId, user2Id),
                    Builders<Friendship>.Filter.Eq(f => f.ReceiverId, user1Id)
                )
            );

            return await _friendships.Find(filter).FirstOrDefaultAsync();
        }

        public async Task<IEnumerable<Friendship>> GetUserFriendshipsAsync(string userId)
        {
            var filter = Builders<Friendship>.Filter.And(
                Builders<Friendship>.Filter.Or(
                    Builders<Friendship>.Filter.Eq(f => f.RequesterId, userId),
                    Builders<Friendship>.Filter.Eq(f => f.ReceiverId, userId)
                ),
                Builders<Friendship>.Filter.Eq(f => f.Status, FriendshipStatus.Accepted)
            );

            return await _friendships.Find(filter).ToListAsync();
        }

        public async Task<IEnumerable<Friendship>> GetPendingRequestsAsync(string userId)
        {
            var filter = Builders<Friendship>.Filter.And(
                Builders<Friendship>.Filter.Eq(f => f.ReceiverId, userId),
                Builders<Friendship>.Filter.Eq(f => f.Status, FriendshipStatus.Pending)
            );

            return await _friendships.Find(filter).ToListAsync();
        }

        public async Task CreateFriendshipAsync(Friendship friendship)
        {
            await _friendships.InsertOneAsync(friendship);
        }

        public async Task UpdateFriendshipStatusAsync(string id, FriendshipStatus status)
        {
            var update = Builders<Friendship>.Update
                .Set(f => f.Status, status)
                .Set(f => f.UpdatedAt, DateTime.UtcNow);

            await _friendships.UpdateOneAsync(f => f.Id == id, update);
        }

        public async Task DeleteFriendshipAsync(string id)
        {
            await _friendships.DeleteOneAsync(f => f.Id == id);
        }

        public async Task<IEnumerable<string>> GetFriendIdsAsync(string userId)
        {
            var friendships = await GetUserFriendshipsAsync(userId);
            return friendships.Select(f => f.RequesterId == userId ? f.ReceiverId : f.RequesterId);
        }
    }
}
