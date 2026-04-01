using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ChatCore.DTOs;
using ChatCore.Entities;
using ChatCore.Interfaces;
using ChatCore.Models;
using Microsoft.IdentityModel.Tokens;

namespace ChatCore.Services
{
    public class AuthService : IAuthService
    {
        private readonly IUserRepository _userRepo;
        private readonly JwtSettings _jwtSettings;

        public AuthService(IUserRepository userRepo, JwtSettings jwtSettings)
        {
            _userRepo = userRepo;
            _jwtSettings = jwtSettings;
        }

        public async Task<AuthResponseDto> RegisterAsync(RegisterDto dto)
        {
            var existingUser = await _userRepo.GetByUsernameAsync(dto.Username);
            if (existingUser != null)
                throw new Exception("Username already exists");

            var user = new User
            {
                Username = dto.Username,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                DisplayName = dto.DisplayName,
                CreatedAt = DateTime.UtcNow
            };

            await _userRepo.InsertAsync(user);

            var token = GenerateJwtToken(user);
            return new AuthResponseDto
            {
                Token = token,
                UserId = user.Id,
                DisplayName = user.DisplayName
            };
        }

        public async Task<AuthResponseDto> LoginAsync(LoginDto dto)
        {
            var user = await _userRepo.GetByUsernameAsync(dto.Username);
            if (user == null || !BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
                throw new Exception("Invalid username or password");

            var token = GenerateJwtToken(user);
            return new AuthResponseDto
            {
                Token = token,
                UserId = user.Id,
                DisplayName = user.DisplayName
            };
        }

        public async Task<UserViewDto?> GetMeAsync(string userId)
        {
            var user = await _userRepo.GetByIdAsync(userId);
            if (user == null) return null;

            return new UserViewDto
            {
                Id = user.Id,
                Username = user.Username,
                DisplayName = user.DisplayName,
                AvatarUrl = user.AvatarUrl,
                IsOnline = user.IsOnline
            };
        }

        public async Task UpdateProfileAsync(string userId, ProfileUpdateDto dto)
        {
            await _userRepo.UpdateProfileAsync(userId, dto.DisplayName, dto.AvatarUrl);
        }

        private string GenerateJwtToken(User user)
        {
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.SecretKey));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id),
                new Claim(ClaimTypes.Name, user.Username),
                new Claim("displayName", user.DisplayName)
            };

            var token = new JwtSecurityToken(
                issuer: _jwtSettings.Issuer,
                audience: _jwtSettings.Audience,
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(_jwtSettings.ExpirationInMinutes),
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
