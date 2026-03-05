namespace Dash.Application.DTOs;

public sealed record DashboardLayoutDto(
    int Id,
    string Name,
    string LayoutJson,
    bool IsShared,
    bool IsDefault,
    int OwnerUserId,
    string OwnerName,
    DateTime UpdatedAtUtc);
