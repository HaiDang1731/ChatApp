using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace ChatCore.Entities
{
    public class Attachment
    {
        public string Url { get; set; } = string.Empty;
        public string Type { get; set; } = "image"; // image, file
        public string Name { get; set; } = string.Empty;
        public long Size { get; set; }
    }

    public class Message
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string Id { get; set; } = null!;

        [BsonRepresentation(BsonType.ObjectId)]
        public string ConversationId { get; set; } = null!;

        [BsonRepresentation(BsonType.ObjectId)]
        public string SenderId { get; set; } = null!;
        public string SenderDisplayName { get; set; } = string.Empty;
        public string? SenderAvatarUrl { get; set; }

        public string Type { get; set; } = "text"; // text, image, file, multiple
        public string Content { get; set; } = null!;
        public string? FileUrl { get; set; }
        public List<Attachment>? Attachments { get; set; }

        public List<MessageReaction> Reactions { get; set; } = new();
        public bool IsRevoked { get; set; } = false;

        public List<string> ReadBy { get; set; } = new();
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
