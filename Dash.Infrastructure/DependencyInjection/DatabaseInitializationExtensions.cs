using Dash.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Dash.Infrastructure.DependencyInjection;

public static class DatabaseInitializationExtensions
{
    public static async Task EnsureDatabaseReadyAsync(this IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await dbContext.Database.EnsureCreatedAsync();
        await AppDbSeeder.SeedAsync(dbContext);
    }
}
