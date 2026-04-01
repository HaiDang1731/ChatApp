using ChatCore.DTOs;
using ChatCore.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ChatAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ChatController : ControllerBase
    {
        private readonly IChatService _chatService;
        private readonly IUserRepository _userRepo;
        private readonly IConversationRepository _convRepo;
        private readonly IMessageRepository _messageRepo;

        public ChatController(IChatService chatService, IUserRepository userRepo, IConversationRepository convRepo, IMessageRepository messageRepo)
        {
            _chatService = chatService;
            _userRepo = userRepo;
            _convRepo = convRepo;
            _messageRepo = messageRepo;
        }

        [HttpGet("conversations")]
        public async Task<IActionResult> GetConversations()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null) return Unauthorized();

            var conversations = await _chatService.GetUserConversationsAsync(userId);
            
            // Gather unique user IDs to fetch their display names
            var targetUserIds = conversations
                .SelectMany(c => c.Members)
                .Where(mId => mId != userId)
                .Distinct()
                .ToList();

            var targetUsers = await _userRepo.GetByIdsAsync(targetUserIds);
            var userMap = targetUsers.ToDictionary(u => u.Id, u => u);

            var lastMessages = await _messageRepo.GetLastMessagesAsync(conversations.Select(c => c.Id));
            var lastMsgMap = lastMessages.ToDictionary(m => m.ConversationId, m => m);

            var views = new List<ConversationViewDto>();
            foreach (var conv in conversations)
            {
                var unreadCount = await _messageRepo.GetUnreadCountAsync(conv.Id, userId);
                lastMsgMap.TryGetValue(conv.Id, out var lastMsg);

                if (conv.Type == "group")
                {
                    views.Add(new ConversationViewDto
                    {
                        Id = conv.Id,
                        Type = "group",
                        TargetDisplayName = conv.Name ?? "Group Chat",
                        MemberCount = conv.Members.Count,
                        LastMessageId = conv.LastMessageId,
                        LastMessageContent = lastMsg?.Content,
                        UnreadCount = (int)unreadCount,
                        UpdatedAt = conv.UpdatedAt
                    });
                }
                else 
                {
                    var otherMemberId = conv.Members.FirstOrDefault(m => m != userId);
                    if (otherMemberId != null && userMap.TryGetValue(otherMemberId, out var otherUser))
                    {
                        views.Add(new ConversationViewDto
                        {
                            Id = conv.Id,
                            Type = "direct",
                            TargetUserId = otherUser.Id,
                            TargetDisplayName = otherUser.DisplayName,
                            TargetUsername = otherUser.Username,
                            IsTargetOnline = otherUser.IsOnline,
                            MemberCount = 2,
                            LastMessageId = conv.LastMessageId,
                            LastMessageContent = lastMsg?.Content,
                            UnreadCount = (int)unreadCount,
                            UpdatedAt = conv.UpdatedAt
                        });
                    }
                }
            }

            return Ok(views.OrderByDescending(v => v.UpdatedAt));
        }

        [HttpGet("messages/{conversationId}")]
        public async Task<IActionResult> GetMessages(string conversationId, [FromQuery] int limit = 50, [FromQuery] DateTime? beforeCursor = null)
        {
            var messages = await _chatService.GetMessagesAsync(conversationId, limit, beforeCursor);
            return Ok(messages);
        }

        [HttpGet("users/search")]
        public async Task<IActionResult> SearchUsers([FromQuery] string q)
        {
            if (string.IsNullOrWhiteSpace(q))
                return Ok(new List<UserViewDto>());

            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (currentUserId == null) return Unauthorized();

            var users = await _userRepo.SearchUsersAsync(q, currentUserId);
            var userViews = users.Select(u => new UserViewDto
            {
                Id = u.Id,
                Username = u.Username,
                DisplayName = u.DisplayName,
                IsOnline = u.IsOnline
            });

            return Ok(userViews);
        }

        [HttpPost("conversation/direct/{targetUserId}")]
        public async Task<IActionResult> StartDirectConversation(string targetUserId)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (currentUserId == null) return Unauthorized();

            var conv = await _convRepo.GetDirectConversationAsync(currentUserId, targetUserId);
            if (conv == null)
            {
                conv = new ChatCore.Entities.Conversation
                {
                    Type = "direct",
                    Members = new List<string> { currentUserId, targetUserId }
                };
                await _convRepo.InsertAsync(conv);
            }
            return Ok(conv);
        }

        [HttpGet("groups/search")]
        public async Task<IActionResult> SearchGroups([FromQuery] string q)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null) return Unauthorized();

            var groups = await _convRepo.SearchGroupsAsync(userId, q);
            var views = groups.Select(g => new ConversationViewDto
            {
                Id = g.Id,
                Type = "group",
                TargetDisplayName = g.Name ?? "Group Chat",
                MemberCount = g.Members.Count,
                LastMessageId = g.LastMessageId,
                UpdatedAt = g.UpdatedAt
            });

            return Ok(views);
        }

        [HttpPost("conversation/group")]
        public async Task<IActionResult> CreateGroup([FromBody] CreateGroupDto dto)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null) return Unauthorized();

            var members = dto.UserIds.Distinct().ToList();
            if (!members.Contains(userId)) members.Add(userId);

            var conv = new ChatCore.Entities.Conversation
            {
                Type = "group",
                Name = dto.Name,
                Members = members,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _convRepo.InsertAsync(conv);
            return Ok(conv);
        }
    }
}
