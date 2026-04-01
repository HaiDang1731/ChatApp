namespace ChatCore.Entities
{
    public class MessageReaction
    {
        public string UserId { get; set; } = string.Empty;
        public string Emoji { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
