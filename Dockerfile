# Build Stage
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY ["ChatAPI/ChatAPI.csproj", "ChatAPI/"]
COPY ["ChatCore/ChatCore.csproj", "ChatCore/"]
COPY ["ChatData/ChatData.csproj", "ChatData/"]
RUN dotnet restore "ChatAPI/ChatAPI.csproj"

COPY . .
WORKDIR "/src/ChatAPI"
RUN dotnet publish "ChatAPI.csproj" -c Release -o /app/publish

# Runtime Stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

ENV PORT=10000
EXPOSE 10000

CMD ["dotnet", "ChatAPI.dll"]
