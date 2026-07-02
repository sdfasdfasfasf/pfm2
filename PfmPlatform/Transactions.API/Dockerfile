FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["Transactions.API/Transactions.API.csproj", "Transactions.API/"]
COPY ["Transactions.Messaging/Transactions.Messaging.csproj", "Transactions.Messaging/"]
RUN dotnet restore "Transactions.API/Transactions.API.csproj"
COPY . .
WORKDIR "/src/Transactions.API"
RUN dotnet build "Transactions.API.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "Transactions.API.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Transactions.API.dll"]