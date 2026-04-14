# Stage 1: Build the React frontend
# Vite's outDir is configured to ../Server/wwwroot, so the output lands there automatically
FROM node:22-alpine AS frontend-builder
WORKDIR /src
COPY Frontend/package*.json ./Frontend/
RUN cd Frontend && npm ci
COPY Frontend/ ./Frontend/
RUN cd Frontend && npm run build

# Stage 2: Build the .NET backend and bundle with the frontend output
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS backend-builder
WORKDIR /src
COPY Server/*.csproj ./Server/
RUN cd Server && dotnet restore
COPY Server/ ./Server/
# Copy the frontend build output (from stage 1) into wwwroot
COPY --from=frontend-builder /src/Server/wwwroot/ ./Server/wwwroot/
RUN cd Server && dotnet publish -c Release -o /app/publish --no-restore

# Stage 3: Minimal runtime image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=backend-builder /app/publish .

# Render sets PORT dynamically at runtime; ASPNETCORE_URLS picks it up.
# SQLite DB is ephemeral — it resets on every restart/redeploy (intentional).
CMD ["sh", "-c", "ASPNETCORE_URLS=http://+:${PORT:-10000} dotnet EverySecondLetter.dll"]
