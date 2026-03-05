using System.Globalization;
using Dash.Application.Abstractions.Persistence;
using Dash.Application.Abstractions.Services;
using Dash.Application.DTOs;

namespace Dash.Application.Features.Dashboard;

public sealed class DashboardQueryService(ISalesAnalyticsRepository analyticsRepository) : IDashboardQueryService
{
    private static readonly string[] StatusOrder = ["Pending", "Confirmed", "Delivered", "Cancelled"];
    private static readonly CultureInfo PtBr = new("pt-BR");

    public async Task<DashboardDataDto> GetDashboardDataAsync(CancellationToken cancellationToken)
    {
        var utcNow = DateTime.UtcNow;
        var startAtUtc = new DateTime(utcNow.Year, utcNow.Month, 1).AddMonths(-5);
        var endAtUtc = utcNow;

        var monthlyRevenue = await analyticsRepository.GetMonthlyRevenueAsync(startAtUtc, endAtUtc, cancellationToken);
        var revenueByCategory = await analyticsRepository.GetRevenueByCategoryAsync(startAtUtc, endAtUtc, cancellationToken);
        var statusTotals = await analyticsRepository.GetOrderStatusTotalsAsync(startAtUtc, endAtUtc, cancellationToken);

        var monthLabels = new List<string>(capacity: 6);
        var monthValues = new List<decimal>(capacity: 6);
        var revenueLookup = monthlyRevenue.ToDictionary(
            point => $"{point.Year:D4}-{point.Month:D2}",
            point => point.Revenue);

        for (var i = 0; i < 6; i++)
        {
            var month = startAtUtc.AddMonths(i);
            var key = $"{month.Year:D4}-{month.Month:D2}";
            monthLabels.Add(month.ToString("MMM/yy", PtBr));
            monthValues.Add(revenueLookup.GetValueOrDefault(key));
        }

        var categoryLabels = revenueByCategory.Select(item => item.Category).ToList();
        var categoryValues = revenueByCategory.Select(item => item.Revenue).ToList();

        var statusLookup = statusTotals.ToDictionary(
            item => item.Status,
            item => (decimal)item.Total,
            StringComparer.OrdinalIgnoreCase);
        var statusLabels = StatusOrder.ToList();
        var statusValues = StatusOrder
            .Select(label => statusLookup.GetValueOrDefault(label, 0))
            .ToList();

        return new DashboardDataDto(
            new ChartDatasetDto("Receita Mensal", monthLabels, monthValues),
            new ChartDatasetDto("Receita por Categoria", categoryLabels, categoryValues),
            new ChartDatasetDto("Pedidos por Status", statusLabels, statusValues));
    }
}
