namespace Dash.Application.DTOs;

public sealed record ChartDatasetDto(
    string Title,
    IReadOnlyList<string> Labels,
    IReadOnlyList<decimal> Values);
