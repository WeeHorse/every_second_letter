using EverySecondLetter.Core.WordGame;
using EverySecondLetter.Games.EverySecondLetter;
using EverySecondLetter.Services;
using EverySecondLetter.Services.Database;

namespace EverySecondLetter.Api;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddGameDependencies(this IServiceCollection services, DatabaseSettings dbSettings)
    {
        services.AddSingleton(dbSettings);

        if (dbSettings.Provider == DbProvider.Sqlite)
        {
            services.AddSingleton<IDbConnectionFactory>(_ => new SqliteConnectionFactory(dbSettings.ConnectionString));
            services.AddSingleton<ISqlDialect, SqliteSqlDialect>();
        }
        else
        {
            services.AddSingleton<IDbConnectionFactory>(_ => new NpgsqlConnectionFactory(dbSettings.ConnectionString));
            services.AddSingleton<ISqlDialect, PostgresSqlDialect>();
        }

        services.AddSingleton<WordsService>();
        services.AddSingleton<EverySecondLetterRules>();
        services.AddSingleton<WordGameRules>(sp => sp.GetRequiredService<EverySecondLetterRules>());
        services.AddSingleton<JoinGameEngine>();
        services.AddSingleton<StartGameEngine>();
        services.AddSingleton<PlayLetterEngine>();
        services.AddSingleton<ClaimResolutionEngine>();
        services.AddSingleton<GamesService>();

        return services;
    }
}
