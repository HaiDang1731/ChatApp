using ChatCore.Entities;
using ChatCore.Interfaces;
using ChatData.Context;
using MongoDB.Driver;

namespace ChatData.Repositories
{
    public class ConversationRepository : IConversationRepository
    {
        private readonly IMongoCollection<Conversation> _conversations;

        public ConversationRepository(MongoDbContext context)
        {
            _conversations = context.Database.GetCollection<Conversation>("Conversations");
        }

        public async Task<Conversation?> GetByIdAsync(string id)
        {
            return await _conversations.Find(c => c.Id == id).FirstOrDefaultAsync();
        }

        public async Task<List<Conversation>> GetByUserIdAsync(string userId)
        {
            return await _conversations.Find(c => c.Members.Contains(userId))
                                       .SortByDescending(c => c.UpdatedAt)
                                       .ToListAsync();
        }

        public async Task<Conversation?> GetDirectConversationAsync(string userId1, string userId2)
        {
            var filter = Builders<Conversation>.Filter.And(
                Builders<Conversation>.Filter.Eq(c => c.Type, "direct"),
                Builders<Conversation>.Filter.All(c => c.Members, new[] { userId1, userId2 }),
                Builders<Conversation>.Filter.Size(c => c.Members, 2)
            );
            return await _conversations.Find(filter).FirstOrDefaultAsync();
        }

        public async Task InsertAsync(Conversation conversation)
        {
            await _conversations.InsertOneAsync(conversation);
        }

        public async Task UpdateLastMessageAsync(string conversationId, string messageId)
        {
            var update = Builders<Conversation>.Update
                .Set(c => c.LastMessageId, messageId)
                .Set(c => c.UpdatedAt, DateTime.UtcNow);

            await _conversations.UpdateOneAsync(c => c.Id == conversationId, update);
        }

        public async Task<List<string>> GetMemberIdsAsync(string conversationId)
        {
            var conv = await GetByIdAsync(conversationId);
            return conv?.Members ?? new List<string>();
        }

        public async Task<List<Conversation>> SearchGroupsAsync(string userId, string query)
        {
            var filter = Builders<Conversation>.Filter.And(
                Builders<Conversation>.Filter.Eq(c => c.Type, "group"),
                Builders<Conversation>.Filter.AnyEq(c => c.Members, userId),
                Builders<Conversation>.Filter.Regex(c => c.Name, new MongoDB.Bson.BsonRegularExpression(query, "i"))
            );

            return await _conversations.Find(filter).Limit(20).ToListAsync();
        }
    }
}
