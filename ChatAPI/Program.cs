using ChatAPI.Hubs;
using ChatCore.Interfaces;
using ChatCore.Models;
using ChatCore.Services;
using ChatData.Context;
using ChatData.Repositories;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Disable reloadOnChange to prevent Linux inotify file handle limit (128) crashes on Render
builder.Host.ConfigureAppConfiguration((hostingContext, config) =>
{
    foreach (var source in config.Sources.OfType<Microsoft.Extensions.Configuration.FileConfigurationSource>())
    {
        source.ReloadOnChange = false;
    }
});

var port = Environment.GetEnvironmentVariable("PORT") ?? "5281";
builder.WebHost.UseUrls($"http://*:{port}");


// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
// builder.Services.AddSwaggerGen();

// Configure Settings
var jwtSettings = new JwtSettings();
builder.Configuration.GetSection("JwtSettings").Bind(jwtSettings);
if (string.IsNullOrEmpty(jwtSettings.SecretKey))
{
    jwtSettings.SecretKey = builder.Configuration["JwtSettings__SecretKey"] ?? "SuperSecretKeyForChatAppNeedsToBeLongEnough";
    jwtSettings.Issuer = builder.Configuration["JwtSettings__Issuer"] ?? "ChatAppAPI";
    jwtSettings.Audience = builder.Configuration["JwtSettings__Audience"] ?? "ChatAppClient";
}
builder.Services.AddSingleton(jwtSettings);

var mongoConnStr = builder.Configuration["MongoDbSettings:ConnectionString"] 
    ?? builder.Configuration["MongoDbSettings__ConnectionString"] 
    ?? builder.Configuration["MONGODB_CONNECTION_STRING"]
    ?? "mongodb://localhost:27017";

var mongoDbName = builder.Configuration["MongoDbSettings:DatabaseName"] 
    ?? builder.Configuration["MongoDbSettings__DatabaseName"] 
    ?? builder.Configuration["MONGODB_DATABASE_NAME"]
    ?? "ChatDb";

builder.Services.Configure<MongoDbSettings>(options =>
{
    options.ConnectionString = mongoConnStr;
    options.DatabaseName = mongoDbName;
});

// Configure DI
builder.Services.AddSingleton<MongoDbContext>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IMessageRepository, MessageRepository>();
builder.Services.AddScoped<IConversationRepository, ConversationRepository>();
builder.Services.AddScoped<IFriendshipRepository, FriendshipRepository>();


builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IChatService, ChatService>();
builder.Services.AddScoped<IFriendshipService, FriendshipService>();


// Configure authentication
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings.Issuer,
        ValidAudience = jwtSettings.Audience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.SecretKey))
    };

    // Ensure SignalR can access JWT token from query string
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && 
                path.StartsWithSegments("/chatHub"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

// Add SignalR
builder.Services.AddSignalR();
// Add CORS for React Frontend
var allowedOriginsStr = builder.Configuration["ALLOWED_ORIGINS"] 
    ?? builder.Configuration["CorsSettings:AllowedOrigins"] 
    ?? "http://localhost:5173";
var allowedOrigins = allowedOriginsStr.Split(',', StringSplitOptions.RemoveEmptyEntries);

builder.Services.AddCors(options =>
{
    options.AddPolicy("CorsPolicy", policy =>
    {
        policy.WithOrigins(allowedOrigins) 
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
//    app.UseSwagger();
//    app.UseSwaggerUI();
}

// app.UseHttpsRedirection();

app.UseStaticFiles();

app.UseCors("CorsPolicy");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
// Maps SignalR Hubs
app.MapHub<ChatHub>("/chatHub");


app.Run();
