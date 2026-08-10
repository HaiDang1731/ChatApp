namespace ChatCore.DTOs
{
    public class AttachmentDto
    {
        public string Url { get; set; } = string.Empty;
        public string Type { get; set; } = "image";
        public string Name { get; set; } = string.Empty;
        public long Size { get; set; }
    }

    public class MessageViewDto
    {
        public string Id { get; set; } = string.Empty;
        public string SenderId { get; set; } = string.Empty;
        public string? SenderDisplayName { get; set; }
        public string? SenderAvatarUrl { get; set; }
        public string Content { get; set; } = string.Empty;
        public string Type { get; set; } = "text"; // text, image, file, multiple
        public List<AttachmentDto> Attachments { get; set; } = new();
        public List<ReactionDto> Reactions { get; set; } = new();
        public bool IsRevoked { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class ReactionDto
    {
        public string UserId { get; set; } = string.Empty;
        public string Emoji { get; set; } = string.Empty;
    }

    public class ConversationViewDto
    {
        public string Id { get; set; } = string.Empty;
        public string Type { get; set; } = "direct"; // direct, group
        public string? TargetUserId { get; set; }
        public string TargetDisplayName { get; set; } = string.Empty;
        public string? TargetUsername { get; set; }
        public string? TargetAvatarUrl { get; set; }
        public bool IsTargetOnline { get; set; }
        public int MemberCount { get; set; }
        public string? LastMessageId { get; set; }
        public string? LastMessageContent { get; set; }
        public int UnreadCount { get; set; }
        public string? AdminId { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class UserViewDto
    {
        public string Id { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string? AvatarUrl { get; set; }
        public bool IsOnline { get; set; }
    }

    public class CreateGroupDto
    {
        public string Name { get; set; } = string.Empty;
        public List<string> UserIds { get; set; } = new();
    }

    public class AddGroupMembersDto
    {
        public List<string> UserIds { get; set; } = new();
    }
    public class ProfileUpdateDto
    {
        public string DisplayName { get; set; } = string.Empty;
        public string? AvatarUrl { get; set; }
    }

    public class SendMessageDto
    {
        public string ConversationId { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string Type { get; set; } = "text"; 
        public string? FileUrl { get; set; } // Backward compatibility
        public List<AttachmentDto>? Attachments { get; set; }
    }
}
