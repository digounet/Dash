namespace Dash.Application.DTOs;

public sealed record CloneDashboardLayoutCommand(
    int UserId,
    int SourceLayoutId,
    string? Name = null,
    bool SetAsDefault = true);
