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

# Optimize .NET 9 runtime for low-memory containers & Linux inotify file descriptor limits (Render 512MB RAM limit)
# DOTNET_HOSTBUILDER__RELOADCONFIGONCHANGE=false: Prevents inotify limit 128 crash (System.IO.IOException)
# DOTNET_gcServer=0: Workstation GC (consumes ~50-80MB RAM vs 350MB+)
# DOTNET_GCHeapHardLimit=1C000000: Cap GC heap at 448MB (0x1C000000 bytes)
ENV DOTNET_HOSTBUILDER__RELOADCONFIGONCHANGE=false \
    ASPNETCORE_HOSTBUILDER__RELOADCONFIGONCHANGE=false \
    DOTNET_USE_POLLING_FILE_WATCHER=true \
    DOTNET_gcServer=0 \
    DOTNET_System_GC_Server=0 \
    DOTNET_GCHeapHardLimit=1C000000 \
    DOTNET_EnableDiagnostics=0 \
    PORT=10000

EXPOSE 10000

CMD ["dotnet", "ChatAPI.dll"]



