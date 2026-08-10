# Build Stage
FROM mcr.microsoft.com/dotnet/sdk:9.0-alpine AS build
WORKDIR /src

# Copy csproj files and restore
COPY ["ChatAPI/ChatAPI.csproj", "ChatAPI/"]
COPY ["ChatCore/ChatCore.csproj", "ChatCore/"]
COPY ["ChatData/ChatData.csproj", "ChatData/"]
RUN dotnet restore "ChatAPI/ChatAPI.csproj"

# Copy full source and build
COPY . .
WORKDIR "/src/ChatAPI"
RUN dotnet publish "ChatAPI.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Runtime Stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0-alpine AS final
WORKDIR /app
COPY --from=build /app/publish .

ENV PORT=5281
ENV ASPNETCORE_URLS=http://+:5281

ENTRYPOINT ["dotnet", "ChatAPI.dll"]
