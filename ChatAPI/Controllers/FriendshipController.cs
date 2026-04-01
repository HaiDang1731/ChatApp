using ChatAPI.Hubs;
using ChatCore.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

namespace ChatAPI.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class FriendshipController : ControllerBase
    {
        private readonly IFriendshipService _friendshipService;
        private readonly IHubContext<ChatHub> _hubContext;

        public FriendshipController(IFriendshipService friendshipService, IHubContext<ChatHub> hubContext)
        {
            _friendshipService = friendshipService;
            _hubContext = hubContext;
        }

        [HttpPost("request/{receiverId}")]
        public async Task<IActionResult> SendFriendRequest(string receiverId)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null) return Unauthorized();

            try
            {
                var friendship = await _friendshipService.SendRequestAsync(userId, receiverId);
                
                // Notify receiver via SignalR
                await _hubContext.Clients.Group(receiverId).SendAsync("FriendRequestReceived", userId);
                
                return Ok(new { message = "Friend request sent successfully." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("accept/{requesterId}")]
        public async Task<IActionResult> AcceptFriendRequest(string requesterId)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null) return Unauthorized();

            try
            {
                await _friendshipService.AcceptRequestAsync(userId, requesterId);
                
                // Notify requester via SignalR
                await _hubContext.Clients.Group(requesterId).SendAsync("FriendRequestAccepted", userId);
                
                return Ok(new { message = "Friend request accepted." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("decline/{requesterId}")]
        public async Task<IActionResult> DeclineFriendRequest(string requesterId)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null) return Unauthorized();

            try
            {
                await _friendshipService.DeclineRequestAsync(userId, requesterId);
                return Ok(new { message = "Friend request declined." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("friends")]
        public async Task<IActionResult> GetFriends()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null) return Unauthorized();

            var friends = await _friendshipService.GetFriendsAsync(userId);
            return Ok(friends);
        }

        [HttpGet("pending")]
        public async Task<IActionResult> GetPendingRequests()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null) return Unauthorized();

            var requests = await _friendshipService.GetPendingRequestsAsync(userId);
            return Ok(requests);
        }

        [HttpDelete("{friendId}")]
        public async Task<IActionResult> RemoveFriend(string friendId)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null) return Unauthorized();

            try
            {
                await _friendshipService.RemoveFriendAsync(userId, friendId);
                return Ok(new { message = "Friend removed." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}
