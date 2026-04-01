using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using ChatCore.Enums;

namespace ChatCore.Entities
{
    public class Friendship
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string Id { get; set; } = null!;

        [BsonRepresentation(BsonType.ObjectId)]
        public string RequesterId { get; set; } = null!;

        [BsonRepresentation(BsonType.ObjectId)]
        public string ReceiverId { get; set; } = null!;

        public FriendshipStatus Status { get; set; } = FriendshipStatus.Pending;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
