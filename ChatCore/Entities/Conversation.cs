using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace ChatCore.Entities
{
    public class Conversation
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string Id { get; set; } = null!;

        public string Type { get; set; } = "direct"; // direct, group
        public string? Name { get; set; }
<<<<<<< HEAD
        public string? AdminId { get; set; } // The creator/admin of the group
=======
>>>>>>> 776a671ba98a0f6128fc16be630f40bec2eaed64
        public List<string> Members { get; set; } = new();

        [BsonRepresentation(BsonType.ObjectId)]
        public string? LastMessageId { get; set; }

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
