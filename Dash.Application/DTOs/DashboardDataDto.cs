namespace Dash.Application.DTOs;

public sealed record DashboardDataDto(
    ChartDatasetDto MonthlyRevenue,
    ChartDatasetDto RevenueByCategory,
    ChartDatasetDto OrdersByStatus);
