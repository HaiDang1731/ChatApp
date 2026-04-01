// ChatCore - Entities/User.cs
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace ChatCore.Entities
{
    public class User
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string Id { get; set; } = null!;

        public string Username { get; set; } = null!;
        public string PasswordHash { get; set; } = null!;
        public string DisplayName { get; set; } = null!;
        public string? AvatarUrl { get; set; }
        public bool IsOnline { get; set; }
        public DateTime LastOnline { get; set; } = DateTime.UtcNow;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
