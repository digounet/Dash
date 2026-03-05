using Dash.Application.Abstractions.Services;
using Dash.Application.Features.Dashboard;
using Dash.Application.Features.Layouts;
using Dash.Application.Features.Users;
using Microsoft.Extensions.DependencyInjection;

namespace Dash.Application;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IUserQueryService, UserQueryService>();
        services.AddScoped<IDashboardQueryService, DashboardQueryService>();
        services.AddScoped<IDashboardLayoutService, DashboardLayoutService>();
        return services;
    }
}
