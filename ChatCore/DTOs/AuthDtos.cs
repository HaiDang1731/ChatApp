namespace ChatCore.DTOs
{
    public class LoginDto
    {
        public string Username { get; set; } = null!;
        public string Password { get; set; } = null!;
    }

    public class RegisterDto
    {
        public string Username { get; set; } = null!;
        public string Password { get; set; } = null!;
        public string DisplayName { get; set; } = null!;
    }

    public class AuthResponseDto
    {
        public string Token { get; set; } = null!;
        public string UserId { get; set; } = null!;
        public string DisplayName { get; set; } = null!;
<<<<<<< HEAD
        public string? AvatarUrl { get; set; }
=======
>>>>>>> 776a671ba98a0f6128fc16be630f40bec2eaed64
    }
}
