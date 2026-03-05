namespace Dash.Application.Abstractions.Persistence;

public interface ISalesAnalyticsRepository
{
    Task<IReadOnlyList<MonthlyRevenuePoint>> GetMonthlyRevenueAsync(
        DateTime startAtUtc,
        DateTime endAtUtc,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<CategoryRevenuePoint>> GetRevenueByCategoryAsync(
        DateTime startAtUtc,
        DateTime endAtUtc,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<OrderStatusPoint>> GetOrderStatusTotalsAsync(
        DateTime startAtUtc,
        DateTime endAtUtc,
        CancellationToken cancellationToken);
}

public sealed record MonthlyRevenuePoint(int Year, int Month, decimal Revenue);

public sealed record CategoryRevenuePoint(string Category, decimal Revenue);

public sealed record OrderStatusPoint(string Status, int Total);
