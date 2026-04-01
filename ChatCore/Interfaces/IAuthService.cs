using ChatCore.DTOs;

namespace ChatCore.Interfaces
{
    public interface IAuthService
    {
        Task<AuthResponseDto> RegisterAsync(RegisterDto dto);
        Task<AuthResponseDto> LoginAsync(LoginDto dto);
        Task<UserViewDto?> GetMeAsync(string userId);
        Task UpdateProfileAsync(string userId, ProfileUpdateDto dto);
    }
}
