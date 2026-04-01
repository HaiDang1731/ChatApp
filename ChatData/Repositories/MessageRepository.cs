using ChatCore.Entities;
using ChatCore.Interfaces;
using ChatData.Context;
using MongoDB.Driver;

namespace ChatData.Repositories
{
    public class MessageRepository : IMessageRepository
    {
        private readonly IMongoCollection<Message> _messages;

        public MessageRepository(MongoDbContext context)
        {
            _messages = context.Database.GetCollection<Message>("Messages");
        }

        public async Task InsertAsync(Message message)
        {
            await _messages.InsertOneAsync(message);
        }

        public async Task<List<Message>> GetMessagesAsync(string conversationId, int limit, DateTime? beforeCursor)
        {
            var filterBuilder = Builders<Message>.Filter;
            var filter = filterBuilder.Eq(m => m.ConversationId, conversationId);

            if (beforeCursor.HasValue)
            {
                filter &= filterBuilder.Lt(m => m.CreatedAt, beforeCursor.Value);
            }

            return await _messages.Find(filter)
                                  .SortByDescending(m => m.CreatedAt)
                                  .Limit(limit)
                                  .ToListAsync();
        }

        public async Task MarkAsReadAsync(string messageId, string userId)
        {
            var update = Builders<Message>.Update.AddToSet(m => m.ReadBy, userId);
            await _messages.UpdateOneAsync(m => m.Id == messageId, update);
        }

        public async Task MarkConversationAsReadAsync(string conversationId, string userId)
        {
            var filter = Builders<Message>.Filter.And(
                Builders<Message>.Filter.Eq(m => m.ConversationId, conversationId),
                Builders<Message>.Filter.Not(Builders<Message>.Filter.AnyEq(m => m.ReadBy, userId))
            );
            var update = Builders<Message>.Update.AddToSet(m => m.ReadBy, userId);
            await _messages.UpdateManyAsync(filter, update);
        }

        public async Task<long> GetUnreadCountAsync(string conversationId, string userId)
        {
            var filter = Builders<Message>.Filter.And(
                Builders<Message>.Filter.Eq(m => m.ConversationId, conversationId),
                Builders<Message>.Filter.Not(Builders<Message>.Filter.AnyEq(m => m.ReadBy, userId))
            );
            return await _messages.CountDocumentsAsync(filter);
        }

        public async Task<List<Message>> GetLastMessagesAsync(IEnumerable<string> conversationIds)
        {
            var result = new List<Message>();
            foreach(var cId in conversationIds)
            {
                var msg = await _messages.Find(m => m.ConversationId == cId)
                                         .SortByDescending(m => m.CreatedAt)
                                         .FirstOrDefaultAsync();
                if(msg != null) result.Add(msg);
            }
            return result;
        }

        public async Task AddReactionAsync(string messageId, MessageReaction reaction)
        {
            var update = Builders<Message>.Update.Push(m => m.Reactions, reaction);
            await _messages.UpdateOneAsync(m => m.Id == messageId, update);
        }

        public async Task RemoveReactionAsync(string messageId, string userId, string emoji)
        {
            var filter = Builders<Message>.Filter.And(
                Builders<Message>.Filter.Eq(m => m.Id, messageId),
                Builders<Message>.Filter.ElemMatch(m => m.Reactions, r => r.UserId == userId && r.Emoji == emoji)
            );
            var update = Builders<Message>.Update.PullFilter(m => m.Reactions, r => r.UserId == userId && r.Emoji == emoji);
            await _messages.UpdateOneAsync(m => m.Id == messageId, update);
        }

        public async Task RevokeMessageAsync(string messageId)
        {
            var update = Builders<Message>.Update
                .Set(m => m.IsRevoked, true)
                .Set(m => m.Content, "Tin nhắn đã bị thu hồi")
                .Set(m => m.Type, "revoked")
                .Set(m => m.Attachments, null)
                .Set(m => m.FileUrl, null);
            await _messages.UpdateOneAsync(m => m.Id == messageId, update);
        }
    }
}
